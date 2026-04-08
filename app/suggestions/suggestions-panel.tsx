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
};

export function SuggestionsPanel() {
  const [includeWebCandidates, setIncludeWebCandidates] = useState(true);
  const [limit, setLimit] = useState(12);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState("");
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);

  async function generate() {
    setLoading(true);
    setStatus("");
    const res = await fetch("/api/suggestions/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ includeWebCandidates, limit }),
    });
    const data = await res.json().catch(() => ({}));
    setLoading(false);
    if (!data.ok) {
      setStatus(data.error ?? "Failed to generate suggestions.");
      setSuggestions([]);
      return;
    }
    setSuggestions(data.suggestions ?? []);
    setStatus(`Generated ${data.suggestions?.length ?? 0} suggestions.`);
  }

  async function feedback(
    s: Suggestion,
    signal: "like" | "dislike" | "skip" | "add_to_plan" | "cooked"
  ) {
    await fetch("/api/suggestions/feedback", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        recipeId: s.recipeId,
        sourceUrl: s.sourceUrl,
        sourceDomain: s.sourceDomain,
        signal,
      }),
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
        <button
          type="button"
          onClick={generate}
          disabled={loading}
          className="rounded bg-[#5b3b2a] px-3 py-2 text-sm font-medium text-white hover:bg-[#4b3022] disabled:opacity-60"
        >
          {loading ? "Generating..." : "Generate suggestions"}
        </button>
      </div>
      {status && <p className="text-sm text-[#7f8c8d]">{status}</p>}
      <ul className="space-y-2">
        {suggestions.map((s) => (
          <li key={`${s.rank}-${s.title}-${s.sourceUrl ?? ""}`} className="rounded border border-[#e0d4c7] bg-[#fffdf8] p-3">
            <p className="font-medium">#{s.rank} {s.title}</p>
            <p className="text-xs text-[#7f8c8d]">{s.sourceDomain || "unknown source"} · score {s.score.toFixed(2)}</p>
            <p className="mt-1 text-xs text-[#5b3b2a]">{s.reasons.join(" · ")}</p>
            <div className="mt-2 flex flex-wrap gap-2 text-xs">
              {s.recipeId ? <a href={`/recipes/${s.recipeId}`} className="underline">Open recipe</a> : null}
              {s.sourceUrl ? <a href={s.sourceUrl} target="_blank" rel="noopener noreferrer" className="underline">Source</a> : null}
              <button type="button" className="underline" onClick={() => feedback(s, "like")}>Like</button>
              <button type="button" className="underline" onClick={() => feedback(s, "dislike")}>Dislike</button>
              <button type="button" className="underline" onClick={() => feedback(s, "skip")}>Skip</button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
