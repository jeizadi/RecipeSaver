import type { ScoredSuggestion } from "./types";

export function diversifySuggestions(
  ranked: ScoredSuggestion[],
  limit: number
): ScoredSuggestion[] {
  const result: ScoredSuggestion[] = [];
  const domainCount: Record<string, number> = {};
  const categoryCount: Record<string, number> = {};
  const domainCap = 3;

  for (const item of ranked) {
    if (result.length >= limit) break;
    const domain = item.candidate.sourceDomain || "unknown";
    const cat = item.candidate.category || "other";
    const dCount = domainCount[domain] ?? 0;
    const cCount = categoryCount[cat] ?? 0;

    // Soft cap concentration but don't dead-end if pool is small.
    if (dCount >= domainCap) continue;
    if (result.length > 6 && cCount >= 3) continue;

    result.push(item);
    domainCount[domain] = dCount + 1;
    categoryCount[cat] = cCount + 1;
  }

  if (result.length < limit) {
    const used = new Set(result.map((x) => `${x.candidate.recipeId ?? 0}|${x.candidate.sourceUrl ?? ""}`));
    for (const item of ranked) {
      if (result.length >= limit) break;
      const key = `${item.candidate.recipeId ?? 0}|${item.candidate.sourceUrl ?? ""}`;
      if (used.has(key)) continue;
      const domain = item.candidate.sourceDomain || "unknown";
      if ((domainCount[domain] ?? 0) >= domainCap && ranked.length > limit) continue;
      result.push(item);
      domainCount[domain] = (domainCount[domain] ?? 0) + 1;
    }
  }

  return result;
}
