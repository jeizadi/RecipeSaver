"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type Candidate = {
  url: string;
  score: number;
  bucket: string;
  hint: "in_your_library" | "likely_recipe_page" | "maybe_recipe_page";
  matchedRecipe: { id: number; title: string; sourceUrl: string } | null;
  /** Second+ WP Recipe Maker card title on the same URL as your source */
  embeddedCardTitle?: string;
};

/** Result of merge actions used to show “included” + undo per row. */
export type LinkedAddonMergeResult =
  | { ok: true; mergedTitle: string }
  | { ok: false; error?: string; cancelled?: boolean };

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
  ) => Promise<LinkedAddonMergeResult> | LinkedAddonMergeResult;
  /** Import a recipe from a URL and append it (works before Save / without a recipe id) */
  onMergeFromUrl?: (
    url: string
  ) => Promise<LinkedAddonMergeResult> | LinkedAddonMergeResult;
  /** Strip the last merged block for this title from ingredients + instructions */
  onUndoMergedSection?: (mergedTitle: string) => void;
};

function hintLabel(c: Candidate): string {
  if (c.hint === "in_your_library") {
    return `In your library: “${c.matchedRecipe?.title ?? "recipe"}”`;
  }
  if (c.embeddedCardTitle) {
    return "We can import this block from the same page — it is not the same as only re-importing your main link.";
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
  onMergeFromUrl,
  onUndoMergedSection,
}: Props) {
  const [candidates, setCandidates] = useState<Candidate[] | null>(null);
  const [samePageMention, setSamePageMention] = useState(false);
  const [ignoredCount, setIgnoredCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mergingId, setMergingId] = useState<number | null>(null);
  const [mergingUrl, setMergingUrl] = useState<string | null>(null);
  /** Row key (candidate `url`) → merged section title for undo */
  const [includedRows, setIncludedRows] = useState<
    Record<string, { mergedTitle: string }>
  >({});

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
        We scan pasted URLs in the <strong>ingredients</strong> field, recipe
        links inside the ingredient list on the source page, and{" "}
        <strong>extra recipe cards</strong> some blogs embed on the same article
        (same base URL as your source — we label those by card name, not only by
        link). Broader “related posts” sections are still ignored.
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
        <>
          {candidates.some((c) => c.embeddedCardTitle) && (
            <div className="mt-3 rounded border border-[#e8d4a8] bg-[#fff9ed] px-3 py-2 text-xs text-[#5b3b2a]">
              <strong className="font-semibold">Same link, more recipes:</strong>{" "}
              Some posts include several recipe cards on one URL. The names below
              are separate blocks you can merge — easy to overlook if you only
              glance at the URL.
            </div>
          )}
          <ul
            className={`space-y-2 text-sm ${
              candidates.some((c) => c.embeddedCardTitle) ? "mt-2" : "mt-3"
            }`}
          >
          {candidates.map((c) => {
            const mergeUrl = c.matchedRecipe?.sourceUrl ?? c.url;
            const rowKey = c.url;
            const included = includedRows[rowKey] != null;
            const includedTitle = includedRows[rowKey]?.mergedTitle;
            const showLibraryMerge =
              c.hint === "in_your_library" &&
              c.matchedRecipe != null &&
              parentRecipeId != null &&
              onMergeFromLibrary != null;
            const showUrlMerge = onMergeFromUrl != null && !showLibraryMerge;
            const urlBusy = mergingUrl === mergeUrl;
            const cardName = c.embeddedCardTitle;

            return (
              <li
                key={c.url}
                className={`rounded border p-2 transition-colors duration-200 ${
                  included
                    ? "border-[#c5dcc0] bg-[#f4faf3]"
                    : "border-[#e0d4c7] bg-white"
                }`}
              >
                <div
                  className={`transition-opacity duration-200 ${
                    included ? "opacity-45" : "opacity-100"
                  }`}
                >
                  {cardName ? (
                    <div className="mb-1.5">
                      <p className="text-sm font-semibold leading-snug text-[#5b3b2a]">
                        {cardName}
                      </p>
                      <p className="mt-0.5 text-[10px] font-semibold uppercase tracking-wide text-[#a67c52]">
                        Same article · extra recipe card
                      </p>
                    </div>
                  ) : null}
                  <p className="text-xs font-medium text-[#5b3b2a]">
                    {hintLabel(c)}
                  </p>
                  <a
                    href={c.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-0.5 block truncate text-xs text-[#e67e22] hover:underline"
                    title={c.url}
                  >
                    {cardName ? `Technical link (same page): ${c.url}` : c.url}
                  </a>
                </div>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  {showLibraryMerge && !included && (
                    <button
                      type="button"
                      disabled={
                        mergingId === c.matchedRecipe!.id || mergingUrl != null
                      }
                      onClick={async () => {
                        setMergingId(c.matchedRecipe!.id);
                        try {
                          const r = await onMergeFromLibrary!(
                            c.matchedRecipe!.id,
                            c.matchedRecipe!.title
                          );
                          if (
                            r &&
                            typeof r === "object" &&
                            r.ok &&
                            onUndoMergedSection
                          ) {
                            setIncludedRows((p) => ({
                              ...p,
                              [rowKey]: { mergedTitle: r.mergedTitle },
                            }));
                          }
                        } finally {
                          setMergingId(null);
                        }
                      }}
                      className="rounded bg-[#e67e22] px-2 py-1 text-xs font-medium text-white hover:bg-[#cf711f] disabled:opacity-60"
                    >
                      {mergingId === c.matchedRecipe!.id
                        ? "Merging…"
                        : "Merge from library"}
                    </button>
                  )}
                  {showUrlMerge && !included && (
                    <button
                      type="button"
                      disabled={urlBusy || mergingId != null}
                      onClick={async () => {
                        setMergingUrl(mergeUrl);
                        try {
                          const r = await onMergeFromUrl!(mergeUrl);
                          if (
                            r &&
                            typeof r === "object" &&
                            r.ok &&
                            onUndoMergedSection
                          ) {
                            setIncludedRows((p) => ({
                              ...p,
                              [rowKey]: { mergedTitle: r.mergedTitle },
                            }));
                          }
                        } finally {
                          setMergingUrl(null);
                        }
                      }}
                      className="rounded bg-[#e67e22] px-2 py-1 text-xs font-medium text-white hover:bg-[#cf711f] disabled:opacity-60"
                    >
                      {urlBusy
                        ? "Importing…"
                        : cardName
                          ? `Add “${cardName}” to this recipe`
                          : "Merge into this recipe"}
                    </button>
                  )}
                  {included && includedTitle && onUndoMergedSection && (
                    <>
                      <span className="text-xs font-medium text-[#1e8449]">
                        Included in this draft
                      </span>
                      <button
                        type="button"
                        className="rounded border border-[#7dcea0] bg-white px-2 py-1 text-xs font-medium text-[#1e8449] hover:bg-[#eafaf1]"
                        aria-label={`Undo merge of ${includedTitle}`}
                        onClick={() => {
                          onUndoMergedSection(includedTitle);
                          setIncludedRows((p) => {
                            const n = { ...p };
                            delete n[rowKey];
                            return n;
                          });
                        }}
                      >
                        Undo
                      </button>
                    </>
                  )}
                </div>
                {showUrlMerge && !included && (
                  <p className="mt-1 text-xs text-[#7f8c8d]">
                    {cardName
                      ? "Pulls that card’s ingredients and instructions from the page and appends them below yours. Save when you’re done."
                      : "Fetches that page and appends its ingredients and instructions below yours. Save when you’re done."}
                  </p>
                )}
                {included && (showUrlMerge || showLibraryMerge) && (
                  <p className="mt-1 text-xs text-[#7f8c8d]">
                    Undo removes that add-on from the ingredients and instructions
                    fields (nothing is saved until you click Save).
                  </p>
                )}
                {c.hint === "in_your_library" &&
                  !showLibraryMerge &&
                  !showUrlMerge && (
                    <p className="mt-2 text-xs text-[#7f8c8d]">
                      Save this recipe first, then edit it to merge “
                      {c.matchedRecipe!.title}”.
                    </p>
                  )}
                {c.hint !== "in_your_library" && !showUrlMerge && (
                  <p className="mt-1 text-xs text-[#7f8c8d]">
                    Open the link to confirm it’s a full recipe.
                  </p>
                )}
              </li>
            );
          })}
          </ul>
        </>
      )}

      {candidates && candidates.length > 0 && ignoredCount > 0 && (
        <p className="mt-2 text-[11px] text-[#7f8c8d]">
          {ignoredCount} other link(s) hidden (treated as products / non-recipes).
        </p>
      )}
    </div>
  );
}
