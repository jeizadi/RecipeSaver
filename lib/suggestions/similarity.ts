import { extractCandidateFeatures } from "./feature-extract";
import type {
  BehaviorStats,
  CandidateRecipe,
  ParsedProfile,
  PreferenceVector,
} from "./types";

export type SimilarityLane = "repeat_favorite" | "trusted_similar" | "explore";

export type SimilarityDecoratedCandidate = {
  candidate: CandidateRecipe;
  lane: SimilarityLane;
  similarityScore: number;
  seedRecipeId: number | null;
};

function overlap(a: string[], b: string[]): number {
  if (!a.length || !b.length) return 0;
  const sa = new Set(a);
  let hits = 0;
  for (const x of b) if (sa.has(x)) hits += 1;
  return hits / Math.max(1, Math.min(a.length, b.length));
}

function dot(a: number[], b: number[]): number {
  const len = Math.min(a.length, b.length);
  let s = 0;
  for (let i = 0; i < len; i++) s += a[i] * b[i];
  return s;
}

function laneForCandidate(
  candidate: CandidateRecipe,
  profile: ParsedProfile,
  behavior: BehaviorStats
): SimilarityLane {
  if (
    candidate.recipeId != null &&
    ((behavior.recipeFrequency[candidate.recipeId] ?? 0) >= 2 ||
      (behavior.recentCookedRecipeIds.includes(candidate.recipeId) &&
        (behavior.recipeFrequency[candidate.recipeId] ?? 0) >= 1))
  ) {
    return "repeat_favorite";
  }
  if (
    profile.preferredDomains.includes(candidate.sourceDomain) ||
    (behavior.domainAffinity[candidate.sourceDomain] ?? 0) > 0.8
  ) {
    return "trusted_similar";
  }
  return "explore";
}

export function attachSimilarityLanes(
  candidates: CandidateRecipe[],
  profile: ParsedProfile,
  behavior: BehaviorStats,
  preferenceVector: PreferenceVector,
  embeddingSimilarityByUrl: Record<string, number> = {}
): SimilarityDecoratedCandidate[] {
  const ingredientSeed = new Set(profile.favoriteIngredients);
  for (const id of behavior.recentCookedRecipeIds.slice(0, 24)) {
    const c = candidates.find((x) => x.recipeId === id);
    if (!c) continue;
    const f = extractCandidateFeatures(c);
    for (const key of f.ingredientKeys) ingredientSeed.add(key);
  }
  const seedList = Array.from(ingredientSeed);

  return candidates.map((candidate) => {
    const f = extractCandidateFeatures(candidate);
    const simByIngredients = overlap(f.ingredientKeys, seedList);
    const recipeVector = [
      Math.min(1, f.ingredientKeys.length / 25),
      Math.min(1, f.tagTokens.length / 15),
      candidate.isWebCandidate ? 0.6 : 0.2,
      Math.min(1, (behavior.domainAffinity[candidate.sourceDomain] ?? 0) / 4),
      profile.preferredDomains.includes(candidate.sourceDomain) ? 1 : 0,
      Math.min(1, Math.max(0, candidate.costConfidence || 0)),
      /(protein|healthy|salad|meal prep|low carb)/i.test(
        `${candidate.title} ${candidate.tags}`
      )
        ? 0.9
        : 0.3,
    ];
    const simByVector = dot(
      recipeVector,
      preferenceVector.values.slice(0, recipeVector.length)
    );
    const lane = laneForCandidate(candidate, profile, behavior);
    const laneBoost =
      lane === "repeat_favorite" ? 0.35 : lane === "trusted_similar" ? 0.18 : 0;
    const external =
      candidate.sourceUrl != null ? embeddingSimilarityByUrl[candidate.sourceUrl] ?? 0 : 0;
    const similarityScore =
      simByIngredients * 0.45 + simByVector * 0.4 + external * 0.15 + laneBoost;
    return {
      candidate,
      lane,
      similarityScore,
      seedRecipeId: lane === "repeat_favorite" ? candidate.recipeId : null,
    };
  });
}
