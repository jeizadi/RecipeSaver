"use client";

import { useState } from "react";

type Suggestion = {
  rank: number;
  recipeId: number | null;
  sourceUrl: string | null;
  sourceDomain: string;
  title: string;
  description: string;
  category: string;
  tags: string;
  score: number;
  reasons: string[];
  lane: "repeat_favorite" | "trusted_similar" | "explore";
  budgetImpact: {
    estimatedCostCents: number;
    confidence: number;
    fitScore: number;
  };
  components: {
    budget: number;
    similarity: number;
    repeat: number;
    fatigue: number;
    [key: string]: number;
  };
};

type Diagnostics = {
  topIngredients: Array<{ name: string; score: number }>;
  topDomains: Array<{ domain: string; score: number }>;
  mostCookedRecipeIds: number[];
};

export function SuggestionsPanel() {
  const [includeWebCandidates, setIncludeWebCandidates] = useState(true);
  const [llmEnabled, setLlmEnabled] = useState(false);
  const [embeddingEnabled, setEmbeddingEnabled] = useState(false);
  const [limit, setLimit] = useState(12);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState("");
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [diagnostics, setDiagnostics] = useState<Diagnostics | null>(null);
  const [totals, setTotals] = useState<{
    estimatedWeeklyCostCents?: number;
    budgetTargetCents?: number | null;
  } | null>(null);
  const [feedbackByKey, setFeedbackByKey] = useState<
    Record<string, "like" | "dislike" | "skip">
  >({});
  const [feedbackBusyKey, setFeedbackBusyKey] = useState<string | null>(null);

  function suggestionKey(s: Suggestion): string {
    return `${s.recipeId ?? "web"}::${s.sourceUrl ?? s.title}`;
  }

  async function generate() {
    setLoading(true);
    setStatus("");
    const res = await fetch("/api/suggestions/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        includeWebCandidates,
        limit,
        llmEnabled,
        embeddingEnabled,
      }),
    });
    const data = await res.json().catch(() => ({}));
    setLoading(false);
    if (!data.ok) {
      setStatus(data.error ?? "Failed to generate suggestions.");
      setSuggestions([]);
      return;
    }
    setSuggestions(data.suggestions ?? []);
    setFeedbackByKey({});
    setDiagnostics(data.diagnostics ?? null);
    setTotals(data.totals ?? null);
    setStatus(`Generated ${data.suggestions?.length ?? 0} suggestions.`);
  }

  async function refreshDiagnostics() {
    const res = await fetch("/api/suggestions/diagnostics");
    const data = await res.json().catch(() => ({}));
    if (data.ok) {
      setDiagnostics({
        topIngredients: data.diagnostics?.topIngredients ?? [],
        topDomains: data.diagnostics?.topDomains ?? [],
        mostCookedRecipeIds:
          (data.diagnostics?.mostCookedRecipeIds ?? []).map((x: { recipeId: number }) =>
            Number(x.recipeId)
          ) ?? [],
      });
    }
  }

  async function feedback(
    s: Suggestion,
    signal: "like" | "dislike" | "skip"
  ) {
    const key = suggestionKey(s);
    const already = feedbackByKey[key] === signal;
    setFeedbackBusyKey(`${key}::${signal}`);
    const res = await fetch("/api/suggestions/feedback", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        recipeId: s.recipeId,
        sourceUrl: s.sourceUrl,
        sourceDomain: s.sourceDomain,
        signal,
        undo: already,
      }),
    });
    setFeedbackBusyKey(null);
    const data = await res.json().catch(() => ({}));
    if (!data.ok) return;
    setFeedbackByKey((prev) => {
      const next = { ...prev };
      if (already) delete next[key];
      else next[key] = signal;
      return next;
    });
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-end gap-3">
        <label className="text-sm">
          <span className="mb-1 block text-[#7f8c8d]">Suggestion count</span>
          <input
            type="number"
            min={4}
            max={20}
            value={limit}
            onChange={(e) => setLimit(Number(e.target.value))}
            className="rounded border border-[#d2c2af] px-2 py-1"
          />
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={includeWebCandidates}
            onChange={(e) => setIncludeWebCandidates(e.target.checked)}
          />
          Include open-web candidates
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={embeddingEnabled}
            onChange={(e) => setEmbeddingEnabled(e.target.checked)}
          />
          Use embedding provider (feature-flag)
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={llmEnabled}
            onChange={(e) => setLlmEnabled(e.target.checked)}
          />
          Use LLM rerank/explanations (feature-flag)
        </label>
        <button
          type="button"
          onClick={generate}
          disabled={loading}
          className="rounded bg-[#5b3b2a] px-3 py-2 text-sm font-medium text-white hover:bg-[#4b3022] disabled:opacity-60"
        >
          {loading ? "Generating..." : "Generate suggestions"}
        </button>
        <button
          type="button"
          onClick={refreshDiagnostics}
          className="rounded border border-[#d2c2af] bg-white px-3 py-2 text-sm hover:bg-[#f6efe9]"
        >
          Refresh taste diagnostics
        </button>
      </div>
      {status && <p className="text-sm text-[#7f8c8d]">{status}</p>}
      {totals && (
        <p className="text-xs text-[#5b3b2a]">
          Weekly suggestion cost estimate: $
          {((totals.estimatedWeeklyCostCents ?? 0) / 100).toFixed(2)}
          {totals.budgetTargetCents
            ? ` (target: $${(totals.budgetTargetCents / 100).toFixed(2)})`
            : ""}
        </p>
      )}
      {diagnostics && (
        <div className="rounded border border-[#e0d4c7] bg-[#fffdf8] p-3 text-xs">
          <p className="font-medium text-[#5b3b2a]">Taste diagnostics</p>
          <p className="mt-1 text-[#7f8c8d]">
            Top ingredients:{" "}
            {diagnostics.topIngredients.slice(0, 6).map((x) => x.name).join(", ") || "—"}
          </p>
          <p className="mt-1 text-[#7f8c8d]">
            Top domains:{" "}
            {diagnostics.topDomains.slice(0, 5).map((x) => x.domain).join(", ") || "—"}
          </p>
        </div>
      )}
      <ul className="space-y-2">
        {suggestions.map((s) => (
          <li key={`${s.rank}-${s.title}-${s.sourceUrl ?? ""}`} className="rounded border border-[#e0d4c7] bg-[#fffdf8] p-3">
            <p className="font-medium">#{s.rank} {s.title}</p>
            <p className="text-xs text-[#7f8c8d]">{s.sourceDomain || "unknown source"} · score {s.score.toFixed(2)}</p>
            <div className="mt-1 flex flex-wrap gap-1 text-[11px]">
              <span className="rounded bg-[#fdebd0] px-1.5 py-0.5">{s.lane.replace("_", " ")}</span>
              <span className="rounded bg-[#eafaf1] px-1.5 py-0.5">
                fits budget {s.budgetImpact.fitScore.toFixed(2)}
              </span>
              <span className="rounded bg-[#ebf5fb] px-1.5 py-0.5">
                similar {s.components.similarity.toFixed(2)}
              </span>
            </div>
            <p className="mt-1 text-xs text-[#5b3b2a]">{s.reasons.join(" · ")}</p>
            <div className="mt-2 flex flex-wrap gap-2 text-xs">
              {(() => {
                const key = suggestionKey(s);
                const active = feedbackByKey[key] ?? null;
                const likeOn = active === "like";
                const dislikeOn = active === "dislike";
                const skipOn = active === "skip";
                const likeBusy = feedbackBusyKey === `${key}::like`;
                const dislikeBusy = feedbackBusyKey === `${key}::dislike`;
                const skipBusy = feedbackBusyKey === `${key}::skip`;
                return (
                  <>
              {s.recipeId ? <a href={`/recipes/${s.recipeId}`} className="underline">Open recipe</a> : null}
              {s.sourceUrl ? <a href={s.sourceUrl} target="_blank" rel="noopener noreferrer" className="underline">Source</a> : null}
              <button
                type="button"
                disabled={likeBusy}
                aria-pressed={likeOn}
                className={`rounded px-2 py-0.5 ${
                  likeOn ? "bg-[#eafaf1] font-semibold text-[#1e8449]" : "underline"
                } disabled:opacity-60`}
                onClick={() => feedback(s, "like")}
              >
                Like
              </button>
              <button
                type="button"
                disabled={dislikeBusy}
                aria-pressed={dislikeOn}
                className={`rounded px-2 py-0.5 ${
                  dislikeOn ? "bg-[#fdecea] font-semibold text-[#c0392b]" : "underline"
                } disabled:opacity-60`}
                onClick={() => feedback(s, "dislike")}
              >
                Dislike
              </button>
              <button
                type="button"
                disabled={skipBusy}
                aria-pressed={skipOn}
                className={`rounded px-2 py-0.5 ${
                  skipOn ? "bg-[#eef1f2] font-semibold text-[#566573]" : "underline"
                } disabled:opacity-60`}
                onClick={() => feedback(s, "skip")}
              >
                Skip
              </button>
                  </>
                );
              })()}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
