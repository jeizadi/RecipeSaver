import type { ParsedProfile, ScoredSuggestion } from "./types";

export type BudgetPlan = {
  targetCents: number | null;
  toleranceRatio: number;
  minCents: number | null;
  maxCents: number | null;
};

export function getBudgetPlan(profile: ParsedProfile): BudgetPlan {
  if (profile.weeklyBudgetCents == null || profile.weeklyBudgetCents <= 0) {
    return {
      targetCents: null,
      toleranceRatio: profile.budgetToleranceRatio,
      minCents: null,
      maxCents: null,
    };
  }
  const tol = Math.min(0.8, Math.max(0.01, profile.budgetToleranceRatio));
  return {
    targetCents: profile.weeklyBudgetCents,
    toleranceRatio: tol,
    minCents: Math.round(profile.weeklyBudgetCents * (1 - tol)),
    maxCents: Math.round(profile.weeklyBudgetCents * (1 + tol)),
  };
}

export function budgetFitScore(
  estimatedCostCents: number,
  profile: ParsedProfile,
  mealCountHint: number
): number {
  if (!profile.weeklyBudgetCents || profile.weeklyBudgetCents <= 0) return 0.05;
  const perMeal = profile.weeklyBudgetCents / Math.max(1, mealCountHint);
  const diff = Math.abs(estimatedCostCents - perMeal);
  const normalized = diff / Math.max(400, perMeal);
  return Math.max(-0.8, 1 - normalized * 1.1);
}

export function enforceWeeklyBudget(
  ranked: ScoredSuggestion[],
  profile: ParsedProfile,
  limit: number
): {
  selected: ScoredSuggestion[];
  estimatedWeeklyCostCents: number;
  budgetPlan: BudgetPlan;
} {
  const budgetPlan = getBudgetPlan(profile);
  if (!budgetPlan.targetCents) {
    const selected = ranked.slice(0, limit);
    const estimatedWeeklyCostCents = selected.reduce(
      (acc, s) => acc + s.budgetImpact.estimatedCostCents,
      0
    );
    return { selected, estimatedWeeklyCostCents, budgetPlan };
  }

  const selected: ScoredSuggestion[] = [];
  let total = 0;
  for (const s of ranked) {
    if (selected.length >= limit) break;
    const c = s.budgetImpact.estimatedCostCents;
    if ((budgetPlan.maxCents ?? Infinity) >= total + c || selected.length < 3) {
      selected.push(s);
      total += c;
    }
  }
  if (selected.length < limit) {
    for (const s of ranked) {
      if (selected.length >= limit) break;
      if (selected.includes(s)) continue;
      selected.push(s);
      total += s.budgetImpact.estimatedCostCents;
    }
  }
  return { selected, estimatedWeeklyCostCents: total, budgetPlan };
}
