export type SuggestionInput = {
  userId?: number;
  profileName?: string;
  limit?: number;
  includeWebCandidates?: boolean;
  strictFitness?: boolean;
  embeddingEnabled?: boolean;
  llmEnabled?: boolean;
};

export type ParsedProfile = {
  id: number;
  name: string;
  dietaryRestrictions: string[];
  fitnessGoal: string;
  calorieTarget: number | null;
  proteinTarget: number | null;
  carbTarget: number | null;
  fatTarget: number | null;
  preferredDomains: string[];
  blockedDomains: string[];
  favoriteIngredients: string[];
  dislikedIngredients: string[];
  explorationRatio: number;
  weeklyBudgetCents: number | null;
  budgetToleranceRatio: number;
  trustedSourceRatio: number;
};

export type CandidateRecipe = {
  recipeId: number | null;
  sourceUrl: string | null;
  sourceDomain: string;
  title: string;
  description: string;
  ingredientsText: string;
  category: string;
  tags: string;
  createdAt: Date | null;
  isWebCandidate: boolean;
  estimatedCostCents: number | null;
  costConfidence: number;
};

export type CandidateFeatures = {
  ingredientKeys: string[];
  ingredientRaw: string[];
  tagTokens: string[];
  descriptionTokens: string[];
};

export type FeedbackStats = {
  byRecipeId: Record<number, number>;
  byDomain: Record<string, number>;
  ingredientAffinity: Record<string, number>;
  recipeRatings: Record<number, number>;
  cookedCounts: Record<number, number>;
};

export type BehaviorStats = {
  recipeFrequency: Record<number, number>;
  domainAffinity: Record<string, number>;
  ingredientAffinity: Record<string, number>;
  recentCookedRecipeIds: number[];
};

export type PreferenceVector = {
  version: number;
  values: number[];
  dimensions: {
    favoriteIngredients: number;
    preferredDomains: number;
    cookedHistory: number;
    ratings: number;
    exploration: number;
    budgetSensitivity: number;
    healthFocus: number;
  };
};

export type ScoredSuggestion = {
  candidate: CandidateRecipe;
  score: number;
  lane: "repeat_favorite" | "trusted_similar" | "explore";
  reasons: string[];
  components: {
    ingredient: number;
    domain: number;
    fitness: number;
    feedback: number;
    novelty: number;
    exploration: number;
    budget: number;
    similarity: number;
    repeat: number;
    fatigue: number;
  };
  budgetImpact: {
    estimatedCostCents: number;
    confidence: number;
    fitScore: number;
  };
};

export type SuggestionDiagnostics = {
  topIngredients: Array<{ name: string; score: number }>;
  topDomains: Array<{ domain: string; score: number }>;
  mostCookedRecipeIds: number[];
};
