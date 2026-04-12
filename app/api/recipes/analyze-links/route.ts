import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUserFromRequest } from "@/lib/auth";
import {
  collectUrlsFromIngredientsText,
  extractSamePageWprmRecipeSiblings,
  extractSameSiteRecipeLinksFromIngredientSectionsHtml,
  normalizeUrlForMatch,
  scoreUrlAsRecipePage,
} from "@/lib/recipe-link-heuristics";

type Candidate = {
  url: string;
  score: number;
  bucket: string;
  matchedRecipe: { id: number; title: string; sourceUrl: string } | null;
  /** How to present in UI */
  hint:
    | "in_your_library"
    | "likely_recipe_page"
    | "maybe_recipe_page";
  /**
   * When this URL is a second (or later) WP Recipe Maker card on the same article
   * as `sourceUrl`, the card’s heading — show prominently so it’s not confused with
   * the main link you pasted.
   */
  embeddedCardTitle?: string;
};

function pickBestSourceUrlMatch(
  url: string,
  recipes: { id: number; title: string; sourceUrl: string }[]
) {
  const trimmed = url.trim();
  const base = normalizeUrlForMatch(url);
  const noQuery = trimmed.split("?")[0] ?? trimmed;

  const exact = recipes.find(
    (r) => r.sourceUrl === trimmed || r.sourceUrl === base
  );
  if (exact) return exact;

  const prefix = recipes.find(
    (r) =>
      r.sourceUrl.startsWith(base + "/") ||
      r.sourceUrl.startsWith(base + "?") ||
      r.sourceUrl.startsWith(noQuery)
  );
  if (prefix) return prefix;

  try {
    const u = new URL(url);
    const host = u.hostname;
    return recipes.find((r) => {
      try {
        const ru = new URL(r.sourceUrl);
        return ru.hostname === host && r.sourceUrl.includes(u.pathname);
      } catch {
        return false;
      }
    });
  } catch {
    return null;
  }
}

export async function POST(request: NextRequest) {
  const user = await getCurrentUserFromRequest(request);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  let body: {
    ingredientsText?: unknown;
    instructionsText?: unknown;
    /** Original recipe URL — fetch HTML to find same-site recipe links not in plain text */
    sourceUrl?: unknown;
    /** Exclude this recipe when matching library URLs (avoid “merge self”) */
    currentRecipeId?: unknown;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const ingredientsText =
    typeof body.ingredientsText === "string" ? body.ingredientsText : "";
  const instructionsText =
    typeof body.instructionsText === "string" ? body.instructionsText : "";

  const currentRecipeId = Number(body.currentRecipeId);
  const excludeId =
    Number.isInteger(currentRecipeId) && currentRecipeId > 0
      ? currentRecipeId
      : null;

  const combined = `${ingredientsText}\n${instructionsText}`.toLowerCase();
  const samePageMention =
    /\b(further down|below|later on this page|recipe card|jump to recipe|full recipe|see below)\b/i.test(
      combined
    );

  const textUrls = collectUrlsFromIngredientsText(ingredientsText);

  const sourceUrlStr =
    typeof body.sourceUrl === "string" ? body.sourceUrl.trim() : "";
  let pageOrigin: string | undefined;
  let htmlUrls: string[] = [];
  /** WPRM sibling URLs → card title from the fetched page */
  const wprmCardTitleByUrl = new Map<string, string>();
  let sourcePageFetched = false;

  if (sourceUrlStr.startsWith("http://") || sourceUrlStr.startsWith("https://")) {
    try {
      pageOrigin = new URL(sourceUrlStr).origin;
    } catch {
      pageOrigin = undefined;
    }
    try {
      const res = await fetch(sourceUrlStr, {
        headers: {
          "User-Agent": "RecipeboxImporter/1.0 (+https; personal use)",
          Accept:
            "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        },
        signal: AbortSignal.timeout(12_000),
      });
      if (res.ok) {
        const html = await res.text();
        const fromIngredients =
          extractSameSiteRecipeLinksFromIngredientSectionsHtml(
            html,
            sourceUrlStr
          );
        const fromWprmSiblings = extractSamePageWprmRecipeSiblings(
          html,
          sourceUrlStr
        );
        for (const s of fromWprmSiblings) {
          wprmCardTitleByUrl.set(s.url, s.title);
        }
        htmlUrls = [
          ...new Set([
            ...fromIngredients,
            ...fromWprmSiblings.map((s) => s.url),
          ]),
        ];
        sourcePageFetched = true;
      }
    } catch {
      // ignore fetch errors; fall back to text URLs only
    }
  }

  const urls = [
    ...new Set([...textUrls, ...htmlUrls]),
  ];

  const allRecipes = await prisma.recipe.findMany({
    where:
      excludeId != null
        ? { userId: user.id, id: { not: excludeId } }
        : { userId: user.id },
    select: { id: true, title: true, sourceUrl: true },
  });

  const suggested: Candidate[] = [];
  const ignoredUrls: string[] = [];

  const scoreCtx = pageOrigin ? { pageOrigin } : undefined;

  for (const url of urls) {
    const scored = scoreUrlAsRecipePage(url, scoreCtx);
    const matched = pickBestSourceUrlMatch(url, allRecipes);
    const embeddedCardTitle = wprmCardTitleByUrl.get(url);

    if (matched) {
      suggested.push({
        url,
        score: scored.score,
        bucket: scored.bucket,
        matchedRecipe: {
          id: matched.id,
          title: matched.title,
          sourceUrl: matched.sourceUrl,
        },
        hint: "in_your_library",
        ...(embeddedCardTitle != null ? { embeddedCardTitle } : {}),
      });
      continue;
    }

    if (scored.bucket === "unlikely_recipe") {
      if (ignoredUrls.length < 12) ignoredUrls.push(url);
      continue;
    }

    if (scored.bucket === "likely_recipe") {
      suggested.push({
        url,
        score: scored.score,
        bucket: scored.bucket,
        matchedRecipe: null,
        hint: "likely_recipe_page",
        ...(embeddedCardTitle != null ? { embeddedCardTitle } : {}),
      });
      continue;
    }

    // maybe_recipe: only surface if not strongly negative
    if (scored.score >= 0) {
      suggested.push({
        url,
        score: scored.score,
        bucket: scored.bucket,
        matchedRecipe: null,
        hint: "maybe_recipe_page",
        ...(embeddedCardTitle != null ? { embeddedCardTitle } : {}),
      });
    } else if (ignoredUrls.length < 12) {
      ignoredUrls.push(url);
    }
  }

  const byUrl = new Map<string, Candidate>();
  for (const c of suggested) {
    if (!byUrl.has(c.url)) byUrl.set(c.url, c);
  }

  return NextResponse.json({
    ok: true,
    candidates: Array.from(byUrl.values()),
    ignoredLinkCount: ignoredUrls.length,
    samePageMention,
    sourcePageFetched,
    linksFromSourcePage: htmlUrls.length,
  });
}
