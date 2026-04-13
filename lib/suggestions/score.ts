import { extractCandidateFeatures } from "./feature-extract";
import type {
  BehaviorStats,
  FeedbackStats,
  ParsedProfile,
  ScoredSuggestion,
} from "./types";
import type { SimilarityDecoratedCandidate } from "./similarity";
import { budgetFitScore } from "./budget";

function overlapScore(haystack: string[], needles: string[]): number {
  if (!needles.length || !haystack.length) return 0;
  const h = new Set(haystack);
  let hits = 0;
  for (const n of needles) {
    if (h.has(n)) hits += 1;
  }
  return hits / needles.length;
}

function fitnessScore(profile: ParsedProfile, text: string): number {
  if (!profile.fitnessGoal) return 0;
  const low = text.toLowerCase();
  if (profile.fitnessGoal.includes("high protein")) {
    return /(protein|chicken|egg|lentil|bean|greek yogurt|tofu)/.test(low) ? 0.8 : -0.15;
  }
  if (profile.fitnessGoal.includes("low carb")) {
    return /(salad|vegetable|cauliflower|zucchini|egg)/.test(low) ? 0.6 : -0.2;
  }
  if (profile.fitnessGoal.includes("muscle")) {
    return /(protein|beef|chicken|fish|egg|greek yogurt)/.test(low) ? 0.7 : 0;
  }
  return 0;
}

export function scoreCandidate(
  decorated: SimilarityDecoratedCandidate,
  profile: ParsedProfile,
  stats: FeedbackStats,
  behavior: BehaviorStats,
  medianCreatedAt: Date,
  mealCountHint: number
): ScoredSuggestion {
  const candidate = decorated.candidate;
  const features = extractCandidateFeatures(candidate);

  const ingredientAffinity =
    overlapScore(features.ingredientKeys, profile.favoriteIngredients) * 2.0 -
    overlapScore(features.ingredientKeys, profile.dislikedIngredients) * 3.0;

  const domainAffinity =
    (profile.preferredDomains.includes(candidate.sourceDomain) ? 1.0 : 0) +
    (stats.byDomain[candidate.sourceDomain] ?? 0) * 0.25;

  const historical =
    (candidate.recipeId != null ? stats.byRecipeId[candidate.recipeId] ?? 0 : 0) +
    features.ingredientKeys.reduce(
      (acc, k) =>
        acc + (stats.ingredientAffinity[k] ?? 0) + (behavior.ingredientAffinity[k] ?? 0),
      0
    ) *
      0.08;

  const fitness = fitnessScore(
    profile,
    `${candidate.title} ${candidate.tags} ${candidate.ingredientsText}`
  );

  const createdAt = candidate.createdAt?.getTime() ?? medianCreatedAt.getTime();
  const novelty = createdAt < medianCreatedAt.getTime() ? 0.2 : 0;

  const exploration =
    candidate.isWebCandidate && !profile.preferredDomains.includes(candidate.sourceDomain)
      ? 0.7 * profile.explorationRatio
      : 0;

  const repeatScore =
    candidate.recipeId != null
      ? (behavior.recipeFrequency[candidate.recipeId] ?? 0) * 0.12 +
        (stats.cookedCounts[candidate.recipeId] ?? 0) * 0.08 +
        (stats.recipeRatings[candidate.recipeId] ?? 0) * 0.03
      : 0;

  const fatiguePenalty =
    candidate.recipeId != null &&
    behavior.recentCookedRecipeIds.slice(0, 4).includes(candidate.recipeId)
      ? 0.45
      : 0;

  const estimatedCostCents = Math.max(250, candidate.estimatedCostCents ?? 900);
  const budget = budgetFitScore(estimatedCostCents, profile, mealCountHint);
  const similarity = decorated.similarityScore;

  const score =
    ingredientAffinity * 2.5 +
    domainAffinity * 1.8 +
    fitness * 1.6 +
    historical * 1.8 +
    novelty +
    exploration +
    budget * 1.1 +
    similarity * 1.35 +
    repeatScore * 1.2 -
    fatiguePenalty;

  const reasons: string[] = [];
  if (ingredientAffinity > 0.2) reasons.push("matches ingredients you like");
  if (domainAffinity > 0.6) reasons.push("from sites you usually prefer");
  if (exploration > 0.1) reasons.push("new source to keep variety");
  if (fitness > 0.2) reasons.push("fits your fitness goal");
  if (historical > 0.5) reasons.push("based on your past feedback");
  if (repeatScore > 0.3) reasons.push("you cook and rate similar recipes often");
  if (budget > 0.2) reasons.push("fits your weekly budget target");
  if (similarity > 0.4) reasons.push("similar to your taste profile");
  if (fatiguePenalty > 0.2) reasons.push("slightly de-prioritized to avoid repeats");
  if (reasons.length === 0) reasons.push("balanced pick for variety");

  return {
    candidate,
    score,
    lane: decorated.lane,
    reasons,
    components: {
      ingredient: ingredientAffinity,
      domain: domainAffinity,
      fitness,
      feedback: historical,
      novelty,
      exploration,
      budget,
      similarity,
      repeat: repeatScore,
      fatigue: fatiguePenalty,
    },
    budgetImpact: {
      estimatedCostCents,
      confidence: Math.min(1, Math.max(0, candidate.costConfidence || 0.5)),
      fitScore: budget,
    },
  };
}
