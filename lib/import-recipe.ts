import * as cheerio from "cheerio";

const ISO_8601_DURATION =
  /^P(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?)?$/;

const FRACTION_MAP: Record<string, string> = {
  "¼": "1/4",
  "½": "1/2",
  "¾": "3/4",
  "⅓": "1/3",
  "⅔": "2/3",
  "⅕": "1/5",
  "⅖": "2/5",
  "⅗": "3/5",
  "⅘": "4/5",
  "⅙": "1/6",
  "⅚": "5/6",
  "⅛": "1/8",
  "⅜": "3/8",
  "⅝": "5/8",
  "⅞": "7/8",
};

export interface ImportedRecipe {
  title: string;
  ingredientsText: string;
  instructionsText: string;
  prepTimeMinutes: number | null;
  cookTimeMinutes: number | null;
  totalTimeMinutes: number | null;
  servings: string;
  imageUrl: string;
  author: string;
  category: string;
}

function decodeHtml(html: string): string {
  // Basic named entities and common fraction entities.
  let s = html
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&frac12;/g, "1/2")
    .replace(/&frac14;/g, "1/4")
    .replace(/&frac34;/g, "3/4")
    .replace(/&frac13;/g, "1/3")
    .replace(/&frac23;/g, "2/3");

  // Decode numeric entities like &#189; (½) or &#8531; (⅓).
  s = s.replace(/&#(\d+);/g, (_m, code) => {
    const n = Number(code);
    if (!Number.isFinite(n)) return _m;
    return String.fromCharCode(n);
  });

  // Decode hex numeric entities like &#x00BD; if present.
  s = s.replace(/&#x([0-9a-fA-F]+);/g, (_m, hex) => {
    const n = parseInt(hex, 16);
    if (!Number.isFinite(n)) return _m;
    return String.fromCharCode(n);
  });

  return s;
}

function normalizeText(value: string | null | undefined): string | null {
  if (value == null || value === "") return null;
  let s = decodeHtml(String(value));
  s = s.replace(/\u00A0/g, " ");
  for (const [k, v] of Object.entries(FRACTION_MAP)) s = s.replaceAll(k, v);
  // Fix mixed numbers like "11/2" that came from "1½" → "1" + "1/2"
  // by inserting a space between the whole number and fraction.
  s = s.replace(/\b(\d)(\d+\/\d+)\b/g, "$1 $2");
  // Tidy up numeric quantities with too many decimal places
  // (e.g. "15.873 oz" -> "15.9 oz") to avoid noisy decimals from some schemas.
  s = s.replace(
    /\b(\d+\.\d{3,})\b/g,
    (_m, num) => Number(num).toFixed(1).replace(/\.0$/, "")
  );
  s = s.trim();
  return s || null;
}

function normalizeMultiline(value: string | null | undefined): string | null {
  if (value == null || value === "") return null;
  const lines = value.split("\n").map((line) => normalizeText(line) ?? "");
  const trimmed = lines.filter((l) => l.trim());
  return trimmed.length ? trimmed.join("\n") : null;
}

function iso8601ToMinutes(value: string | null | undefined): number | null {
  if (value == null || value === "") return null;
  const m = value.trim().match(ISO_8601_DURATION);
  if (!m) return null;
  const days = parseInt(m[1] ?? "0", 10);
  const hours = parseInt(m[2] ?? "0", 10);
  const minutes = parseInt(m[3] ?? "0", 10);
  const seconds = parseInt(m[4] ?? "0", 10);
  const totalSeconds = ((days * 24 + hours) * 60 + minutes) * 60 + seconds;
  if (totalSeconds <= 0) return null;
  return Math.max(1, Math.round(totalSeconds / 60));
}

function coerceListToText(items: unknown): string | null {
  if (items == null) return null;
  if (typeof items === "string") return normalizeText(items);
  if (Array.isArray(items)) {
    const parts: string[] = [];
    for (const item of items) {
      if (typeof item === "string") {
        const s = normalizeText(item);
        if (s) parts.push(s);
      }
    }
    return parts.length ? parts.join("\n") : null;
  }
  return null;
}

function coerceYieldToText(items: unknown): string | null {
  if (items == null) return null;
  if (typeof items === "string") return normalizeText(items);
  if (Array.isArray(items)) {
    for (const item of items) {
      if (typeof item === "string") {
        const s = normalizeText(item);
        if (s) return s;
      }
    }
  }
  return null;
}

type JsonObj = Record<string, unknown>;

function parseInstructions(instructions: unknown): string | null {
  if (instructions == null) return null;
  if (typeof instructions === "string") return normalizeText(instructions);
  if (Array.isArray(instructions)) {
    const steps: string[] = [];
    for (const item of instructions) {
      if (typeof item === "string") {
        const s = normalizeText(item);
        if (s) steps.push(s);
        continue;
      }
      if (item && typeof item === "object" && !Array.isArray(item)) {
        const obj = item as JsonObj;
        // Handle HowToSection explicitly so we don't lose nested steps.
        if (
          obj["@type"] === "HowToSection" &&
          Array.isArray(obj.itemListElement)
        ) {
          const sectionName =
            typeof obj.name === "string" && obj.name.trim()
              ? normalizeText(obj.name as string)
              : null;
          const nested = parseInstructions(obj.itemListElement);
          if (sectionName) {
            steps.push(sectionName);
          }
          if (nested) {
            for (const line of nested.split("\n")) {
              if (line.trim()) steps.push(line.trim());
            }
          }
          continue;
        }

        const text = (obj.text ?? obj.name) as string | undefined;
        if (typeof text === "string" && text.trim()) {
          steps.push(normalizeText(text) ?? "");
        }
      }
    }
    return steps.filter((s) => s.trim()).length ? steps.join("\n") : null;
  }
  if (typeof instructions === "object" && instructions !== null) {
    const obj = instructions as JsonObj;
    if (
      obj["@type"] === "HowToSection" &&
      Array.isArray(obj.itemListElement)
    ) {
      return parseInstructions(obj.itemListElement);
    }
    const text = (obj.text ?? obj.name) as string | undefined;
    if (typeof text === "string" && text.trim()) return normalizeText(text);
  }
  return null;
}

function findRecipeObject(obj: unknown): JsonObj | null {
  if (obj == null) return null;
  if (typeof obj !== "object") return null;
  if (Array.isArray(obj)) {
    for (const item of obj) {
      const found = findRecipeObject(item);
      if (found) return found;
    }
    return null;
  }
  const d = obj as JsonObj;
  const typ = d["@type"];
  if (typeof typ === "string" && typ.toLowerCase() === "recipe") return d;
  if (Array.isArray(typ) && typ.some((t) => typeof t === "string" && (t as string).toLowerCase() === "recipe"))
    return d;
  const graph = d["@graph"];
  if (Array.isArray(graph)) {
    for (const node of graph) {
      const found = findRecipeObject(node);
      if (found) return found;
    }
  }
  for (const v of Object.values(d)) {
    const found = findRecipeObject(v);
    if (found) return found;
  }
  return null;
}

function extractAuthor(recipeObj: JsonObj): string | null {
  const author = recipeObj.author;
  if (typeof author === "string") return normalizeText(author);
  if (author && typeof author === "object" && !Array.isArray(author)) {
    const name = (author as JsonObj).name;
    if (typeof name === "string" && name.trim()) return normalizeText(name);
  }
  if (Array.isArray(author)) {
    const names: string[] = [];
    for (const a of author) {
      if (typeof a === "string" && a.trim()) names.push(normalizeText(a) ?? "");
      else if (a && typeof a === "object" && typeof (a as JsonObj).name === "string")
        names.push(normalizeText((a as JsonObj).name as string) ?? "");
    }
    return names.filter(Boolean).length ? names.join(", ") : null;
  }
  return null;
}

function extractImageUrl(recipeObj: JsonObj): string | null {
  const image = recipeObj.image;
  if (typeof image === "string") return normalizeText(image);
  if (Array.isArray(image)) {
    for (const item of image) {
      if (typeof item === "string" && item.trim()) return normalizeText(item);
      if (item && typeof item === "object" && typeof (item as JsonObj).url === "string")
        return normalizeText((item as JsonObj).url as string);
    }
  }
  if (image && typeof image === "object" && typeof (image as JsonObj).url === "string")
    return normalizeText((image as JsonObj).url as string);
  return null;
}

function extractDirectionsFromHtml(html: string): string | null {
  const $ = cheerio.load(html);

  // Look for a heading that contains a directions/instructions keyword.
  const heading = $("h1, h2, h3, h4, h5, h6")
    .filter((_, el) => {
      const text = $(el).text().trim().toLowerCase();
      return (
        text.includes("directions") ||
        text.includes("instructions") ||
        text.includes("method")
      );
    })
    .first();

  if (!heading.length) return null;

  // Prefer the first ordered/unordered list after the heading.
  let list = heading.nextAll("ol,ul").first();
  if (!list.length) {
    // Fallback: search within the same section/container.
    list = heading.parent().find("ol,ul").first();
  }
  if (!list.length) return null;

  const steps: string[] = [];
  list.find("li").each((_, li) => {
    const raw = $(li).text();
    const text = normalizeText(raw);
    if (text && text.trim()) {
      steps.push(text.trim());
    }
  });

  return steps.length ? steps.join("\n") : null;
}

function inferCategory(text: string | null | undefined): string | null {
  if (text == null || text === "") return null;
  const t = text.toLowerCase();
  if (["breakfast", "brunch"].some((k) => t.includes(k))) return "breakfast";
  if (t.includes("lunch")) return "lunch";
  if (["dinner", "entree", "main", "main dish", "main course"].some((k) => t.includes(k))) return "dinner";
  if (["side", "side dish", "salad", "soup", "stew", "appetizer"].some((k) => t.includes(k))) return "side";
  if (["dessert", "cake", "cookie", "brownie", "pie", "ice cream"].some((k) => t.includes(k))) return "dessert";
  if (["drink", "cocktail", "smoothie", "beverage"].some((k) => t.includes(k))) return "drink";
  if (["sauce", "dressing", "marinade", "condiment"].some((k) => t.includes(k))) return "sauce";
  if (t.includes("snack")) return "snack";
  return null;
}

function extractFromVideoDescription(
  description: string
): [string | null, string | null] {
  const desc = normalizeMultiline(description) ?? "";
  if (!desc) return [null, null];
  const lower = desc.toLowerCase();
  const ingLabels = ["ingredients", "ingredient"];
  const instLabels = ["instructions", "directions", "method", "steps"];
  let ingIdx = -1,
    ingLabelLen = 0;
  for (const label of ingLabels) {
    const idx = lower.indexOf(label);
    if (idx !== -1 && (ingIdx === -1 || idx < ingIdx)) {
      ingIdx = idx;
      ingLabelLen = label.length;
    }
  }
  let instIdx = -1,
    instLabelLen = 0;
  for (const label of instLabels) {
    const idx = lower.indexOf(label);
    if (idx !== -1 && (instIdx === -1 || idx < instIdx)) {
      instIdx = idx;
      instLabelLen = label.length;
    }
  }
  let ingredientsText: string | null = null;
  let instructionsText: string | null = null;
  if (ingIdx !== -1) {
    const start = ingIdx + ingLabelLen;
    const end = instIdx !== -1 && instIdx > start ? instIdx : desc.length;
    ingredientsText = normalizeMultiline(desc.slice(start, end));
  }
  if (instIdx !== -1) {
    instructionsText = normalizeMultiline(desc.slice(instIdx + instLabelLen));
  }
  if (!ingredientsText && !instructionsText) return [null, desc];
  return [ingredientsText, instructionsText];
}

const VIDEO_HOSTS = new Set([
  "www.youtube.com",
  "youtube.com",
  "m.youtube.com",
  "youtu.be",
  "www.youtu.be",
  "vimeo.com",
  "www.vimeo.com",
]);

function emptyRecipe(): ImportedRecipe {
  return {
    title: "",
    ingredientsText: "",
    instructionsText: "",
    prepTimeMinutes: null,
    cookTimeMinutes: null,
    totalTimeMinutes: null,
    servings: "",
    imageUrl: "",
    author: "",
    category: "",
  };
}

function parseFromJsonLd(html: string): ImportedRecipe | null {
  const $ = cheerio.load(html);
  const scripts = $('script[type="application/ld+json"]');
  for (let i = 0; i < scripts.length; i++) {
    const raw = $(scripts[i]).html()?.trim() ?? "";
    if (!raw) continue;
    let data: unknown;
    try {
      data = JSON.parse(raw);
    } catch {
      continue;
    }
    const recipeObj = findRecipeObject(data);
    if (!recipeObj) continue;

    const imported = emptyRecipe();
    const name = recipeObj.name;
    if (typeof name === "string" && name.trim()) imported.title = normalizeText(name) ?? "";

    imported.ingredientsText =
      normalizeMultiline(
        coerceListToText(recipeObj.recipeIngredient) ?? coerceListToText(recipeObj.ingredients)
      ) ?? "";

    // Some sites use non-standard keys like "recipeDirections" or "directions"
    // instead of "recipeInstructions". Try these fallbacks before giving up.
    const rawInstructions =
      (recipeObj as JsonObj).recipeInstructions ??
      (recipeObj as JsonObj).recipeDirections ??
      (recipeObj as JsonObj).directions;
    imported.instructionsText =
      normalizeMultiline(parseInstructions(rawInstructions)) ?? "";
    imported.prepTimeMinutes = iso8601ToMinutes(recipeObj.prepTime as string);
    imported.cookTimeMinutes = iso8601ToMinutes(recipeObj.cookTime as string);
    imported.totalTimeMinutes = iso8601ToMinutes(recipeObj.totalTime as string);
    imported.servings = normalizeText(coerceYieldToText(recipeObj.recipeYield)) ?? "";
    imported.imageUrl = extractImageUrl(recipeObj) ?? "";
    imported.author = extractAuthor(recipeObj) ?? "";
    imported.category =
      inferCategory(coerceListToText(recipeObj.recipeCategory)) ?? "";

    return imported;
  }
  return null;
}

function parseFromOpenGraph(
  html: string,
  isVideoLike: boolean
): ImportedRecipe | null {
  const $ = cheerio.load(html);
  const ogTitle = $('meta[property="og:title"]').attr("content");
  const ogImage = $('meta[property="og:image"]').attr("content");
  const ogDesc = $('meta[property="og:description"]').attr("content");
  const metaDesc = $('meta[name="description"]').attr("content");
  const title = normalizeText(ogTitle ?? $("title").text()) ?? "";
  const image = normalizeText(ogImage ?? "");
  const description = normalizeText(ogDesc ?? metaDesc ?? "");

  if (!title && !image) return null;
  const imported = emptyRecipe();
  if (title) imported.title = title;
  if (image) imported.imageUrl = image;

  if (isVideoLike && description) {
    const [ing, inst] = extractFromVideoDescription(description);
    imported.ingredientsText = ing ?? "";
    imported.instructionsText = inst ?? "";
    imported.category = inferCategory(description) ?? inferCategory(imported.title) ?? "";
  }
  return imported;
}

export class RecipeImportError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RecipeImportError";
  }
}

export async function importRecipeFromUrl(url: string): Promise<ImportedRecipe> {
  const res = await fetch(url, {
    headers: {
      "User-Agent": "RecipeboxImporter/1.0 (+https; personal use)",
      Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    },
    signal: AbortSignal.timeout(12_000),
  });
  if (!res.ok) throw new RecipeImportError(`Failed to fetch: ${res.status}`);
  const html = await res.text();

  let recipe = parseFromJsonLd(html);
  const hostname = new URL(url).hostname.toLowerCase();
  const isVideoLike = VIDEO_HOSTS.has(hostname);

  if (!recipe) {
    recipe = parseFromOpenGraph(html, isVideoLike);
  }

  if (recipe) {
    // If we didn't get instructions from structured data, try a plain-HTML fallback
    // by looking for a "Directions"/"Instructions" section in the page.
    if (!recipe.instructionsText) {
      const htmlDirections = extractDirectionsFromHtml(html);
      if (htmlDirections) {
        recipe.instructionsText = htmlDirections;
      }
    }
    return recipe;
  }

  throw new RecipeImportError("Could not find recipe structured data on that page.");
}
