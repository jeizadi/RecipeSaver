"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type Candidate = {
  url: string;
  score: number;
  bucket: string;
  hint: "in_your_library" | "likely_recipe_page" | "maybe_recipe_page";
  matchedRecipe: { id: number; title: string; sourceUrl: string } | null;
};

type Props = {
  parentRecipeId?: number;
  /** Recipe source URL — used to fetch the page and find same-site links in the ingredient list HTML */
  sourceUrl?: string;
  /** Increment after a successful import to run one automatic scan */
  autoScanNonce?: number;
  ingredientsText: string;
  instructionsText: string;
  onMergeFromLibrary?: (
    childRecipeId: number,
    mergedTitle: string
  ) => Promise<void> | void;
};

function hintLabel(c: Candidate): string {
  if (c.hint === "in_your_library") {
    return `In your library: “${c.matchedRecipe?.title ?? "recipe"}”`;
  }
  if (c.hint === "likely_recipe_page") {
    return "Looks like a recipe page (URL pattern)";
  }
  return "Might be a recipe — confirm by opening the link";
}

export function LinkedRecipeHints({
  parentRecipeId,
  sourceUrl = "",
  autoScanNonce = 0,
  ingredientsText,
  instructionsText,
  onMergeFromLibrary,
}: Props) {
  const [candidates, setCandidates] = useState<Candidate[] | null>(null);
  const [samePageMention, setSamePageMention] = useState(false);
  const [ignoredCount, setIgnoredCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mergingId, setMergingId] = useState<number | null>(null);

  const scan = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/recipes/analyze-links", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ingredientsText,
          instructionsText,
          ...(sourceUrl.trim().startsWith("http://") ||
          sourceUrl.trim().startsWith("https://")
            ? { sourceUrl: sourceUrl.trim() }
            : {}),
          ...(parentRecipeId != null
            ? { currentRecipeId: parentRecipeId }
            : {}),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!data.ok) {
        setError(data.error ?? "Scan failed.");
        setCandidates(null);
        return;
      }
      setCandidates(data.candidates ?? []);
      setSamePageMention(Boolean(data.samePageMention));
      setIgnoredCount(Number(data.ignoredLinkCount) || 0);
    } catch {
      setError("Scan failed.");
      setCandidates(null);
    } finally {
      setLoading(false);
    }
  }, [ingredientsText, instructionsText, parentRecipeId, sourceUrl]);

  const scanRef = useRef(scan);
  scanRef.current = scan;

  useEffect(() => {
    if (autoScanNonce <= 0) return;
    void scanRef.current();
  }, [autoScanNonce]);

  const hasUrlInIngredients = ingredientsText.includes("http");
  const hasSourcePage =
    sourceUrl.trim().startsWith("http://") ||
    sourceUrl.trim().startsWith("https://");

  return (
    <div className="rounded border border-[#d2c4b8] bg-[#faf6f2] p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-[#5b3b2a]">
          Optional add-ons (linked recipes)
        </h3>
        <button
          type="button"
          onClick={() => void scan()}
          disabled={loading}
          className="rounded border border-[#d2c2af] bg-white px-3 py-1 text-xs font-medium hover:bg-[#f6efe9] disabled:opacity-60"
        >
          {loading ? "Scanning…" : "Scan ingredients for links"}
        </button>
      </div>
      <p className="mt-1 text-xs text-[#7f8c8d]">
        We only look at the <strong>ingredients</strong> list: pasted URLs in
        that field, plus recipe links inside the ingredient list on the source
        page (when you have a source URL). Instructions and “related recipe”
        sections are ignored.
      </p>

      {error && (
        <p className="mt-2 text-xs text-[#c0392b]">{error}</p>
      )}

      {samePageMention && (
        <p className="mt-3 rounded bg-white/80 px-2 py-1.5 text-xs text-[#5b3b2a]">
          This text may refer to another recipe <strong>on the same webpage</strong>{" "}
          (e.g. “recipe card below”). Check the source site — if it’s a second
          recipe, save it separately, then use <strong>Merge</strong> here.
        </p>
      )}

      {!hasUrlInIngredients && !hasSourcePage && !candidates && (
        <p className="mt-2 text-xs text-[#7f8c8d]">
          Add a source URL (and import or paste ingredients), then scan. We read
          the ingredient list on that page for linked sub-recipes (e.g. sauce).
        </p>
      )}

      {!hasUrlInIngredients && hasSourcePage && !candidates && (
        <p className="mt-2 text-xs text-[#7f8c8d]">
          No URLs in the ingredients field yet — click Scan to check the
          ingredient list on the source page for links.
        </p>
      )}

      {candidates && candidates.length === 0 && !samePageMention && (
        <p className="mt-2 text-xs text-[#7f8c8d]">
          No recipe-like links detected.
          {ignoredCount > 0
            ? ` (${ignoredCount} link(s) skipped as unlikely to be recipes.)`
            : ""}
        </p>
      )}

      {candidates && candidates.length > 0 && (
        <ul className="mt-3 space-y-2 text-sm">
          {candidates.map((c) => (
            <li
              key={c.url}
              className="rounded border border-[#e0d4c7] bg-white p-2"
            >
              <p className="text-xs font-medium text-[#5b3b2a]">
                {hintLabel(c)}
              </p>
              <a
                href={c.url}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-0.5 block truncate text-xs text-[#e67e22] hover:underline"
              >
                {c.url}
              </a>
              {c.hint === "in_your_library" &&
                c.matchedRecipe &&
                parentRecipeId != null &&
                onMergeFromLibrary && (
                  <button
                    type="button"
                    disabled={mergingId === c.matchedRecipe.id}
                    onClick={async () => {
                      setMergingId(c.matchedRecipe!.id);
                      try {
                        await onMergeFromLibrary(
                          c.matchedRecipe!.id,
                          c.matchedRecipe!.title
                        );
                      } finally {
                        setMergingId(null);
                      }
                    }}
                    className="mt-2 rounded bg-[#e67e22] px-2 py-1 text-xs font-medium text-white hover:bg-[#cf711f] disabled:opacity-60"
                  >
                    {mergingId === c.matchedRecipe.id
                      ? "Merging…"
                      : "Merge into this recipe"}
                  </button>
                )}
              {c.hint === "in_your_library" &&
                c.matchedRecipe &&
                parentRecipeId == null && (
                  <p className="mt-2 text-xs text-[#7f8c8d]">
                    Save this recipe first, then edit it to merge “
                    {c.matchedRecipe.title}”.
                  </p>
                )}
              {c.hint !== "in_your_library" && (
                <p className="mt-1 text-xs text-[#7f8c8d]">
                  Open the link to confirm it’s a full recipe. If you saved it
                  already, re-scan after updating <code className="text-[11px]">source URL</code>{" "}
                  to match.
                </p>
              )}
            </li>
          ))}
        </ul>
      )}

      {candidates && candidates.length > 0 && ignoredCount > 0 && (
        <p className="mt-2 text-[11px] text-[#7f8c8d]">
          {ignoredCount} other link(s) hidden (treated as products / non-recipes).
        </p>
      )}
    </div>
  );
}
