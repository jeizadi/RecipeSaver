import { describe, expect, it } from "vitest";
import { attachSimilarityLanes } from "./similarity";
import type { BehaviorStats, CandidateRecipe, ParsedProfile, PreferenceVector } from "./types";

const profile: ParsedProfile = {
  id: 1,
  name: "default",
  dietaryRestrictions: [],
  fitnessGoal: "high protein",
  calorieTarget: null,
  proteinTarget: null,
  carbTarget: null,
  fatTarget: null,
  preferredDomains: ["fav.com"],
  blockedDomains: [],
  favoriteIngredients: ["lentils"],
  dislikedIngredients: [],
  explorationRatio: 0.35,
  weeklyBudgetCents: 7000,
  budgetToleranceRatio: 0.15,
  trustedSourceRatio: 0.65,
};

const vector: PreferenceVector = {
  version: 1,
  values: [0.5, 0.5, 0.5, 0.2, 0.3, 0.5, 0.7],
  dimensions: {
    favoriteIngredients: 0.5,
    preferredDomains: 0.5,
    cookedHistory: 0.5,
    ratings: 0.2,
    exploration: 0.3,
    budgetSensitivity: 0.5,
    healthFocus: 0.7,
  },
};

const behavior: BehaviorStats = {
  recipeFrequency: { 10: 3 },
  domainAffinity: { "fav.com": 1.2 },
  ingredientAffinity: {},
  recentCookedRecipeIds: [10],
};

function candidate(overrides: Partial<CandidateRecipe>): CandidateRecipe {
  return {
    recipeId: 1,
    sourceUrl: "https://fav.com/r",
    sourceDomain: "fav.com",
    title: "Recipe",
    description: "",
    ingredientsText: "lentils",
    category: "dinner",
    tags: "",
    createdAt: new Date(),
    isWebCandidate: false,
    estimatedCostCents: 800,
    costConfidence: 0.5,
    ...overrides,
  };
}

describe("attachSimilarityLanes", () => {
  it("marks repeat favorites for frequently cooked recipes", () => {
    const out = attachSimilarityLanes([candidate({ recipeId: 10 })], profile, behavior, vector);
    expect(out[0]?.lane).toBe("repeat_favorite");
    expect((out[0]?.similarityScore ?? 0) > 0).toBe(true);
  });
});
