import { prisma } from "@/lib/prisma";
import { extractCandidateFeatures, normalizeDomain } from "./feature-extract";
import type { FeedbackStats, ParsedProfile } from "./types";

function parseCsv(value: string): string[] {
  return value
    .split(",")
    .map((x) => x.trim().toLowerCase())
    .filter(Boolean);
}

export async function getOrCreateProfile(profileName = "default", userId?: number): Promise<ParsedProfile> {
  const row =
    userId != null
      ? await prisma.userProfile.upsert({
          where: { userId },
          update: {},
          create: { name: profileName, userId },
        })
      : await prisma.userProfile.upsert({
          where: { name: profileName },
          update: {},
          create: { name: profileName },
        });

  return {
    id: row.id,
    name: row.name,
    dietaryRestrictions: parseCsv(row.dietaryRestrictions),
    fitnessGoal: row.fitnessGoal,
    calorieTarget: row.calorieTarget,
    proteinTarget: row.proteinTarget,
    carbTarget: row.carbTarget,
    fatTarget: row.fatTarget,
    preferredDomains: parseCsv(row.preferredDomains),
    blockedDomains: parseCsv(row.blockedDomains),
    favoriteIngredients: parseCsv(row.favoriteIngredients),
    dislikedIngredients: parseCsv(row.dislikedIngredients),
    explorationRatio: Math.min(1, Math.max(0, row.explorationRatio)),
    weeklyBudgetCents: row.weeklyBudgetCents,
    budgetToleranceRatio: Math.min(1, Math.max(0.01, row.budgetToleranceRatio)),
    trustedSourceRatio: Math.min(1, Math.max(0, row.trustedSourceRatio)),
  };
}

export async function updateProfile(profileName: string, patch: Partial<ParsedProfile>, userId?: number) {
  const existing =
    userId != null
      ? await prisma.userProfile.upsert({
          where: { userId },
          update: { name: profileName },
          create: { name: profileName, userId },
        })
      : await prisma.userProfile.upsert({
          where: { name: profileName },
          update: {},
          create: { name: profileName },
        });
  const csv = (xs: string[] | undefined, fallback: string) =>
    xs ? xs.join(",") : fallback;

  await prisma.userProfile.update({
    where: { id: existing.id },
    data: {
      dietaryRestrictions: csv(patch.dietaryRestrictions, existing.dietaryRestrictions),
      fitnessGoal: patch.fitnessGoal ?? existing.fitnessGoal,
      calorieTarget: patch.calorieTarget ?? existing.calorieTarget,
      proteinTarget: patch.proteinTarget ?? existing.proteinTarget,
      carbTarget: patch.carbTarget ?? existing.carbTarget,
      fatTarget: patch.fatTarget ?? existing.fatTarget,
      preferredDomains: csv(patch.preferredDomains, existing.preferredDomains),
      blockedDomains: csv(patch.blockedDomains, existing.blockedDomains),
      favoriteIngredients: csv(patch.favoriteIngredients, existing.favoriteIngredients),
      dislikedIngredients: csv(patch.dislikedIngredients, existing.dislikedIngredients),
      explorationRatio: patch.explorationRatio ?? existing.explorationRatio,
      weeklyBudgetCents: patch.weeklyBudgetCents ?? existing.weeklyBudgetCents,
      budgetToleranceRatio:
        patch.budgetToleranceRatio ?? existing.budgetToleranceRatio,
      trustedSourceRatio: patch.trustedSourceRatio ?? existing.trustedSourceRatio,
    },
  });
}

function signalWeight(signal: string, rating: number | null): number {
  if (signal === "like") return 1.5;
  if (signal === "add_to_plan") return 1.2;
  if (signal === "cooked") return 1.6;
  if (signal === "dislike") return -1.8;
  if (signal === "skip") return -0.5;
  if (signal === "rate" && rating != null) return (rating - 3) * 0.7;
  return 0;
}

export async function getFeedbackStats(userId?: number): Promise<FeedbackStats> {
  const rows = await prisma.recipeFeedback.findMany({
    where: userId != null ? { OR: [{ recipe: { userId } }, { recipeId: null }] } : undefined,
    orderBy: { createdAt: "desc" },
    take: 1500,
    include: { recipe: true },
  });

  const byRecipeId: Record<number, number> = {};
  const byDomain: Record<string, number> = {};
  const ingredientAffinity: Record<string, number> = {};
  const recipeRatings: Record<number, number> = {};
  const cookedCounts: Record<number, number> = {};

  for (const row of rows) {
    const w = signalWeight(row.signal, row.rating);
    if (Math.abs(w) < 1e-6) continue;

    if (row.recipeId != null) {
      byRecipeId[row.recipeId] = (byRecipeId[row.recipeId] ?? 0) + w;
      if (row.signal === "cooked") {
        cookedCounts[row.recipeId] = (cookedCounts[row.recipeId] ?? 0) + 1;
      }
      if (row.signal === "rate" && row.rating != null) {
        recipeRatings[row.recipeId] = (recipeRatings[row.recipeId] ?? 0) + row.rating;
      }
    }
    const domain =
      row.sourceDomain ||
      normalizeDomain(row.candidateUrl) ||
      normalizeDomain(row.recipe?.sourceUrl ?? null);
    if (domain) {
      byDomain[domain] = (byDomain[domain] ?? 0) + w;
    }
    if (row.recipe) {
      const features = extractCandidateFeatures({
        recipeId: row.recipe.id,
        sourceUrl: row.recipe.sourceUrl,
        sourceDomain: normalizeDomain(row.recipe.sourceUrl),
        title: row.recipe.title,
        description: row.recipe.description,
        ingredientsText: row.recipe.ingredientsText,
        category: row.recipe.category,
        tags: row.recipe.tags,
        createdAt: row.recipe.createdAt,
        isWebCandidate: false,
        estimatedCostCents: null,
        costConfidence: 0,
      });
      for (const k of features.ingredientKeys) {
        ingredientAffinity[k] = (ingredientAffinity[k] ?? 0) + w * 0.35;
      }
    }
  }

  return { byRecipeId, byDomain, ingredientAffinity, recipeRatings, cookedCounts };
}
