"use client";

import { useEffect, useMemo, useState } from "react";

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

type SuggestionRow = {
  rank: number;
  recipeId: number | null;
  sourceUrl: string | null;
  sourceDomain: string;
  title: string;
  description: string;
  category: string;
  tags: string;
  isWebCandidate: boolean;
  score: number;
  reasons: string[];
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
  const [useAiMerge, setUseAiMerge] = useState(false);
  const [mergeInfo, setMergeInfo] = useState<string | null>(null);
  const [mergeInfoIsError, setMergeInfoIsError] = useState(false);
  const [profileName, setProfileName] = useState("default");
  const [dietaryRestrictions, setDietaryRestrictions] = useState("");
  const [fitnessGoal, setFitnessGoal] = useState("");
  const [preferredDomains, setPreferredDomains] = useState("");
  const [blockedDomains, setBlockedDomains] = useState("");
  const [favoriteIngredients, setFavoriteIngredients] = useState("");
  const [dislikedIngredients, setDislikedIngredients] = useState("");
  const [explorationRatio, setExplorationRatio] = useState(0.35);
  const [suggestionLimit, setSuggestionLimit] = useState(10);
  const [includeWebCandidates, setIncludeWebCandidates] = useState(true);
  const [suggestionsLoading, setSuggestionsLoading] = useState(false);
  const [suggestionsError, setSuggestionsError] = useState<string | null>(null);
  const [suggestionsInfo, setSuggestionsInfo] = useState<string | null>(null);
  const [suggestions, setSuggestions] = useState<SuggestionRow[]>([]);
  const [feedbackBusyKey, setFeedbackBusyKey] = useState<string | null>(null);
  const [feedbackByKey, setFeedbackByKey] = useState<
    Record<string, "like" | "dislike" | "skip">
  >({});
  const [plannedForDate, setPlannedForDate] = useState("");
  const [weeklyPlans, setWeeklyPlans] = useState<
    { id: number; recipeId: number; plannedFor: string; status: string; rating: number | null; recipe: { id: number; title: string } }[]
  >([]);

  const recipeById = useMemo(() => {
    const m = new Map<number, RecipeSummary>();
    for (const r of recipes) m.set(r.id, r);
    return m;
  }, [recipes]);

  useEffect(() => {
    let cancelled = false;
    async function loadProfile() {
      try {
        const res = await fetch(
          `/api/suggestions/profile?profileName=${encodeURIComponent(profileName)}`
        );
        const data = await res.json();
        if (!data.ok || !data.profile || cancelled) return;
        const p = data.profile;
        setDietaryRestrictions((p.dietaryRestrictions ?? []).join(", "));
        setFitnessGoal(p.fitnessGoal ?? "");
        setPreferredDomains((p.preferredDomains ?? []).join(", "));
        setBlockedDomains((p.blockedDomains ?? []).join(", "));
        setFavoriteIngredients((p.favoriteIngredients ?? []).join(", "));
        setDislikedIngredients((p.dislikedIngredients ?? []).join(", "));
        setExplorationRatio(
          typeof p.explorationRatio === "number" ? p.explorationRatio : 0.35
        );
      } catch {
        // ignore profile load failure in client
      }
    }
    loadProfile();
    return () => {
      cancelled = true;
    };
  }, [profileName]);

  useEffect(() => {
    fetch("/api/weekly-plan")
      .then((r) => r.json())
      .then((d) => setWeeklyPlans(d.items ?? []))
      .catch(() => undefined);
  }, []);

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

  async function handleGenerate() {
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
  }

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(clipboardText);
    } catch {
      // ignore; user can still select manually
    }
  }

  function parseCsv(text: string): string[] {
    return text
      .split(",")
      .map((x) => x.trim().toLowerCase())
      .filter(Boolean);
  }

  async function handleSaveSuggestionProfile() {
    setSuggestionsError(null);
    setSuggestionsInfo(null);
    try {
      const res = await fetch("/api/suggestions/profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          profileName,
          dietaryRestrictions: parseCsv(dietaryRestrictions),
          fitnessGoal,
          preferredDomains: parseCsv(preferredDomains),
          blockedDomains: parseCsv(blockedDomains),
          favoriteIngredients: parseCsv(favoriteIngredients),
          dislikedIngredients: parseCsv(dislikedIngredients),
          explorationRatio,
        }),
      });
      const data = await res.json();
      if (!data.ok) {
        setSuggestionsError(data.error ?? "Failed to save suggestion profile.");
        return;
      }
      setSuggestionsInfo("Preferences saved.");
    } catch {
      setSuggestionsError("Failed to save suggestion profile.");
    }
  }

  async function handleGenerateSuggestions() {
    setSuggestionsLoading(true);
    setSuggestionsError(null);
    setSuggestionsInfo(null);
    try {
      await handleSaveSuggestionProfile();
      const res = await fetch("/api/suggestions/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          profileName,
          limit: suggestionLimit,
          includeWebCandidates,
        }),
      });
      const data = await res.json();
      if (!data.ok) {
        setSuggestionsError(data.error ?? "Failed to generate suggestions.");
        setSuggestions([]);
        return;
      }
      setSuggestions(data.suggestions ?? []);
      setFeedbackByKey({});
      setSuggestionsInfo(
        `Ranked ${data.totals?.returned ?? 0} suggestions from ${data.totals?.passedFilters ?? 0} candidates.`
      );
    } catch {
      setSuggestionsError("Failed to generate suggestions.");
      setSuggestions([]);
    } finally {
      setSuggestionsLoading(false);
    }
  }

  async function sendFeedback(
    item: SuggestionRow,
    signal: "like" | "dislike" | "skip" | "add_to_plan" | "cooked"
  ) {
    const baseKey = `${item.recipeId ?? "web"}::${item.sourceUrl ?? item.title}`;
    const key = `${signal}-${baseKey}`;
    const undo =
      (signal === "like" || signal === "dislike" || signal === "skip") &&
      feedbackByKey[baseKey] === signal;
    setFeedbackBusyKey(key);
    try {
      const res = await fetch("/api/suggestions/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          recipeId: item.recipeId,
          sourceUrl: item.sourceUrl,
          sourceDomain: item.sourceDomain,
          signal,
          undo,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!data.ok) return;
      if (signal === "like" || signal === "dislike" || signal === "skip") {
        setFeedbackByKey((prev) => {
          const next = { ...prev };
          if (undo) delete next[baseKey];
          else next[baseKey] = signal;
          return next;
        });
      }
    } finally {
      setFeedbackBusyKey(null);
    }
  }

  async function addSuggestionToWeek(item: SuggestionRow) {
    if (item.recipeId != null && recipeById.has(item.recipeId)) {
      setSelectedIds((prev) =>
        prev.includes(item.recipeId as number) ? prev : [...prev, item.recipeId as number]
      );
      setSuggestionsInfo(`Added "${item.title}" to this week's plan.`);
      await sendFeedback(item, "add_to_plan");
      return;
    }
    setSuggestionsInfo(
      "This suggestion is from outside the visible recipe list. Import/save it first to add directly to the weekly plan."
    );
  }

  async function addSelectedToWeek() {
    if (!plannedForDate) {
      setSuggestionsError("Choose a date first for weekly planning.");
      return;
    }
    for (const id of selectedIds) {
      await fetch("/api/weekly-plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ recipeId: id, plannedFor: plannedForDate }),
      });
    }
    const res = await fetch("/api/weekly-plan");
    const data = await res.json().catch(() => ({ items: [] }));
    setWeeklyPlans(data.items ?? []);
    setSuggestionsInfo("Added selected recipes to weekly tracker.");
  }

  async function updateWeeklyStatus(
    id: number,
    patch: { status?: "planned" | "cooked" | "skipped"; rating?: number }
  ) {
    await fetch("/api/weekly-plan", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, ...patch }),
    });
    const res = await fetch("/api/weekly-plan");
    const data = await res.json().catch(() => ({ items: [] }));
    setWeeklyPlans(data.items ?? []);
  }

  function clearPlan() {
    setSelectedIds([]);
    setSelectedSauceUrls([]);
    setClipboardText("");
    setError(null);
    setMergeInfo(null);
    setMergeInfoIsError(false);
  }

  const hasPlan =
    selectedIds.length > 0 ||
    selectedSauceUrls.length > 0 ||
    Boolean(clipboardText);

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
          <h3 className="mb-2 text-sm font-semibold">Weekly tracker</h3>
          <div className="flex items-center gap-2">
            <input
              type="date"
              value={plannedForDate}
              onChange={(e) => setPlannedForDate(e.target.value)}
              className="rounded border border-[#d2c2af] px-2 py-1 text-xs"
            />
            <button
              type="button"
              onClick={addSelectedToWeek}
              className="rounded border border-[#d2c2af] bg-white px-2 py-1 text-xs hover:bg-[#f6efe9]"
            >
              Add selected to week
            </button>
          </div>
          {weeklyPlans.length > 0 && (
            <ul className="mt-2 space-y-1 text-xs">
              {weeklyPlans.slice(0, 8).map((w) => (
                <li key={w.id} className="rounded border border-[#e0d4c7] bg-[#fffdf8] p-2">
                  <p className="font-medium">{w.recipe.title}</p>
                  <p className="text-[#7f8c8d]">{new Date(w.plannedFor).toDateString()} · {w.status}</p>
                  <div className="mt-1 flex gap-2">
                    <button className="underline" onClick={() => updateWeeklyStatus(w.id, { status: "cooked" })}>Cooked</button>
                    <button className="underline" onClick={() => updateWeeklyStatus(w.id, { status: "skipped" })}>Skipped</button>
                    <button className="underline" onClick={() => updateWeeklyStatus(w.id, { rating: 5 })}>Rate 5</button>
                    <button className="underline" onClick={() => updateWeeklyStatus(w.id, { rating: 3 })}>Rate 3</button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="mt-4 border-t border-[#eadfce] pt-4">
          <h3 className="mb-2 text-sm font-semibold">Recipe suggestions</h3>
          <div className="space-y-2">
            <label className="block text-xs">
              <span className="mb-1 block text-[#7f8c8d]">Profile name</span>
              <input
                type="text"
                value={profileName}
                onChange={(e) => setProfileName(e.target.value)}
                className="w-full rounded border border-[#d2c2af] px-2 py-1"
              />
            </label>
            <label className="block text-xs">
              <span className="mb-1 block text-[#7f8c8d]">
                Dietary restrictions (comma-separated)
              </span>
              <input
                type="text"
                value={dietaryRestrictions}
                onChange={(e) => setDietaryRestrictions(e.target.value)}
                placeholder="vegan, gluten-free, nut-free"
                className="w-full rounded border border-[#d2c2af] px-2 py-1"
              />
            </label>
            <label className="block text-xs">
              <span className="mb-1 block text-[#7f8c8d]">Fitness goal</span>
              <input
                type="text"
                value={fitnessGoal}
                onChange={(e) => setFitnessGoal(e.target.value)}
                placeholder="high protein, low carb"
                className="w-full rounded border border-[#d2c2af] px-2 py-1"
              />
            </label>
            <label className="block text-xs">
              <span className="mb-1 block text-[#7f8c8d]">Preferred domains</span>
              <input
                type="text"
                value={preferredDomains}
                onChange={(e) => setPreferredDomains(e.target.value)}
                placeholder="smittenkitchen.com, budgetbytes.com"
                className="w-full rounded border border-[#d2c2af] px-2 py-1"
              />
            </label>
            <label className="block text-xs">
              <span className="mb-1 block text-[#7f8c8d]">Blocked domains</span>
              <input
                type="text"
                value={blockedDomains}
                onChange={(e) => setBlockedDomains(e.target.value)}
                placeholder="example.com"
                className="w-full rounded border border-[#d2c2af] px-2 py-1"
              />
            </label>
            <label className="block text-xs">
              <span className="mb-1 block text-[#7f8c8d]">Favorite ingredients</span>
              <input
                type="text"
                value={favoriteIngredients}
                onChange={(e) => setFavoriteIngredients(e.target.value)}
                placeholder="chickpeas, spinach, feta"
                className="w-full rounded border border-[#d2c2af] px-2 py-1"
              />
            </label>
            <label className="block text-xs">
              <span className="mb-1 block text-[#7f8c8d]">Disliked ingredients</span>
              <input
                type="text"
                value={dislikedIngredients}
                onChange={(e) => setDislikedIngredients(e.target.value)}
                placeholder="mushrooms, olives"
                className="w-full rounded border border-[#d2c2af] px-2 py-1"
              />
            </label>
            <div className="grid grid-cols-2 gap-2">
              <label className="text-xs">
                <span className="mb-1 block text-[#7f8c8d]">Exploration</span>
                <input
                  type="number"
                  min={0}
                  max={1}
                  step={0.05}
                  value={explorationRatio}
                  onChange={(e) => setExplorationRatio(Number(e.target.value))}
                  className="w-full rounded border border-[#d2c2af] px-2 py-1"
                />
              </label>
              <label className="text-xs">
                <span className="mb-1 block text-[#7f8c8d]">Suggestion count</span>
                <input
                  type="number"
                  min={4}
                  max={20}
                  value={suggestionLimit}
                  onChange={(e) => setSuggestionLimit(Number(e.target.value))}
                  className="w-full rounded border border-[#d2c2af] px-2 py-1"
                />
              </label>
            </div>
            <label className="flex items-center gap-2 text-xs text-[#5b3b2a]">
              <input
                type="checkbox"
                checked={includeWebCandidates}
                onChange={(e) => setIncludeWebCandidates(e.target.checked)}
              />
              Include open-web candidates
            </label>
            <button
              type="button"
              onClick={handleGenerateSuggestions}
              disabled={suggestionsLoading}
              className="w-full rounded bg-[#5b3b2a] px-3 py-1.5 text-sm font-medium text-white hover:bg-[#4b3022] disabled:opacity-60"
            >
              {suggestionsLoading ? "Ranking suggestions…" : "Suggest recipes"}
            </button>
            {suggestionsError && (
              <p className="text-xs text-[#c0392b]">{suggestionsError}</p>
            )}
            {suggestionsInfo && (
              <p className="text-xs text-[#7f8c8d]">{suggestionsInfo}</p>
            )}
            {suggestions.length > 0 && (
              <ul className="space-y-2">
                {suggestions.map((s) => (
                  <li key={`${s.recipeId ?? "web"}-${s.rank}-${s.title}`} className="rounded border border-[#eadfce] bg-[#fffdf8] p-2">
                    <p className="text-xs font-medium">
                      #{s.rank} {s.title}
                    </p>
                    <p className="text-[11px] text-[#7f8c8d]">
                      {s.sourceDomain || "unknown source"} · score {s.score.toFixed(2)}
                    </p>
                    <p className="mt-1 text-[11px] text-[#5b3b2a]">
                      {s.reasons.join(" · ")}
                    </p>
                    <div className="mt-1 flex flex-wrap gap-2 text-[11px]">
                      <button
                        type="button"
                        onClick={() => addSuggestionToWeek(s)}
                        className="underline"
                      >
                        Add to week
                      </button>
                      <button
                        type="button"
                        disabled={feedbackBusyKey === `like-${s.recipeId ?? "web"}::${s.sourceUrl ?? s.title}`}
                        aria-pressed={feedbackByKey[`${s.recipeId ?? "web"}::${s.sourceUrl ?? s.title}`] === "like"}
                        onClick={() => sendFeedback(s, "like")}
                        className={`rounded px-2 py-0.5 ${
                          feedbackByKey[`${s.recipeId ?? "web"}::${s.sourceUrl ?? s.title}`] === "like"
                            ? "bg-[#eafaf1] font-semibold text-[#1e8449]"
                            : "underline"
                        }`}
                      >
                        Like
                      </button>
                      <button
                        type="button"
                        disabled={feedbackBusyKey === `dislike-${s.recipeId ?? "web"}::${s.sourceUrl ?? s.title}`}
                        aria-pressed={feedbackByKey[`${s.recipeId ?? "web"}::${s.sourceUrl ?? s.title}`] === "dislike"}
                        onClick={() => sendFeedback(s, "dislike")}
                        className={`rounded px-2 py-0.5 ${
                          feedbackByKey[`${s.recipeId ?? "web"}::${s.sourceUrl ?? s.title}`] === "dislike"
                            ? "bg-[#fdecea] font-semibold text-[#c0392b]"
                            : "underline"
                        }`}
                      >
                        Dislike
                      </button>
                      <button
                        type="button"
                        disabled={feedbackBusyKey === `skip-${s.recipeId ?? "web"}::${s.sourceUrl ?? s.title}`}
                        aria-pressed={feedbackByKey[`${s.recipeId ?? "web"}::${s.sourceUrl ?? s.title}`] === "skip"}
                        onClick={() => sendFeedback(s, "skip")}
                        className={`rounded px-2 py-0.5 ${
                          feedbackByKey[`${s.recipeId ?? "web"}::${s.sourceUrl ?? s.title}`] === "skip"
                            ? "bg-[#eef1f2] font-semibold text-[#566573]"
                            : "underline"
                        }`}
                      >
                        Skip
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </aside>
    </div>
  );
}

