import type { AggregatedIngredient } from "./ingredients";

const TIMEOUT_MS = 25_000;

const SYSTEM_PROMPT =
  "You consolidate a grocery shopping list. Merge rows that refer to the same real-world item; " +
  "add totalQuantity when combining. Keep units (cup, head, clove, bunch, etc.) consistent. " +
  "Output ONLY compact JSON: {\"items\":[{\"nameKey\":\"\",\"displayName\":\"\",\"unit\":null,\"totalQuantity\":null,\"lines\":[]}]}. " +
  "nameKey: lowercase normalized key. unit: string or null. totalQuantity: a JSON number or null. " +
  "lines: string array of contributing original lines (never omit; use merged list). " +
  "Do not invent items. If uncertain, keep separate.";

export type RefineLlmResult =
  | { ok: true; items: AggregatedIngredient[] }
  | { ok: false; error: string };

/** Models sometimes wrap JSON in ``` fences */
function extractJsonStringFromLlmContent(text: string): string {
  const t = text.trim();
  const fence = t.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  if (fence) return fence[1].trim();
  return t;
}

function normalizeRowToAggregated(x: unknown): AggregatedIngredient | null {
  if (!x || typeof x !== "object") return null;
  const o = x as Record<string, unknown>;
  if (typeof o.displayName !== "string" || !o.displayName.trim()) return null;

  let unit: string | null = null;
  if (o.unit === null || o.unit === undefined) {
    unit = null;
  } else if (typeof o.unit === "string") {
    unit = o.unit.trim() || null;
  } else {
    return null;
  }

  let totalQuantity: number | null = null;
  if (o.totalQuantity == null) {
    totalQuantity = null;
  } else if (typeof o.totalQuantity === "number" && Number.isFinite(o.totalQuantity)) {
    totalQuantity = o.totalQuantity;
  } else if (typeof o.totalQuantity === "string") {
    const n = Number(String(o.totalQuantity).trim());
    totalQuantity = Number.isFinite(n) ? n : null;
  } else {
    return null;
  }

  let lines: string[] = [];
  if (Array.isArray(o.lines)) {
    lines = o.lines.filter((l): l is string => typeof l === "string");
  } else if (typeof o.lines === "string" && o.lines.trim()) {
    lines = [o.lines.trim()];
  }
  if (!lines.length) {
    lines = [o.displayName.trim()];
  }

  const nameKey =
    typeof o.nameKey === "string" && o.nameKey.trim()
      ? o.nameKey.trim().toLowerCase()
      : o.displayName.trim().toLowerCase();

  return {
    nameKey,
    displayName: o.displayName.trim(),
    unit,
    totalQuantity,
    lines,
  };
}

function buildUserMessage(items: AggregatedIngredient[]): string {
  return JSON.stringify({
    items: items.map((i) => ({
      nameKey: i.nameKey,
      displayName: i.displayName,
      unit: i.unit,
      totalQuantity: i.totalQuantity,
      lines: i.lines,
    })),
  });
}

function parseModelJsonToItems(
  text: string,
  modelLabel: string
): RefineLlmResult {
  if (!text.trim()) {
    return { ok: false, error: `${modelLabel} returned an empty message.` };
  }

  let parsed: { items?: unknown };
  try {
    parsed = JSON.parse(extractJsonStringFromLlmContent(text)) as {
      items?: unknown;
    };
  } catch (e) {
    console.error("shopping-list LLM JSON parse", e, text.slice(0, 500));
    return {
      ok: false,
      error: `Could not parse ${modelLabel} reply as JSON. Try again or change GEMINI_MODEL / OPENAI_MODEL.`,
    };
  }

  if (!Array.isArray(parsed.items)) {
    return {
      ok: false,
      error: `AI JSON from ${modelLabel} must include an "items" array.`,
    };
  }

  const out: AggregatedIngredient[] = [];
  for (const row of parsed.items) {
    const agg = normalizeRowToAggregated(row);
    if (agg) out.push(agg);
  }

  if (!out.length) {
    return {
      ok: false,
      error: `${modelLabel} returned no usable rows (try again).`,
    };
  }

  return { ok: true, items: out };
}

/**
 * Gemini 2.0 Flash is deprecated; the free tier often reports limit:0 on it.
 * Default to 2.5 Flash-Lite / Flash, and fall back when quota errors mention limits.
 */
const DEFAULT_GEMINI_MODEL_FALLBACKS = [
  "gemini-2.5-flash-lite",
  "gemini-2.5-flash",
];

function resolveGeminiModelCandidates(): string[] {
  const primary = process.env.GEMINI_MODEL?.trim();
  const extra = process.env.GEMINI_MODEL_FALLBACKS?.split(/[,;\s]+/)
    .map((s) => s.trim())
    .filter(Boolean);
  const tail =
    extra != null && extra.length > 0 ? extra : DEFAULT_GEMINI_MODEL_FALLBACKS;
  const ordered = primary
    ? [primary, ...tail]
    : [...DEFAULT_GEMINI_MODEL_FALLBACKS];
  return [...new Set(ordered)];
}

function geminiErrorIsRetryableWithOtherModel(message: string): boolean {
  const m = message.toLowerCase();
  return (
    m.includes("quota") ||
    m.includes("resource_exhausted") ||
    m.includes("limit: 0") ||
    m.includes("rate limit") ||
    m.includes("too many requests") ||
    m.includes("retry in")
  );
}

type GeminiRawResult =
  | { ok: true; text: string; model: string }
  | { ok: false; error: string; retryable: boolean };

async function geminiGenerateRaw(
  items: AggregatedIngredient[],
  apiKey: string,
  model: string
): Promise<GeminiRawResult> {
  const url = new URL(
    `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`
  );
  url.searchParams.set("key", apiKey);

  const body = {
    systemInstruction: {
      parts: [{ text: SYSTEM_PROMPT }],
    },
    contents: [
      {
        role: "user",
        parts: [{ text: buildUserMessage(items) }],
      },
    ],
    generationConfig: {
      temperature: 0.2,
      responseMimeType: "application/json",
    },
  };

  const res = await fetch(url.toString(), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });

  const rawBody = await res.text();

  let data: {
    error?: { message?: string; code?: number; status?: string };
    candidates?: Array<{
      content?: { parts?: Array<{ text?: string }> };
      finishReason?: string;
    }>;
  };

  try {
    data = JSON.parse(rawBody) as typeof data;
  } catch {
    return {
      ok: false,
      error: `Gemini (${model}) non-JSON response (HTTP ${res.status}): ${rawBody.slice(0, 160)}`,
      retryable: res.status === 429 || res.status === 503,
    };
  }

  if (data.error?.message) {
    console.error("Gemini shopping-list refine", model, data.error);
    const msg = data.error.message;
    return {
      ok: false,
      error: msg,
      retryable: geminiErrorIsRetryableWithOtherModel(msg),
    };
  }

  if (!res.ok) {
    return {
      ok: false,
      error: `Gemini (${model}) HTTP ${res.status}.`,
      retryable: res.status === 429 || res.status === 503,
    };
  }

  const parts = data.candidates?.[0]?.content?.parts;
  const text =
    parts?.map((p) => (typeof p.text === "string" ? p.text : "")).join("") ?? "";

  if (!text.trim() && data.candidates?.[0]?.finishReason) {
    return {
      ok: false,
      error: `Gemini (${model}) empty (finishReason: ${data.candidates[0].finishReason}).`,
      retryable: false,
    };
  }

  return { ok: true, text, model };
}

async function refineWithGemini(
  items: AggregatedIngredient[],
  apiKey: string
): Promise<RefineLlmResult> {
  const models = resolveGeminiModelCandidates();
  let lastError = "";

  for (let i = 0; i < models.length; i++) {
    const model = models[i];
    const raw = await geminiGenerateRaw(items, apiKey, model);
    if (!raw.ok) {
      lastError = raw.error;
      const more = i < models.length - 1;
      if (raw.retryable && more) {
        console.warn(
          `Gemini model "${model}" failed (retryable); trying next model.`
        );
        continue;
      }
      return { ok: false, error: raw.error };
    }

    const parsed = parseModelJsonToItems(
      raw.text,
      `Gemini (${raw.model})`
    );
    if (parsed.ok) return parsed;
    return parsed;
  }

  return {
    ok: false,
    error:
      lastError ||
      `Gemini failed for all models tried: ${models.join(", ")}.`,
  };
}

async function refineWithOpenAI(
  items: AggregatedIngredient[],
  apiKey: string
): Promise<RefineLlmResult> {
  const model = process.env.OPENAI_MODEL?.trim() || "gpt-4o-mini";

  const body = {
    model,
    messages: [
      { role: "system" as const, content: SYSTEM_PROMPT },
      { role: "user" as const, content: buildUserMessage(items) },
    ],
    response_format: { type: "json_object" as const },
    temperature: 0.2,
  };

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });

  const rawBody = await res.text();
  if (!res.ok) {
    let msg = `OpenAI request failed (HTTP ${res.status}).`;
    try {
      const j = JSON.parse(rawBody) as {
        error?: { message?: string };
      };
      if (j.error?.message) msg = j.error.message;
    } catch {
      if (rawBody.length < 300) msg = `${msg} ${rawBody}`;
    }
    console.error("OpenAI shopping-list refine HTTP", res.status, rawBody);
    return { ok: false, error: msg };
  }

  const data = JSON.parse(rawBody) as {
    choices?: { message?: { content?: string | null } }[];
  };
  const text = data.choices?.[0]?.message?.content;
  return parseModelJsonToItems(text ?? "", "OpenAI");
}

/**
 * Shopping-list refinement: prefers **Gemini** (`GEMINI_API_KEY`, `GOOGLE_AI_API_KEY`, or
 * `GOOGLE_GENERATIVE_AI_API_KEY`),
 * then **OpenAI** if only `OPENAI_API_KEY` is set.
 */
export async function refineAggregatedItemsWithLlm(
  items: AggregatedIngredient[]
): Promise<RefineLlmResult> {
  const geminiKey =
    process.env.GEMINI_API_KEY?.trim() ||
    process.env.GOOGLE_AI_API_KEY?.trim() ||
    process.env.GOOGLE_GENERATIVE_AI_API_KEY?.trim();
  const openaiKey = process.env.OPENAI_API_KEY?.trim();

  if (!items.length) {
    return { ok: true, items: [] };
  }

  if (!geminiKey && !openaiKey) {
    return {
      ok: false,
      error:
        "No AI key set. Add GEMINI_API_KEY (or GOOGLE_GENERATIVE_AI_API_KEY), or OPENAI_API_KEY, to .env and restart `next dev`.",
    };
  }

  try {
    if (geminiKey) {
      return await refineWithGemini(items, geminiKey);
    }
    return await refineWithOpenAI(items, openaiKey!);
  } catch (e) {
    console.error("refineAggregatedItemsWithLlm", e);
    const message = e instanceof Error ? e.message : "Unknown error";
    return {
      ok: false,
      error: `AI request failed: ${message}`,
    };
  }
}
