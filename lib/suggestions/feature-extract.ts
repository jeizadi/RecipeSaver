import { ingredientFingerprint, parseIngredientsText } from "@/lib/ingredients";
import type { CandidateFeatures, CandidateRecipe } from "./types";

function splitTokens(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]+/g, " ")
    .split(/\s+/)
    .map((t) => t.trim())
    .filter((t) => t.length >= 3);
}

export function normalizeDomain(url: string | null): string {
  if (!url) return "";
  try {
    const u = new URL(url);
    return u.hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    return "";
  }
}

export function extractCandidateFeatures(candidate: CandidateRecipe): CandidateFeatures {
  const parsed = parseIngredientsText(candidate.ingredientsText);
  const ingredientKeys: string[] = [];
  const ingredientRaw: string[] = [];
  for (const p of parsed) {
    const key = ingredientFingerprint(p);
    if (key) ingredientKeys.push(key);
    if (p.name.trim()) ingredientRaw.push(p.name.trim().toLowerCase());
  }

  return {
    ingredientKeys: Array.from(new Set(ingredientKeys)),
    ingredientRaw: Array.from(new Set(ingredientRaw)),
    tagTokens: splitTokens(candidate.tags),
    descriptionTokens: splitTokens(candidate.description),
  };
}
