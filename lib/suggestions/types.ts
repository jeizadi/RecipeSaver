export type SuggestionInput = {
  userId?: number;
  profileName?: string;
  limit?: number;
  includeWebCandidates?: boolean;
  strictFitness?: boolean;
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
};

export type ScoredSuggestion = {
  candidate: CandidateRecipe;
  score: number;
  reasons: string[];
  components: {
    ingredient: number;
    domain: number;
    fitness: number;
    feedback: number;
    novelty: number;
    exploration: number;
  };
};
