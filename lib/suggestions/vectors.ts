import { prisma } from "@/lib/prisma";
import { extractCandidateFeatures } from "./feature-extract";
import type {
  BehaviorStats,
  CandidateRecipe,
  ParsedProfile,
  PreferenceVector,
} from "./types";

function clamp(v: number, min = 0, max = 1): number {
  return Math.max(min, Math.min(max, v));
}

function parseVector(raw: string): PreferenceVector | null {
  if (!raw.trim()) return null;
  try {
    const parsed = JSON.parse(raw) as PreferenceVector;
    if (!Array.isArray(parsed.values)) return null;
    return parsed;
  } catch {
    return null;
  }
}

function topMagnitude(map: Record<string, number>): number {
  const values = Object.values(map);
  if (!values.length) return 0;
  return Math.max(...values.map((x) => Math.abs(x)));
}

export function buildLocalPreferenceVector(
  profile: ParsedProfile,
  behavior: BehaviorStats
): PreferenceVector {
  const favoriteIngredients = clamp(profile.favoriteIngredients.length / 20);
  const preferredDomains = clamp(profile.preferredDomains.length / 8);
  const cookedHistory = clamp(Object.keys(behavior.recipeFrequency).length / 60);
  const ratings = clamp(topMagnitude(behavior.domainAffinity) / 10);
  const exploration = clamp(profile.explorationRatio);
  const budgetSensitivity = clamp(
    profile.weeklyBudgetCents != null ? 1 - profile.trustedSourceRatio * 0.45 : 0.3
  );
  const healthFocus = clamp(
    Number(Boolean(profile.fitnessGoal.trim())) * 0.6 +
      Number(profile.calorieTarget != null || profile.proteinTarget != null) * 0.4
  );

  return {
    version: 1,
    values: [
      favoriteIngredients,
      preferredDomains,
      cookedHistory,
      ratings,
      exploration,
      budgetSensitivity,
      healthFocus,
    ],
    dimensions: {
      favoriteIngredients,
      preferredDomains,
      cookedHistory,
      ratings,
      exploration,
      budgetSensitivity,
      healthFocus,
    },
  };
}

export async function upsertUserPreferenceVector(
  userId: number | undefined,
  vector: PreferenceVector
) {
  if (userId == null) return;
  await prisma.userPreferenceVector.upsert({
    where: { userId },
    update: {
      vectorVersion: vector.version,
      localVectorJson: JSON.stringify(vector),
    },
    create: {
      userId,
      vectorVersion: vector.version,
      localVectorJson: JSON.stringify(vector),
    },
  });
}

export async function getStoredUserPreferenceVector(
  userId: number | undefined
): Promise<PreferenceVector | null> {
  if (userId == null) return null;
  const row = await prisma.userPreferenceVector.findUnique({ where: { userId } });
  if (!row) return null;
  return parseVector(row.localVectorJson);
}

export function buildLocalRecipeVector(candidate: CandidateRecipe): number[] {
  const f = extractCandidateFeatures(candidate);
  return [
    Math.min(1, f.ingredientKeys.length / 30),
    Math.min(1, f.tagTokens.length / 15),
    Math.min(1, f.descriptionTokens.length / 30),
    candidate.isWebCandidate ? 0.65 : 0.25,
    Math.min(1, Math.max(0, candidate.costConfidence || 0)),
    Math.min(1, Math.max(0, (candidate.estimatedCostCents ?? 900) / 2200)),
    /(healthy|protein|meal prep|vegetarian|vegan)/i.test(
      `${candidate.title} ${candidate.tags}`
    )
      ? 0.8
      : 0.3,
  ];
}

export async function upsertRecipeVectorSnapshots(candidates: CandidateRecipe[]) {
  const unique = new Map<number, CandidateRecipe>();
  for (const c of candidates) {
    if (c.recipeId == null) continue;
    unique.set(c.recipeId, c);
  }
  if (!unique.size) return;

  const recipeIds = Array.from(unique.keys());
  const features = await prisma.recipeFeature.findMany({
    where: { recipeId: { in: recipeIds } },
    select: { id: true, recipeId: true },
  });
  const byRecipeId = new Map(features.map((f) => [f.recipeId, f.id]));

  for (const c of unique.values()) {
    if (c.recipeId == null) continue;
    const recipeFeatureId = byRecipeId.get(c.recipeId);
    if (!recipeFeatureId) continue;
    const local = buildLocalRecipeVector(c);
    await prisma.recipeVectorSnapshot.upsert({
      where: { recipeFeatureId },
      update: {
        vectorVersion: 1,
        localVectorJson: JSON.stringify(local),
      },
      create: {
        recipeFeatureId,
        vectorVersion: 1,
        localVectorJson: JSON.stringify(local),
      },
    });
  }
}
