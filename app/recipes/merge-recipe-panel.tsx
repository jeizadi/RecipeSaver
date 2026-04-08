"use client";

import { useCallback, useEffect, useState } from "react";

type RecipeRow = {
  id: number;
  title: string;
};

type Props = {
  parentRecipeId: number;
  ingredientsText: string;
  instructionsText: string;
  onMerged: (
    ingredientsText: string,
    instructionsText: string,
    mergedTitle: string
  ) => void;
};

export function MergeRecipePanel({
  parentRecipeId,
  ingredientsText,
  instructionsText,
  onMerged,
}: Props) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<RecipeRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [merging, setMerging] = useState(false);
  const [mergeError, setMergeError] = useState<string | null>(null);

  const search = useCallback(async (q: string) => {
    setLoading(true);
    setMergeError(null);
    try {
      const sp = new URLSearchParams();
      if (q.trim()) sp.set("q", q.trim());
      sp.set("page", "1");
      const res = await fetch(`/api/recipes?${sp.toString()}`);
      const data = await res.json().catch(() => ({}));
      const list = (data.recipes ?? []) as RecipeRow[];
      setResults(list.filter((r) => r.id !== parentRecipeId));
    } catch {
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, [parentRecipeId]);

  useEffect(() => {
    const t = setTimeout(() => {
      void search(query);
    }, 300);
    return () => clearTimeout(t);
  }, [query, search]);

  async function mergeChild(child: RecipeRow) {
    const ok = window.confirm(
      `Merge “${child.title}” into this recipe?\n\n` +
        "Its ingredients and instructions will be appended below yours with a clear heading. " +
        "The other recipe will stay in your library. Click Save on this page to store the result."
    );
    if (!ok) return;

    setMerging(true);
    setMergeError(null);
    try {
      const res = await fetch(`/api/recipes/${parentRecipeId}/merge`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          childRecipeId: child.id,
          ingredientsText,
          instructionsText,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!data.ok) {
        setMergeError(data.error ?? "Merge failed.");
        return;
      }
      onMerged(
        data.ingredientsText ?? ingredientsText,
        data.instructionsText ?? instructionsText,
        data.mergedTitle ?? child.title
      );
    } catch {
      setMergeError("Merge failed. Try again.");
    } finally {
      setMerging(false);
    }
  }

  return (
    <div className="rounded border border-[#e0d4c7] bg-[#fffdf8] p-4">
      <h3 className="mb-1 text-sm font-semibold text-[#5b3b2a]">
        Merge another recipe into this one
      </h3>
      <p className="mb-3 text-xs text-[#7f8c8d]">
        Pick a recipe (e.g. a sauce). Its ingredients and instructions are
        appended to this recipe so you can keep one combined dish. Save when
        you’re happy with the text.
      </p>
      <label className="mb-2 block text-sm font-medium">Search your recipes</label>
      <input
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Recipe title…"
        className="mb-2 w-full rounded border border-[#d2c2af] px-2 py-1.5 text-sm"
      />
      {mergeError && (
        <p className="mb-2 text-xs text-[#c0392b]">{mergeError}</p>
      )}
      <ul className="max-h-40 space-y-1 overflow-y-auto text-sm">
        {loading && results.length === 0 ? (
          <li className="text-[#7f8c8d]">Loading…</li>
        ) : results.length === 0 ? (
          <li className="text-[#7f8c8d]">No recipes match.</li>
        ) : (
          results.map((r) => (
            <li key={r.id}>
              <button
                type="button"
                disabled={merging}
                onClick={() => void mergeChild(r)}
                className="w-full rounded border border-[#d2c2af] bg-white px-2 py-1.5 text-left hover:bg-[#f6efe9] disabled:opacity-60"
              >
                <span className="font-medium text-[#5b3b2a]">{r.title}</span>
                <span className="ml-2 text-xs text-[#7f8c8d]">Merge</span>
              </button>
            </li>
          ))
        )}
      </ul>
    </div>
  );
}
