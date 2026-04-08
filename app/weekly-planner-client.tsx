"use client";

import { useMemo, useState } from "react";

type RecipeSummary = {
  id: number;
  title: string;
  category: string;
  tags: string;
  description: string;
  ingredientsText: string;
};

type Props = {
  recipes: RecipeSummary[];
};

function findSauceLinks(recipes: RecipeSummary[]) {
  const urlRegex = /(https?:\/\/\S+)/g;
  const byRecipe: Record<
    number,
    { url: string; line: string }[]
  > = {};

  for (const recipe of recipes) {
    const lines = recipe.ingredientsText.split(/\r?\n/);
    for (const raw of lines) {
      const line = raw.trim();
      if (!line) continue;
      let match: RegExpExecArray | null;
      while ((match = urlRegex.exec(line)) !== null) {
        const url = match[1];
        if (!byRecipe[recipe.id]) byRecipe[recipe.id] = [];
        byRecipe[recipe.id].push({ url, line });
      }
    }
  }

  return byRecipe;
}

export function WeeklyPlannerClient({ recipes }: Props) {
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [selectedSauceUrls, setSelectedSauceUrls] = useState<string[]>([]);
  const [clipboardText, setClipboardText] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const sauceLinksByRecipe = useMemo(
    () => findSauceLinks(recipes),
    [recipes]
  );

  const selectedRecipes = useMemo(
    () => recipes.filter((r) => selectedIds.includes(r.id)),
    [recipes, selectedIds]
  );

  const allSauceLinks = useMemo(() => {
    const links: { url: string; line: string }[] = [];
    for (const r of selectedRecipes) {
      const forRecipe = sauceLinksByRecipe[r.id] ?? [];
      for (const link of forRecipe) {
        if (!links.find((l) => l.url === link.url)) {
          links.push(link);
        }
      }
    }
    return links;
  }, [selectedRecipes, sauceLinksByRecipe]);

  function toggleRecipe(id: number) {
    setClipboardText("");
    setError(null);
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  }

  function toggleSauceUrl(url: string) {
    setClipboardText("");
    setError(null);
    setSelectedSauceUrls((prev) =>
      prev.includes(url) ? prev.filter((u) => u !== url) : [...prev, url]
    );
  }

  async function handleGenerate() {
    if (!selectedIds.length) {
      setError("Select at least one recipe to build a shopping list.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/shopping-list", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          recipeIds: selectedIds,
          sauceUrls: selectedSauceUrls,
        }),
      });
      const data = await res.json();
      if (!data.ok) {
        setError(data.error ?? "Failed to build shopping list.");
        setClipboardText("");
        return;
      }
      setClipboardText(data.clipboardText ?? "");
    } catch {
      setError("Failed to build shopping list.");
      setClipboardText("");
    } finally {
      setLoading(false);
    }
  }

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(clipboardText);
    } catch {
      // ignore; user can still select manually
    }
  }

  return (
    <div className="flex flex-col gap-6 lg:flex-row">
      <div className="flex-1">
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-2">
          {recipes.map((r) => (
            <li
              key={r.id}
              className="rounded-lg bg-white p-4 shadow-sm transition hover:shadow"
            >
              <div className="flex items-start justify-between gap-2">
                <h3 className="font-semibold">
                  <a
                    href={`/recipes/${r.id}`}
                    className="text-[#5b3b2a] hover:underline"
                  >
                    {r.title}
                  </a>
                </h3>
                <label className="flex items-center gap-1 text-xs">
                  <input
                    type="checkbox"
                    checked={selectedIds.includes(r.id)}
                    onChange={() => toggleRecipe(r.id)}
                  />
                  <span>Plan</span>
                </label>
              </div>
              <p className="mt-1 flex flex-wrap items-center gap-2 text-sm text-[#7f8c8d]">
                <span className="rounded-full bg-[#fdebd0] px-2 py-0.5 text-xs">
                  {r.category}
                </span>
                {r.tags && <span>{r.tags}</span>}
              </p>
              {r.description && (
                <p className="mt-2 line-clamp-2 text-sm text-zinc-600">
                  {r.description}
                </p>
              )}
            </li>
          ))}
        </ul>
      </div>

      <aside className="w-full max-w-md rounded-lg bg-white p-4 shadow-sm lg:w-80">
        <h3 className="mb-2 text-sm font-semibold">This week&apos;s plan</h3>
        {selectedRecipes.length ? (
          <ul className="mb-3 list-disc list-inside text-sm">
            {selectedRecipes.map((r) => (
              <li key={r.id}>{r.title}</li>
            ))}
          </ul>
        ) : (
          <p className="mb-3 text-sm text-[#7f8c8d]">
            Select recipes using the &quot;Plan&quot; checkbox.
          </p>
        )}

        {allSauceLinks.length > 0 && (
          <div className="mb-3 rounded border border-[#e0d4c7] bg-[#fffdf8] p-2">
            <p className="mb-1 text-xs font-medium">
              Linked sauces / sub-recipes
            </p>
            <ul className="space-y-1 text-xs">
              {allSauceLinks.map((link) => (
                <li key={link.url} className="flex flex-col gap-0.5">
                  <label className="flex items-center gap-1">
                    <input
                      type="checkbox"
                      checked={selectedSauceUrls.includes(link.url)}
                      onChange={() => toggleSauceUrl(link.url)}
                    />
                    <span>Include ingredients</span>
                  </label>
                  <a
                    href={link.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="truncate text-[11px] text-[#e67e22] hover:underline"
                  >
                    {link.url}
                  </a>
                  <p className="text-[11px] text-[#7f8c8d]">{link.line}</p>
                </li>
              ))}
            </ul>
          </div>
        )}

        {error && (
          <p className="mb-2 text-xs text-[#c0392b]">
            {error}
          </p>
        )}

        <button
          type="button"
          onClick={handleGenerate}
          disabled={loading || !selectedIds.length}
          className="mb-3 w-full rounded bg-[#e67e22] px-3 py-1.5 text-sm font-medium text-white hover:bg-[#cf711f] disabled:opacity-60"
        >
          {loading ? "Building list…" : "Generate shopping list"}
        </button>

        {clipboardText && (
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium">
                Shopping list (copy to Keep)
              </span>
              <button
                type="button"
                onClick={handleCopy}
                className="text-xs text-[#5b3b2a] underline"
              >
                Copy
              </button>
            </div>
            <textarea
              value={clipboardText}
              readOnly
              rows={8}
              className="w-full rounded border border-[#d2c2af] bg-[#fffdf8] p-2 text-xs font-mono"
            />
          </div>
        )}
      </aside>
    </div>
  );
}

