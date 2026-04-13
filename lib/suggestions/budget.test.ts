import { describe, expect, it } from "vitest";
import { enforceWeeklyBudget } from "./budget";
import type { ParsedProfile, ScoredSuggestion } from "./types";

const profile: ParsedProfile = {
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
  weeklyBudgetCents: 6000,
  budgetToleranceRatio: 0.2,
  trustedSourceRatio: 0.65,
};

function makeSuggestion(cost: number, score: number): ScoredSuggestion {
  return {
    candidate: {
      recipeId: null,
      sourceUrl: null,
      sourceDomain: "",
      title: "x",
      description: "",
      ingredientsText: "",
      category: "dinner",
      tags: "",
      createdAt: new Date(),
      isWebCandidate: false,
      estimatedCostCents: cost,
      costConfidence: 0.5,
    },
    score,
    lane: "explore",
    reasons: [],
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
      estimatedCostCents: cost,
      confidence: 0.5,
      fitScore: 0.5,
    },
  };
}

describe("enforceWeeklyBudget", () => {
  it("returns limited suggestions and tracks estimated total", () => {
    const ranked = [1200, 1300, 1400, 1500, 1600, 1700].map((c, i) =>
      makeSuggestion(c, 100 - i)
    );
    const out = enforceWeeklyBudget(ranked, profile, 4);
    expect(out.selected.length).toBe(4);
    expect(out.estimatedWeeklyCostCents).toBeGreaterThan(0);
  });
});
