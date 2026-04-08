import { prisma } from "@/lib/prisma";
import { getCandidatePool } from "./candidate-pool";
import { diversifySuggestions } from "./diversify";
import { isBlockedDomain, passesHardDietaryFilters } from "./hard-filters";
import { getFeedbackStats, getOrCreateProfile } from "./learn";
import { scoreCandidate } from "./score";
import type { SuggestionInput } from "./types";

function medianDate(values: Date[]): Date {
  if (!values.length) return new Date();
  const sorted = [...values].sort((a, b) => a.getTime() - b.getTime());
  return sorted[Math.floor(sorted.length / 2)];
}

export async function generateSuggestions(input: SuggestionInput) {
  const limit = Math.min(30, Math.max(4, input.limit ?? 12));
  const profile = await getOrCreateProfile(input.profileName ?? "default", input.userId);
  const [pool, feedbackStats] = await Promise.all([
    getCandidatePool(Boolean(input.includeWebCandidates), input.userId),
    getFeedbackStats(input.userId),
  ]);

  const medianCreated = medianDate(
    pool.map((x) => x.createdAt).filter((x): x is Date => Boolean(x))
  );

  const filtered = [];
  for (const c of pool) {
    if (isBlockedDomain(c, profile)) continue;
    const dietary = passesHardDietaryFilters(c, profile);
    if (!dietary.ok) continue;
    filtered.push(c);
  }

  const scored = filtered
    .map((c) => scoreCandidate(c, profile, feedbackStats, medianCreated))
    .sort((a, b) => b.score - a.score);

  const diverse = diversifySuggestions(scored, limit);

  const run = await prisma.suggestionRun.create({
    data: {
      profileId: profile.id,
      inputJson: JSON.stringify({
        limit,
        includeWebCandidates: Boolean(input.includeWebCandidates),
      }),
      items: {
        create: diverse.map((x) => ({
          recipeId: x.candidate.recipeId,
          candidateUrl: x.candidate.sourceUrl,
          sourceDomain: x.candidate.sourceDomain,
          title: x.candidate.title,
          score: x.score,
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
    },
    suggestions: diverse.map((x, idx) => ({
      rank: idx + 1,
      recipeId: x.candidate.recipeId,
      sourceUrl: x.candidate.sourceUrl,
      sourceDomain: x.candidate.sourceDomain,
      title: x.candidate.title,
      description: x.candidate.description,
      category: x.candidate.category,
      tags: x.candidate.tags,
      isWebCandidate: x.candidate.isWebCandidate,
      score: Number(x.score.toFixed(3)),
      reasons: x.reasons,
      components: x.components,
    })),
    totals: {
      considered: pool.length,
      passedFilters: filtered.length,
      returned: diverse.length,
    },
  };
}
