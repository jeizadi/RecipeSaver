import { prisma } from "@/lib/prisma";
import { normalizeDomain } from "./feature-extract";
import type { CandidateRecipe } from "./types";

export async function getCandidatePool(includeWebCandidates: boolean, userId?: number): Promise<CandidateRecipe[]> {
  const recipes = await prisma.recipe.findMany({
    where: userId != null ? { userId } : undefined,
    orderBy: { createdAt: "desc" },
    take: 300,
  });

  const local: CandidateRecipe[] = recipes.map((r) => ({
    recipeId: r.id,
    sourceUrl: r.sourceUrl,
    sourceDomain: normalizeDomain(r.sourceUrl),
    title: r.title,
    description: r.description,
    ingredientsText: r.ingredientsText,
    category: r.category,
    tags: r.tags,
    createdAt: r.createdAt,
    isWebCandidate: false,
  }));

  if (!includeWebCandidates) {
    return local;
  }

  const web = await prisma.webRecipeCandidate.findMany({
    where: {
      OR: [{ importedRecipeId: null }, { importedRecipeId: { not: null } }],
    },
    orderBy: [{ confidence: "desc" }, { createdAt: "desc" }],
    take: 180,
  });

  const existingUrls = new Set(
    local.map((x) => (x.sourceUrl ?? "").trim().toLowerCase()).filter(Boolean)
  );

  const webMapped: CandidateRecipe[] = [];
  for (const w of web) {
    const normalizedUrl = (w.sourceUrl ?? "").trim().toLowerCase();
    if (normalizedUrl && existingUrls.has(normalizedUrl)) {
      continue;
    }
    webMapped.push({
      recipeId: w.importedRecipeId ?? null,
      sourceUrl: w.sourceUrl,
      sourceDomain: w.sourceDomain || normalizeDomain(w.sourceUrl),
      title: w.title,
      description: w.description,
      ingredientsText: w.ingredientsText,
      category: w.category,
      tags: w.tags,
      createdAt: w.createdAt,
      isWebCandidate: true,
    });
  }

  return [...local, ...webMapped];
}
