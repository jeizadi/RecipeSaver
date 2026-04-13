import type { CandidateRecipe, PreferenceVector } from "./types";

export type EmbeddingSimilarityInput = {
  enabled: boolean;
  preferenceVector: PreferenceVector;
  candidates: CandidateRecipe[];
};

export type EmbeddingSimilarityResult = {
  byUrl: Record<string, number>;
  providerUsed: string;
};

/**
 * Feature-flagged embedding hook. Local mode returns empty enrichment and lets
 * deterministic similarity dominate.
 */
export async function getEmbeddingSimilarity(
  input: EmbeddingSimilarityInput
): Promise<EmbeddingSimilarityResult> {
  if (!input.enabled) {
    return { byUrl: {}, providerUsed: "local-none" };
  }
  // Future external provider call point.
  return { byUrl: {}, providerUsed: "local-fallback" };
}
