import { prisma } from "@/lib/prisma";
import { enforceWeeklyBudget } from "./budget";
import { getOrBuildBehaviorStats } from "./behavior";
import { getCandidatePool } from "./candidate-pool";
import { diversifySuggestions } from "./diversify";
import { getEmbeddingSimilarity } from "./embedding-provider";
import { isBlockedDomain, passesHardDietaryFilters } from "./hard-filters";
import { getFeedbackStats, getOrCreateProfile } from "./learn";
import { rerankWithOptionalLlm } from "./llm-provider";
import { discoverOpenWebCandidates } from "./open-web";
import { attachSimilarityLanes } from "./similarity";
import { scoreCandidate } from "./score";
import type { SuggestionInput } from "./types";
import {
  buildLocalPreferenceVector,
  upsertRecipeVectorSnapshots,
  upsertUserPreferenceVector,
} from "./vectors";

function medianDate(values: Date[]): Date {
  if (!values.length) return new Date();
  const sorted = [...values].sort((a, b) => a.getTime() - b.getTime());
  return sorted[Math.floor(sorted.length / 2)];
}

export async function generateSuggestions(input: SuggestionInput) {
  const limit = Math.min(30, Math.max(4, input.limit ?? 12));
  const profile = await getOrCreateProfile(input.profileName ?? "default", input.userId);
  const [pool, feedbackStats, behavior] = await Promise.all([
    getCandidatePool(Boolean(input.includeWebCandidates), input.userId),
    getFeedbackStats(input.userId),
    getOrBuildBehaviorStats(input.userId),
  ]);
  const preferenceVector = buildLocalPreferenceVector(profile, behavior);
  await upsertUserPreferenceVector(input.userId, preferenceVector);

  let candidatePool = pool;
  if (
    Boolean(input.includeWebCandidates) &&
    !candidatePool.some((x) => x.isWebCandidate)
  ) {
    const existingUrls = new Set(
      candidatePool
        .map((x) => (x.sourceUrl ?? "").trim().toLowerCase())
        .filter(Boolean)
    );
    const discovered = await discoverOpenWebCandidates(
      profile,
      behavior,
      existingUrls,
      42
    );
    candidatePool = [...candidatePool, ...discovered];
  }

  const medianCreated = medianDate(
    candidatePool.map((x) => x.createdAt).filter((x): x is Date => Boolean(x))
  );

  const filtered = [];
  for (const c of candidatePool) {
    if (isBlockedDomain(c, profile)) continue;
    const dietary = passesHardDietaryFilters(c, profile);
    if (!dietary.ok) continue;
    filtered.push(c);
  }

  const embeddingSimilarity = await getEmbeddingSimilarity({
    enabled: Boolean(input.embeddingEnabled),
    preferenceVector,
    candidates: filtered,
  });
  const similarityDecorated = attachSimilarityLanes(
    filtered,
    profile,
    behavior,
    preferenceVector,
    embeddingSimilarity.byUrl
  );
  const scored = similarityDecorated
    .map((c) =>
      scoreCandidate(c, profile, feedbackStats, behavior, medianCreated, limit)
    )
    .sort((a, b) => b.score - a.score);

  const diverse = diversifySuggestions(scored, limit * 2);
  const budgeted = enforceWeeklyBudget(diverse, profile, limit);
  const reranked = await rerankWithOptionalLlm({
    candidates: budgeted.selected,
    enabled: Boolean(input.llmEnabled),
  });
  const final = reranked.candidates.slice(0, limit);
  await upsertRecipeVectorSnapshots(final.map((x) => x.candidate));

  const run = await prisma.suggestionRun.create({
    data: {
      profileId: profile.id,
      inputJson: JSON.stringify({
        limit,
        includeWebCandidates: Boolean(input.includeWebCandidates),
      }),
      items: {
        create: final.map((x) => ({
          recipeId: x.candidate.recipeId,
          candidateUrl: x.candidate.sourceUrl,
          sourceDomain: x.candidate.sourceDomain,
          title: x.candidate.title,
          score: x.score,
          lane: x.lane,
          budgetFitScore: x.components.budget,
          similarityScore: x.components.similarity,
          explainJson: JSON.stringify({
            lane: x.lane,
            budgetImpact: x.budgetImpact,
          }),
          reasonJson: JSON.stringify({
            reasons: x.reasons,
            components: x.components,
          }),
        })),
      },
    },
    include: { items: true },
  });

  return {
    runId: run.id,
    profile: {
      name: profile.name,
      dietaryRestrictions: profile.dietaryRestrictions,
      fitnessGoal: profile.fitnessGoal,
      explorationRatio: profile.explorationRatio,
      weeklyBudgetCents: profile.weeklyBudgetCents,
    },
    suggestions: final.map((x, idx) => ({
      rank: idx + 1,
      recipeId: x.candidate.recipeId,
      sourceUrl: x.candidate.sourceUrl,
      sourceDomain: x.candidate.sourceDomain,
      title: x.candidate.title,
      description: x.candidate.description,
      category: x.candidate.category,
      tags: x.candidate.tags,
      isWebCandidate: x.candidate.isWebCandidate,
      lane: x.lane,
      budgetImpact: x.budgetImpact,
      score: Number(x.score.toFixed(3)),
      reasons: x.reasons,
      components: x.components,
    })),
    totals: {
      considered: pool.length,
      consideredWithDiscovery: candidatePool.length,
      passedFilters: filtered.length,
      returned: final.length,
      estimatedWeeklyCostCents: budgeted.estimatedWeeklyCostCents,
      budgetTargetCents: budgeted.budgetPlan.targetCents,
    },
    diagnostics: {
      topIngredients: Object.entries(behavior.ingredientAffinity)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10)
        .map(([name, score]) => ({ name, score: Number(score.toFixed(3)) })),
      topDomains: Object.entries(behavior.domainAffinity)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 8)
        .map(([domain, score]) => ({ domain, score: Number(score.toFixed(3)) })),
      mostCookedRecipeIds: Object.entries(behavior.recipeFrequency)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10)
        .map(([id]) => Number(id)),
      providerUsed: reranked.providerUsed,
      embeddingProviderUsed: embeddingSimilarity.providerUsed,
    },
  };
}
