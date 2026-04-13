import type { ScoredSuggestion } from "./types";

export type LlmRerankInput = {
  candidates: ScoredSuggestion[];
  enabled: boolean;
};

export type LlmRerankResult = {
  candidates: ScoredSuggestion[];
  providerUsed: string;
  enabled: boolean;
};

/**
 * Placeholder abstraction for future external rerank. In local-first mode this is a
 * stable no-op while preserving a single integration point.
 */
export async function rerankWithOptionalLlm(
  input: LlmRerankInput
): Promise<LlmRerankResult> {
  if (!input.enabled) {
    return {
      candidates: input.candidates,
      providerUsed: "local-none",
      enabled: false,
    };
  }
  // Future: provider dispatch (OpenAI/Anthropic/etc). Keep deterministic fallback.
  return {
    candidates: input.candidates,
    providerUsed: "local-fallback",
    enabled: true,
  };
}
