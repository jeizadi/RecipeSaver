import { normalizeDomain } from "./feature-extract";
import type { BehaviorStats, CandidateRecipe, ParsedProfile } from "./types";

type SearchItem = {
  title: string;
  url: string;
};

function xmlDecode(s: string): string {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

function parseRssItems(xml: string): SearchItem[] {
  const out: SearchItem[] = [];
  const itemRe = /<item>([\s\S]*?)<\/item>/gi;
  let m: RegExpExecArray | null;
  while ((m = itemRe.exec(xml)) !== null) {
    const item = m[1] ?? "";
    const title = item.match(/<title>([\s\S]*?)<\/title>/i)?.[1] ?? "";
    const link = item.match(/<link>([\s\S]*?)<\/link>/i)?.[1] ?? "";
    const titleText = xmlDecode(title.replace(/<!\[CDATA\[|\]\]>/g, "").trim());
    const linkText = xmlDecode(link.replace(/<!\[CDATA\[|\]\]>/g, "").trim());
    if (!titleText || !linkText) continue;
    out.push({ title: titleText, url: linkText });
    if (out.length >= 20) break;
  }
  return out;
}

const BLOCKED_DOMAIN_RE = new RegExp(
  [
    "dictionary\\.",
    "merriam-webster\\.",
    "wiktionary\\.",
    "wikipedia\\.",
    "britannica\\.",
    "thesaurus\\.",
    "vocabulary\\.",
    "translate\\.",
    "quora\\.",
    "reddit\\.",
    "news\\.",
    "nytimes\\.",
    "wsj\\.",
    "cnn\\.",
    "bbc\\.",
    "youtube\\.",
    "youtu\\.be",
    "facebook\\.",
    "instagram\\.",
    "pinterest\\.",
    "tiktok\\.",
  ].join("|")
);

function looksLikeRecipeResult(title: string, url: string): boolean {
  const t = title.toLowerCase();
  const u = url.toLowerCase();
  if (BLOCKED_DOMAIN_RE.test(u)) return false;
  if (/(dictionary|definition|meaning|synonym|pronunciation)/.test(t)) return false;
  if (/(\/dictionary\/|\/definition\/|\/word\/|\/wiki\/)/.test(u)) return false;

  const positiveTitle = /(recipe|how to make|easy|dinner|lunch|breakfast|soup|salad|pasta|taco|curry|bowl|stew|sauce)/.test(
    t
  );
  const positiveUrl = /(\/recipe\/|\/recipes\/|recipe-|\/food\/|\/cooking\/|\/meal\/)/.test(
    u
  );
  const hasFoodWords = /(chicken|beef|tofu|lentil|bean|pasta|rice|salad|soup|taco|curry|cake|cookie|bread|sauce)/.test(
    `${t} ${u}`
  );
  return positiveTitle || positiveUrl || hasFoodWords;
}

function buildQueries(profile: ParsedProfile, behavior: BehaviorStats): string[] {
  const q = new Set<string>();
  const fav = profile.favoriteIngredients.slice(0, 4).join(" ");
  if (fav) q.add(`${fav} recipe`);
  if (profile.fitnessGoal.trim()) q.add(`${profile.fitnessGoal} weeknight recipe`);

  const topIngredients = Object.entries(behavior.ingredientAffinity)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([k]) => k);
  if (topIngredients.length) q.add(`${topIngredients.join(" ")} recipe`);

  if (profile.preferredDomains.length) {
    for (const d of profile.preferredDomains.slice(0, 2)) {
      q.add(`site:${d} recipe`);
    }
  }
  if (!q.size) q.add("healthy dinner recipe");
  return Array.from(q).slice(0, 5);
}

async function searchRss(query: string): Promise<SearchItem[]> {
  const url = `https://www.bing.com/search?q=${encodeURIComponent(query)}&format=rss`;
  const res = await fetch(url, {
    headers: { "User-Agent": "RecipeboxImporter/1.0 (+https; personal use)" },
    signal: AbortSignal.timeout(8000),
  });
  if (!res.ok) return [];
  const xml = await res.text();
  return parseRssItems(xml);
}

async function fetchFeedItems(feedUrl: string): Promise<SearchItem[]> {
  const res = await fetch(feedUrl, {
    headers: { "User-Agent": "RecipeboxImporter/1.0 (+https; personal use)" },
    signal: AbortSignal.timeout(8000),
  });
  if (!res.ok) return [];
  const xml = await res.text();
  return parseRssItems(xml);
}

export async function discoverOpenWebCandidates(
  profile: ParsedProfile,
  behavior: BehaviorStats,
  existingUrls: Set<string>,
  limit = 36
): Promise<CandidateRecipe[]> {
  const queries = buildQueries(profile, behavior);
  const collected: CandidateRecipe[] = [];
  const seen = new Set<string>();

  for (const q of queries) {
    let items: SearchItem[] = [];
    try {
      items = await searchRss(q);
    } catch {
      items = [];
    }
    for (const item of items) {
      const url = item.url.trim();
      const lower = url.toLowerCase();
      if (!url || seen.has(lower) || existingUrls.has(lower)) continue;
      if (!looksLikeRecipeResult(item.title, url)) continue;
      const domain = normalizeDomain(url);
      if (!domain) continue;
      if (BLOCKED_DOMAIN_RE.test(domain)) {
        continue;
      }
      seen.add(lower);
      collected.push({
        recipeId: null,
        sourceUrl: url,
        sourceDomain: domain,
        title: item.title,
        description: "",
        ingredientsText: "",
        category: "other",
        tags: "open-web",
        createdAt: new Date(),
        isWebCandidate: true,
        estimatedCostCents: null,
        costConfidence: 0,
      });
      if (collected.length >= limit) return collected;
    }
  }

  // Fallback: known recipe-focused feeds to avoid generic search drift.
  const knownRecipeFeeds = [
    "https://www.seriouseats.com/rss",
    "https://minimalistbaker.com/feed/",
    "https://www.feastingathome.com/feed/",
    "https://www.loveandlemons.com/feed/",
    "https://cookieandkate.com/feed/",
    "https://www.budgetbytes.com/feed/",
  ];
  for (const feed of knownRecipeFeeds) {
    let items: SearchItem[] = [];
    try {
      items = await fetchFeedItems(feed);
    } catch {
      items = [];
    }
    for (const item of items) {
      const url = item.url.trim();
      const lower = url.toLowerCase();
      if (!url || seen.has(lower) || existingUrls.has(lower)) continue;
      if (!looksLikeRecipeResult(item.title, url)) continue;
      const domain = normalizeDomain(url);
      if (!domain || BLOCKED_DOMAIN_RE.test(domain)) continue;
      seen.add(lower);
      collected.push({
        recipeId: null,
        sourceUrl: url,
        sourceDomain: domain,
        title: item.title,
        description: "",
        ingredientsText: "",
        category: "other",
        tags: "open-web,feed",
        createdAt: new Date(),
        isWebCandidate: true,
        estimatedCostCents: null,
        costConfidence: 0,
      });
      if (collected.length >= limit) return collected;
    }
  }

  return collected;
}
