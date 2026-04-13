import { prisma } from "@/lib/prisma";
import { extractCandidateFeatures, normalizeDomain } from "./feature-extract";
import type { BehaviorStats, CandidateRecipe } from "./types";

function behaviorAggregateModel() {
  return (prisma as unknown as {
    userBehaviorAggregate?: {
      findUnique: (args: { where: { userId: number } }) => Promise<{
        recipeFrequencyJson: string;
        domainAffinityJson: string;
        ingredientAffinityJson: string;
        recentCookedRecipeIds: string;
      } | null>;
      upsert: (args: {
        where: { userId: number };
        update: Record<string, string>;
        create: Record<string, string | number>;
      }) => Promise<unknown>;
    };
  }).userBehaviorAggregate;
}

function parseJsonMap(input: string): Record<string, number> {
  if (!input.trim()) return {};
  try {
    const parsed = JSON.parse(input) as Record<string, number>;
    if (!parsed || typeof parsed !== "object") return {};
    return parsed;
  } catch {
    return {};
  }
}

function parseRecentIds(input: string): number[] {
  if (!input.trim()) return [];
  try {
    const parsed = JSON.parse(input) as number[];
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((x) => Number.isInteger(x)).slice(0, 120);
  } catch {
    return [];
  }
}

function increment(map: Record<string, number>, key: string, delta: number) {
  if (!key) return;
  map[key] = (map[key] ?? 0) + delta;
}

export async function buildBehaviorStats(userId: number): Promise<BehaviorStats> {
  const [weeklyRows, feedbackRows] = await Promise.all([
    prisma.weeklyMealPlan.findMany({
      where: { userId },
      include: {
        recipe: {
          select: {
            id: true,
            sourceUrl: true,
            title: true,
            description: true,
            ingredientsText: true,
            category: true,
            tags: true,
            createdAt: true,
          },
        },
      },
      orderBy: { plannedFor: "desc" },
      take: 500,
    }),
    prisma.recipeFeedback.findMany({
      where: { recipe: { userId } },
      include: {
        recipe: {
          select: {
            id: true,
            sourceUrl: true,
            title: true,
            description: true,
            ingredientsText: true,
            category: true,
            tags: true,
            createdAt: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
      take: 1500,
    }),
  ]);

  const recipeFrequency: Record<number, number> = {};
  const domainAffinity: Record<string, number> = {};
  const ingredientAffinity: Record<string, number> = {};
  const recentCookedRecipeIds: number[] = [];

  for (const row of weeklyRows) {
    const recipe = row.recipe;
    recipeFrequency[recipe.id] = (recipeFrequency[recipe.id] ?? 0) + 1;
    if (row.status === "cooked") {
      recentCookedRecipeIds.push(recipe.id);
    }
    increment(domainAffinity, normalizeDomain(recipe.sourceUrl), 0.5);

    const features = extractCandidateFeatures({
      recipeId: recipe.id,
      sourceUrl: recipe.sourceUrl,
      sourceDomain: normalizeDomain(recipe.sourceUrl),
      title: recipe.title,
      description: recipe.description,
      ingredientsText: recipe.ingredientsText,
      category: recipe.category,
      tags: recipe.tags,
      createdAt: recipe.createdAt,
      isWebCandidate: false,
      estimatedCostCents: null,
      costConfidence: 0,
    });
    for (const k of features.ingredientKeys) {
      increment(ingredientAffinity, k, 0.2);
    }
  }

  for (const row of feedbackRows) {
    const recipe = row.recipe;
    if (!recipe) continue;
    const signalWeight =
      row.signal === "like" || row.signal === "cooked" || row.signal === "add_to_plan"
        ? 0.55
        : row.signal === "dislike"
          ? -0.75
          : row.signal === "skip"
            ? -0.15
            : row.signal === "rate" && row.rating != null
              ? (row.rating - 3) * 0.25
              : 0;
    if (!signalWeight) continue;
    increment(domainAffinity, normalizeDomain(recipe.sourceUrl), signalWeight);
    const features = extractCandidateFeatures({
      recipeId: recipe.id,
      sourceUrl: recipe.sourceUrl,
      sourceDomain: normalizeDomain(recipe.sourceUrl),
      title: recipe.title,
      description: recipe.description,
      ingredientsText: recipe.ingredientsText,
      category: recipe.category,
      tags: recipe.tags,
      createdAt: recipe.createdAt,
      isWebCandidate: false,
      estimatedCostCents: null,
      costConfidence: 0,
    });
    for (const k of features.ingredientKeys) increment(ingredientAffinity, k, signalWeight * 0.5);
  }

  return {
    recipeFrequency,
    domainAffinity,
    ingredientAffinity,
    recentCookedRecipeIds: Array.from(new Set(recentCookedRecipeIds)).slice(0, 80),
  };
}

export async function storeBehaviorStats(userId: number, stats: BehaviorStats) {
  const model = behaviorAggregateModel();
  if (!model?.upsert) return;
  await model.upsert({
    where: { userId },
    update: {
      recipeFrequencyJson: JSON.stringify(stats.recipeFrequency),
      domainAffinityJson: JSON.stringify(stats.domainAffinity),
      ingredientAffinityJson: JSON.stringify(stats.ingredientAffinity),
      recentCookedRecipeIds: JSON.stringify(stats.recentCookedRecipeIds),
    },
    create: {
      userId,
      recipeFrequencyJson: JSON.stringify(stats.recipeFrequency),
      domainAffinityJson: JSON.stringify(stats.domainAffinity),
      ingredientAffinityJson: JSON.stringify(stats.ingredientAffinity),
      recentCookedRecipeIds: JSON.stringify(stats.recentCookedRecipeIds),
    },
  });
}

export async function getOrBuildBehaviorStats(userId?: number): Promise<BehaviorStats> {
  if (userId == null) {
    return {
      recipeFrequency: {},
      domainAffinity: {},
      ingredientAffinity: {},
      recentCookedRecipeIds: [],
    };
  }
  const model = behaviorAggregateModel();
  const row = model?.findUnique
    ? await model.findUnique({ where: { userId } })
    : null;
  if (row) {
    const recipeFreq = parseJsonMap(row.recipeFrequencyJson);
    const recipeFrequency: Record<number, number> = {};
    for (const [k, v] of Object.entries(recipeFreq)) {
      const id = Number(k);
      if (Number.isInteger(id)) recipeFrequency[id] = v;
    }
    return {
      recipeFrequency,
      domainAffinity: parseJsonMap(row.domainAffinityJson),
      ingredientAffinity: parseJsonMap(row.ingredientAffinityJson),
      recentCookedRecipeIds: parseRecentIds(row.recentCookedRecipeIds),
    };
  }
  const built = await buildBehaviorStats(userId);
  await storeBehaviorStats(userId, built);
  return built;
}

export function estimateRecipeCost(candidate: CandidateRecipe): {
  estimatedCostCents: number;
  confidence: number;
} {
  if (candidate.estimatedCostCents != null) {
    return {
      estimatedCostCents: Math.max(100, candidate.estimatedCostCents),
      confidence: Math.min(1, Math.max(0, candidate.costConfidence || 0)),
    };
  }
  const text = `${candidate.ingredientsText} ${candidate.title}`.toLowerCase();
  let cost = 900;
  if (/(beef|salmon|shrimp|lamb|steak)/.test(text)) cost += 600;
  if (/(tofu|bean|lentil|chickpea|pasta|rice)/.test(text)) cost -= 220;
  if (/(truffle|saffron|caviar)/.test(text)) cost += 1200;
  if (candidate.isWebCandidate) cost += 120;
  if (/(budget|cheap|frugal|meal prep)/.test(text)) cost -= 180;
  return {
    estimatedCostCents: Math.max(250, cost),
    confidence: 0.45,
  };
}
