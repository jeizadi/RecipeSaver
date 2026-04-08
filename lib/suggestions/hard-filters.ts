import { extractCandidateFeatures } from "./feature-extract";
import type { CandidateRecipe, ParsedProfile } from "./types";

function containsAny(text: string, needles: string[]): boolean {
  const low = text.toLowerCase();
  return needles.some((n) => n && low.includes(n));
}

export function passesHardDietaryFilters(
  candidate: CandidateRecipe,
  profile: ParsedProfile
): { ok: boolean; reason?: string } {
  const restrictions = profile.dietaryRestrictions.map((x) => x.toLowerCase());
  if (restrictions.length === 0) return { ok: true };

  const features = extractCandidateFeatures(candidate);
  const body = `${candidate.title}\n${candidate.ingredientsText}\n${candidate.tags}\n${features.ingredientRaw.join(" ")}`.toLowerCase();

  const has = (terms: string[]) => containsAny(body, terms);

  if (restrictions.includes("vegan")) {
    if (has(["egg", "milk", "cheese", "butter", "yogurt", "honey", "cream", "worcestershire"])) {
      return { ok: false, reason: "Not vegan" };
    }
  }
  if (restrictions.includes("vegetarian")) {
    if (has(["chicken", "beef", "pork", "fish", "anchovy", "bacon", "sausage", "turkey"])) {
      return { ok: false, reason: "Contains meat or fish" };
    }
  }
  if (restrictions.includes("gluten-free")) {
    if (has(["flour", "bread", "wheat", "pasta", "breadcrumbs", "soy sauce"])) {
      return { ok: false, reason: "Likely contains gluten" };
    }
  }
  if (restrictions.includes("dairy-free")) {
    if (has(["milk", "cheese", "butter", "cream", "yogurt"])) {
      return { ok: false, reason: "Likely contains dairy" };
    }
  }
  if (restrictions.includes("nut-free")) {
    if (has(["almond", "walnut", "pecan", "cashew", "hazelnut", "peanut"])) {
      return { ok: false, reason: "Likely contains nuts" };
    }
  }

  return { ok: true };
}

export function isBlockedDomain(candidate: CandidateRecipe, profile: ParsedProfile): boolean {
  if (!candidate.sourceDomain) return false;
  return profile.blockedDomains.includes(candidate.sourceDomain.toLowerCase());
}
