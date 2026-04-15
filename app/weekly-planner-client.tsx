"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

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

function weekStartPreference(): "monday" | "sunday" {
  if (typeof window === "undefined") return "monday";
  const v = window.localStorage.getItem("weeklyPlanner.weekStart");
  return v === "sunday" ? "sunday" : "monday";
}

function isoDateKey(value: string): string {
  if (/^\d{4}-\d{2}-\d{2}/.test(value)) return value.slice(0, 10);
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  return d.toISOString().slice(0, 10);
}

function weekBoundsFor(date: Date, startOn: "monday" | "sunday"): {
  startKey: string;
  endKey: string;
} {
  const d = new Date(date);
  const day = d.getDay();
  const diff = startOn === "sunday" ? -day : day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  const end = new Date(d);
  end.setDate(end.getDate() + 6);
  const startKey = isoDateKey(d.toISOString());
  const endKey = isoDateKey(end.toISOString());
  return { startKey, endKey };
}

function weekPoolStorageKeyForCurrentWeek(): string {
  const pref = weekStartPreference();
  const { startKey } = weekBoundsFor(new Date(), pref);
  return `weeklyPlanner.weekPool.${pref}.${startKey}`;
}

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
  const [useAiMerge, setUseAiMerge] = useState(false);
  const [mergeInfo, setMergeInfo] = useState<string | null>(null);
  const [mergeInfoIsError, setMergeInfoIsError] = useState(false);
  const [suggestionsInfo, setSuggestionsInfo] = useState<string | null>(null);
  const [savedWeekRecipeIds, setSavedWeekRecipeIds] = useState<number[]>([]);
  const [weeklyPlans, setWeeklyPlans] = useState<
    { id: number; recipeId: number; plannedFor: string; status: string; rating: number | null; recipe: { id: number; title: string } }[]
  >([]);

  useEffect(() => {
    fetch("/api/weekly-plan")
      .then((r) => r.json())
      .then((d) => setWeeklyPlans(d.items ?? []))
      .catch(() => undefined);
  }, []);

  async function refreshWeeklyPlans() {
    const res = await fetch("/api/weekly-plan");
    const data = await res.json().catch(() => ({ items: [] }));
    setWeeklyPlans(data.items ?? []);
  }

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
    setMergeInfo(null);
    setMergeInfoIsError(false);
    setError(null);
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  }

  function toggleSauceUrl(url: string) {
    setClipboardText("");
    setMergeInfo(null);
    setMergeInfoIsError(false);
    setError(null);
    setSelectedSauceUrls((prev) =>
      prev.includes(url) ? prev.filter((u) => u !== url) : [...prev, url]
    );
  }

  const handleGenerate = useCallback(async () => {
    if (!selectedIds.length) {
      setError("Select at least one recipe to build a shopping list.");
      return;
    }
    setLoading(true);
    setError(null);
    setMergeInfo(null);
    setMergeInfoIsError(false);
    try {
      const res = await fetch("/api/shopping-list", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          recipeIds: selectedIds,
          sauceUrls: selectedSauceUrls,
          useAiMerge,
        }),
      });
      const data = await res.json();
      if (!data.ok) {
        setError(data.error ?? "Failed to build shopping list.");
        setClipboardText("");
        return;
      }
      setClipboardText(data.clipboardText ?? "");
      if (useAiMerge) {
        if (data.aiMergeApplied) {
          setMergeInfo("AI merge applied on top of the standard list.");
          setMergeInfoIsError(false);
        } else if (data.aiMergeError) {
          setMergeInfo(data.aiMergeError);
          setMergeInfoIsError(true);
        } else {
          setMergeInfo(
            "AI merge did not run. Add GEMINI_API_KEY (or OPENAI_API_KEY) to .env and restart the dev server."
          );
          setMergeInfoIsError(true);
        }
      } else {
        setMergeInfo(null);
        setMergeInfoIsError(false);
      }
    } catch {
      setError("Failed to build shopping list.");
      setClipboardText("");
    } finally {
      setLoading(false);
    }
  }, [selectedIds, selectedSauceUrls, useAiMerge]);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(clipboardText);
    } catch {
      // ignore; user can still select manually
    }
  }

  async function addSelectedToWeek() {
    if (!selectedIds.length) {
      setSuggestionsError("Select at least one recipe first.");
      return;
    }
    if (typeof window !== "undefined") {
      const unique = Array.from(new Set(selectedIds));
      window.localStorage.setItem(
        weekPoolStorageKeyForCurrentWeek(),
        JSON.stringify(unique)
      );
      setSavedWeekRecipeIds(unique);
    }
    setSuggestionsInfo("Saved selected recipes to this week's list. Assign days in the weekly calendar.");
  }

  async function removeWeeklyItem(id: number) {
    await fetch("/api/weekly-plan", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    await refreshWeeklyPlans();
  }

  function clearPlan() {
    const pref = weekStartPreference();
    const { startKey, endKey } = weekBoundsFor(new Date(), pref);
    const ok = window.confirm(
      `Clear all recipes planned for this week (${startKey} to ${endKey})? This cannot be undone.`
    );
    if (!ok) return;
    void (async () => {
      await fetch("/api/weekly-plan", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ start: startKey, end: endKey }),
      });
      if (typeof window !== "undefined") {
        window.localStorage.removeItem(weekPoolStorageKeyForCurrentWeek());
      }
      setSavedWeekRecipeIds([]);
      await refreshWeeklyPlans();
      setSelectedIds([]);
      setSelectedSauceUrls([]);
      setClipboardText("");
      setError(null);
      setMergeInfo(null);
      setMergeInfoIsError(false);
    })();
  }

  const hasPlan =
    selectedIds.length > 0 ||
    selectedSauceUrls.length > 0 ||
    Boolean(clipboardText);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const key = weekPoolStorageKeyForCurrentWeek();
    const raw = window.localStorage.getItem(key);
    if (!raw) return;
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        const ids = parsed
          .map((v) => Number(v))
          .filter((v) => Number.isInteger(v) && v > 0);
        if (ids.length) {
          const unique = Array.from(new Set(ids));
          setSelectedIds(unique);
          setSavedWeekRecipeIds(unique);
        }
      }
    } catch {
      // ignore invalid local storage values
    }
  }, [weeklyPlans]);

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
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-sm font-semibold">This week&apos;s plan</h3>
          {hasPlan && (
            <button
              type="button"
              onClick={clearPlan}
              className="text-xs text-[#7f8c8d] underline hover:text-[#5b3b2a]"
            >
              Clear plan
            </button>
          )}
        </div>
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

        <label className="mb-3 flex cursor-pointer items-start gap-2 text-xs text-[#5b3b2a]">
          <input
            type="checkbox"
            className="mt-0.5"
            checked={useAiMerge}
            onChange={(e) => {
              setUseAiMerge(e.target.checked);
              setMergeInfo(null);
              setMergeInfoIsError(false);
            }}
          />
          <span>
            Smarter merge (AI) — extra pass to combine similar lines. Set{" "}
            <code className="text-[11px]">GEMINI_API_KEY</code> (or OpenAI) on the
            server.
          </span>
        </label>

        {mergeInfo && (
          <p
            className={`mb-2 text-xs ${mergeInfoIsError ? "text-[#c0392b]" : "text-[#7f8c8d]"}`}
          >
            {mergeInfo}
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
            <div className="flex flex-wrap items-center justify-between gap-2">
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

        <div className="mt-4 border-t border-[#eadfce] pt-4">
          <div className="mb-2 flex items-center justify-between gap-2">
            <h3 className="text-sm font-semibold">Weekly tracker</h3>
            <a href="/weekly" className="text-xs underline text-[#5b3b2a]">
              Open full weekly calendar
            </a>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={addSelectedToWeek}
              className="rounded border border-[#d2c2af] bg-white px-2 py-1 text-xs hover:bg-[#f6efe9]"
            >
              Save selected for this week
            </button>
          </div>
          {suggestionsInfo && (
            <p className="mt-2 text-xs text-[#7f8c8d]">{suggestionsInfo}</p>
          )}
          {savedWeekRecipeIds.length > 0 && (
            <ul className="mt-2 list-inside list-disc text-xs text-[#5b3b2a]">
              {recipes
                .filter((r) => savedWeekRecipeIds.includes(r.id))
                .map((r) => (
                  <li key={`saved-${r.id}`}>{r.title}</li>
                ))}
            </ul>
          )}
          {weeklyPlans.length > 0 && (
            <ul className="mt-2 space-y-1 text-xs">
              {weeklyPlans.slice(0, 8).map((w) => (
                <li key={w.id} className="rounded border border-[#e0d4c7] bg-[#fffdf8] p-2">
                  <p className="font-medium">{w.recipe.title}</p>
                  <p className="text-[#7f8c8d]">{new Date(w.plannedFor).toDateString()} · {w.status}</p>
                  <div className="mt-1 flex gap-2">
                    <button className="underline" onClick={() => removeWeeklyItem(w.id)}>Remove</button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

      </aside>
    </div>
  );
}

