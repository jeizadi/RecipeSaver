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
    <div className="space-y-4">
      <div className="rounded-2xl border border-[#eadfca] bg-white p-4">
        <div className="flex flex-wrap items-end gap-3">
          <label className="text-sm">
            <span className="mb-1 block text-slate-500">How many ideas?</span>
          <input
            type="number"
            min={4}
            max={20}
            value={limit}
            onChange={(e) => setLimit(Number(e.target.value))}
            className="w-24 rounded-xl border border-slate-200 px-3 py-2"
          />
          </label>
          <label className="flex items-center gap-2 pb-2 text-sm text-slate-700">
          <input
            type="checkbox"
            checked={includeWebCandidates}
            onChange={(e) => setIncludeWebCandidates(e.target.checked)}
          />
          Include open-web candidates
          </label>
          <button
            type="button"
            onClick={generate}
            disabled={loading}
            className="rounded-xl bg-[#f4a51c] px-4 py-2 text-sm font-semibold text-[#4a2b00] hover:bg-[#e39a0f] disabled:opacity-60"
          >
            {loading ? "Finding ideas…" : "Find recipes"}
          </button>
          <button
            type="button"
            onClick={refreshDiagnostics}
            className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-600 hover:bg-[#fff7e8]"
          >
            Refresh taste profile
          </button>
        </div>
        <details className="mt-3 border-t border-slate-100 pt-3 text-sm">
          <summary className="cursor-pointer text-slate-500">Advanced options</summary>
          <div className="mt-3 flex flex-wrap gap-4 text-slate-600">
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={embeddingEnabled} onChange={(e) => setEmbeddingEnabled(e.target.checked)} />
              Use embeddings
            </label>
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={llmEnabled} onChange={(e) => setLlmEnabled(e.target.checked)} />
              Use AI explanations
            </label>
          </div>
        </details>
      </div>
      {status && <p className="rounded-xl bg-white px-4 py-3 text-sm text-slate-500">{status}</p>}
      {totals && (
        <p className="text-xs text-slate-500">
          Weekly suggestion cost estimate: $
          {((totals.estimatedWeeklyCostCents ?? 0) / 100).toFixed(2)}
          {totals.budgetTargetCents
            ? ` (target: $${(totals.budgetTargetCents / 100).toFixed(2)})`
            : ""}
        </p>
      )}
      {diagnostics && (
        <div className="rounded-xl border border-[#eadfca] bg-[#fff7e8] p-3 text-xs">
          <p className="font-medium text-[#4a2b00]">Taste profile</p>
          <p className="mt-1 text-slate-500">
            Top ingredients:{" "}
            {diagnostics.topIngredients.slice(0, 6).map((x) => x.name).join(", ") || "—"}
          </p>
          <p className="mt-1 text-slate-500">
            Top domains:{" "}
            {diagnostics.topDomains.slice(0, 5).map((x) => x.domain).join(", ") || "—"}
          </p>
        </div>
      )}
      <ul className="grid gap-3 md:grid-cols-2">
        {suggestions.map((s) => (
          <li key={`${s.rank}-${s.title}-${s.sourceUrl ?? ""}`} className="rounded-2xl border border-[#eadfca] bg-white p-4">
            <div className="flex items-start justify-between gap-3">
              <p className="font-semibold text-slate-900">{s.title}</p>
              <span className="rounded-full bg-[#fff0c7] px-2 py-1 text-xs font-medium text-[#8a5200]">#{s.rank}</span>
            </div>
            <p className="mt-1 text-xs text-slate-400">{s.sourceDomain || "unknown source"}</p>
            <div className="mt-1 flex flex-wrap gap-1 text-[11px]">
              <span className="rounded-full bg-[#fff0c7] px-2 py-1 text-[#8a5200]">{s.lane.replace("_", " ")}</span>
              <span className="rounded-full bg-[#f3f7ed] px-2 py-1 text-[#527044]">
                fits budget {s.budgetImpact.fitScore.toFixed(2)}
              </span>
              <span className="rounded-full bg-[#f1f3f5] px-2 py-1 text-slate-600">
                similar {s.components.similarity.toFixed(2)}
              </span>
            </div>
            <p className="mt-3 text-sm text-slate-600">{s.reasons.join(" · ")}</p>
            <div className="mt-4 flex flex-wrap gap-2 border-t border-slate-100 pt-3 text-xs">
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
