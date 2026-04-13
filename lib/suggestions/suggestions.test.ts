import { describe, expect, it } from "vitest";
import { diversifySuggestions } from "./diversify";
import { passesHardDietaryFilters } from "./hard-filters";
import { scoreCandidate } from "./score";
import type { CandidateRecipe, ParsedProfile, ScoredSuggestion } from "./types";

const profileBase: ParsedProfile = {
  id: 1,
  name: "default",
  dietaryRestrictions: [],
  fitnessGoal: "",
  calorieTarget: null,
  proteinTarget: null,
  carbTarget: null,
  fatTarget: null,
  preferredDomains: [],
  blockedDomains: [],
  favoriteIngredients: [],
  dislikedIngredients: [],
  explorationRatio: 0.35,
  weeklyBudgetCents: 8000,
  budgetToleranceRatio: 0.15,
  trustedSourceRatio: 0.65,
};

function candidate(overrides: Partial<CandidateRecipe> = {}): CandidateRecipe {
  return {
    recipeId: 1,
    sourceUrl: "https://example.com/r",
    sourceDomain: "example.com",
    title: "Test Recipe",
    description: "",
    ingredientsText: "1 cup chickpeas",
    category: "dinner",
    tags: "healthy",
    createdAt: new Date("2025-01-01"),
    isWebCandidate: false,
    estimatedCostCents: 950,
    costConfidence: 0.4,
    ...overrides,
  };
}

describe("hard dietary filters", () => {
  it("filters non-vegan recipes for vegan profiles", () => {
    const out = passesHardDietaryFilters(
      candidate({ ingredientsText: "2 eggs\n1 cup flour" }),
      { ...profileBase, dietaryRestrictions: ["vegan"] }
    );
    expect(out.ok).toBe(false);
  });

  it("allows vegan-friendly recipe for vegan profiles", () => {
    const out = passesHardDietaryFilters(
      candidate({ ingredientsText: "1 cup lentils\n1 cup spinach" }),
      { ...profileBase, dietaryRestrictions: ["vegan"] }
    );
    expect(out.ok).toBe(true);
  });
});

describe("scoreCandidate", () => {
  it("boosts preferred domain and favorite ingredients", () => {
    const scored = scoreCandidate(
      {
        candidate: candidate({
          sourceDomain: "fav.com",
          ingredientsText: "1 cup chickpeas\n1 cup spinach",
        }),
        lane: "trusted_similar",
        similarityScore: 0.4,
        seedRecipeId: null,
      },
      {
        ...profileBase,
        preferredDomains: ["fav.com"],
        favoriteIngredients: ["chickpeas"],
      },
      {
        byRecipeId: {},
        byDomain: {},
        ingredientAffinity: {},
        recipeRatings: {},
        cookedCounts: {},
      },
      {
        recipeFrequency: {},
        domainAffinity: {},
        ingredientAffinity: {},
        recentCookedRecipeIds: [],
      },
      new Date("2025-01-02"),
      12
    );
    expect(scored.score).toBeGreaterThan(0);
    expect(scored.reasons.length).toBeGreaterThan(0);
  });
});

describe("diversifySuggestions", () => {
  it("avoids over-concentrating same source", () => {
    const ranked: ScoredSuggestion[] = [
      1, 2, 3, 4, 5, 6, 7, 8,
    ].map((n) => ({
      candidate: candidate({
        recipeId: n,
        sourceDomain: n <= 5 ? "same.com" : `new${n}.com`,
        category: "dinner",
      }),
      score: 100 - n,
      reasons: ["test"],
      lane: "explore",
      components: {
        ingredient: 0,
        domain: 0,
        fitness: 0,
        feedback: 0,
        novelty: 0,
        exploration: 0,
        budget: 0,
        similarity: 0,
        repeat: 0,
        fatigue: 0,
      },
      budgetImpact: {
        estimatedCostCents: 1000,
        confidence: 0.5,
        fitScore: 0,
      },
    }));
    const out = diversifySuggestions(ranked, 6);
    const sameDomainCount = out.filter((x) => x.candidate.sourceDomain === "same.com").length;
    expect(sameDomainCount).toBeLessThanOrEqual(3);
  });
});
