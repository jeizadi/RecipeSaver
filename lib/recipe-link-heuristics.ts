import * as cheerio from "cheerio";

/**
 * Detect URLs in recipe text and score how likely they are to be a *recipe page*
 * (vs affiliate product links, generic blog pages, etc.).
 */

const NON_RECIPE_HOST_SUBSTRINGS = [
  "amazon.",
  "amzn.to",
  "amzn.com",
  "walmart.",
  "target.com",
  "ebay.",
  "etsy.com",
  "homedepot.",
  "lowes.",
  "wayfair.",
  "instacart.",
];

const NON_RECIPE_PATH_SUBSTRINGS = [
  "/dp/",
  "/gp/product",
  "/product/",
  "/products/",
  "/shop/",
  "/cart",
  "/checkout",
  "/wishlist",
];

/** Positive signals common on food blogs / recipe sites */
const RECIPE_PATH_SUBSTRINGS = [
  "/recipe/",
  "/recipes/",
  "/recipe-",
  "-recipe/",
  "recipe-index",
  "easyrecipe-print",
];

/** Paths that are almost never a single recipe post */
const SAME_SITE_SKIP_PATH_PREFIXES = [
  "/category/",
  "/tag/",
  "/author/",
  "/page/",
  "/wp-",
  "/feed",
  "/search",
  "/cart",
  "/checkout",
  "/shop",
  "/subscribe",
  "/contact",
  "/about",
  "/privacy",
  "/comment",
  "/login",
  "/register",
  "/saved",
  "/videos",
  "/newsletter",
  "/accessibility",
  "/policy",
  "/cookies",
];

export function extractUrlsFromText(text: string): string[] {
  if (!text) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  const re = /https?:\/\/[^\s\]<>"')]+/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    const raw = m[0].replace(/[.,;:!?)]+$/, "");
    try {
      const u = new URL(raw);
      u.hash = "";
      const normalized = u.toString();
      if (!seen.has(normalized)) {
        seen.add(normalized);
        out.push(normalized);
      }
    } catch {
      // ignore invalid
    }
  }
  return out;
}

export function normalizeUrlForMatch(url: string): string {
  try {
    const orig = new URL(url);
    const frag = orig.hash;
    const u = new URL(url);
    u.hash = "";
    u.search = "";
    const base = u.toString().replace(/\/+$/, "");
    if (/^#wprm-recipe-container-\d+$/i.test(frag)) {
      return `${base}${frag}`;
    }
    return base;
  } catch {
    return url.trim();
  }
}

export type UrlRecipeLikelihood = {
  url: string;
  score: number;
  /** short machine-readable bucket */
  bucket: "likely_recipe" | "maybe_recipe" | "unlikely_recipe";
  reasons: string[];
};

export type ScoreContext = {
  /** If set, links on the same origin (e.g. sibling blog posts) get a boost */
  pageOrigin?: string;
};

/**
 * Higher score => more likely a recipe page. Not perfect; user should confirm.
 */
export function scoreUrlAsRecipePage(
  url: string,
  ctx?: ScoreContext
): UrlRecipeLikelihood {
  const reasons: string[] = [];
  let score = 0;

  let hostname = "";
  let pathname = "";
  try {
    const u = new URL(url);
    hostname = u.hostname.toLowerCase();
    pathname = u.pathname.toLowerCase();
  } catch {
    return {
      url,
      score: -100,
      bucket: "unlikely_recipe",
      reasons: ["invalid URL"],
    };
  }

  for (const h of NON_RECIPE_HOST_SUBSTRINGS) {
    if (hostname.includes(h)) {
      score -= 8;
      reasons.push(`host looks like storefront: ${h}`);
      break;
    }
  }

  if (/\btag=[^&]+/i.test(url) && hostname.includes("amazon")) {
    score -= 4;
    reasons.push("affiliate-style query");
  }

  for (const p of NON_RECIPE_PATH_SUBSTRINGS) {
    if (pathname.includes(p)) {
      score -= 5;
      reasons.push(`path looks like product/shop: ${p}`);
      break;
    }
  }

  for (const p of RECIPE_PATH_SUBSTRINGS) {
    if (pathname.includes(p) || url.toLowerCase().includes(p)) {
      score += 4;
      reasons.push(`path suggests recipe content: ${p}`);
      break;
    }
  }

  // WordPress-style slug: /red-enchilada-sauce/ (no "/recipe/" in path)
  const segments = pathname.split("/").filter(Boolean);
  if (segments.length === 1) {
    const slug = segments[0] ?? "";
    if (slug.length >= 8 && /[a-z]-[a-z]/.test(slug) && !slug.includes(".")) {
      score += 2;
      reasons.push("single slug path (typical blog post)");
    }
  }

  if (ctx?.pageOrigin) {
    try {
      const page = new URL(ctx.pageOrigin);
      const u = new URL(url);
      if (page.origin === u.origin) {
        score += 3;
        reasons.push("same site as source recipe page");
      }
    } catch {
      // ignore
    }
  }

  try {
    const h = new URL(url).hash;
    if (/^#wprm-recipe-container-\d+$/i.test(h)) {
      score += 5;
      reasons.push("WP Recipe Maker card anchor on same page");
    }
  } catch {
    // ignore
  }

  // Longish path on a blog often = article/recipe (weak signal)
  if (segments.length >= 2 && score > -5) {
    score += 1;
    reasons.push("multi-segment path (weak)");
  }

  let bucket: UrlRecipeLikelihood["bucket"] = "maybe_recipe";
  if (score >= 3) bucket = "likely_recipe";
  else if (score <= -2) bucket = "unlikely_recipe";

  return { url, score, bucket, reasons };
}

export function collectUrlsFromRecipeFields(
  ingredientsText: string,
  instructionsText: string
): string[] {
  const all = [
    ...extractUrlsFromText(ingredientsText),
    ...extractUrlsFromText(instructionsText),
  ];
  const seen = new Set<string>();
  return all.filter((u) => {
    if (seen.has(u)) return false;
    seen.add(u);
    return true;
  });
}

/** URLs pasted literally in the ingredients field only (not instructions). */
export function collectUrlsFromIngredientsText(ingredientsText: string): string[] {
  return extractUrlsFromText(ingredientsText);
}

function tryAddSameSiteRecipeUrl(
  hrefRaw: string | undefined,
  pageUrl: string,
  pageHostLower: string,
  basePathNorm: string,
  out: Set<string>
): void {
  if (!hrefRaw) return;
  const t = hrefRaw.trim();
  const lower = t.toLowerCase();
  if (
    lower.startsWith("#") ||
    lower.startsWith("javascript:") ||
    lower.startsWith("mailto:")
  ) {
    return;
  }
  let abs: URL;
  try {
    abs = new URL(t, pageUrl);
  } catch {
    return;
  }
  if (abs.protocol !== "http:" && abs.protocol !== "https:") return;
  if (abs.hostname.toLowerCase() !== pageHostLower) return;

  abs.hash = "";
  const path = abs.pathname.toLowerCase();
  for (const p of SAME_SITE_SKIP_PATH_PREFIXES) {
    if (path.startsWith(p)) return;
  }
  if (path.includes("/print/") || path.includes("/feed/")) return;
  if (/\.(jpe?g|png|gif|webp|svg)(\?|$)/i.test(path)) return;

  const normPath = path.replace(/\/$/, "") || "/";
  if (normPath === basePathNorm || normPath === "/") return;

  out.add(abs.toString());
}

/**
 * Same-site links that appear inside the recipe **ingredient list** in HTML
 * (e.g. Tasty Recipes / WP Recipe Maker), not body copy or related posts.
 */
export function extractSameSiteRecipeLinksFromIngredientSectionsHtml(
  html: string,
  pageUrl: string
): string[] {
  let base: URL;
  try {
    base = new URL(pageUrl);
  } catch {
    return [];
  }

  const pageHostLower = base.hostname.toLowerCase();
  const basePathNorm = base.pathname.replace(/\/$/, "") || "/";

  const $ = cheerio.load(html);
  const $sections = $(
    [
      ".tasty-recipes-ingredients-body",
      ".wprm-recipe-ingredients",
      ".wprm-recipe-ingredients-container",
      "[itemprop='recipeIngredient']",
    ].join(", ")
  );
  if ($sections.length === 0) return [];

  const out = new Set<string>();
  $sections.find("a[href]").each((_, el) => {
    tryAddSameSiteRecipeUrl(
      $(el).attr("href"),
      pageUrl,
      pageHostLower,
      basePathNorm,
      out
    );
  });

  return [...out].slice(0, 48);
}

export type SamePageWprmSibling = {
  url: string;
  /** `.wprm-recipe-name` inside the card, for UI (not a separate page URL). */
  title: string;
};

/**
 * Some blogs embed multiple WP Recipe Maker cards on one post (e.g. main + sauces).
 * Those are not separate URLs in the ingredient list, so cross-page link extraction
 * misses them. Return `#wprm-recipe-container-{id}` URLs for every card except the
 * first in document order (treated as the primary post recipe), with card titles.
 */
export function extractSamePageWprmRecipeSiblings(
  html: string,
  pageUrl: string
): SamePageWprmSibling[] {
  let baseUrl: URL;
  try {
    baseUrl = new URL(pageUrl);
  } catch {
    return [];
  }
  baseUrl.hash = "";
  baseUrl.search = "";
  const base = baseUrl.toString().replace(/\/+$/, "");

  const $ = cheerio.load(html);
  const ids: string[] = [];
  const seen = new Set<string>();
  $(".wprm-recipe-container[id]").each((_, el) => {
    const id = ($(el).attr("id") ?? "").trim();
    if (!/^wprm-recipe-container-\d+$/i.test(id)) return;
    const key = id.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    ids.push(id);
  });

  if (ids.length <= 1) return [];

  const out: SamePageWprmSibling[] = [];
  for (let i = 1; i < ids.length; i++) {
    const id = ids[i];
    if (!id) continue;
    const $card = $(`#${id}`);
    const rawTitle = $card.find(".wprm-recipe-name").first().text();
    const title = rawTitle.replace(/\s+/g, " ").trim();
    out.push({
      url: `${base}#${id}`,
      title: title || "Additional recipe on this page",
    });
  }
  return out.slice(0, 24);
}
