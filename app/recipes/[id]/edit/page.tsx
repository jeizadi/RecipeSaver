import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { RecipeForm } from "../../recipe-form";

export default async function EditRecipePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const id = parseInt((await params).id, 10);
  if (!Number.isFinite(id)) notFound();
  const recipe = await prisma.recipe.findUnique({ where: { id } });
  if (!recipe) notFound();

  return (
    <div className="rounded-lg bg-white p-6 shadow-sm">
      <h2 className="mb-4 text-xl font-semibold">Edit recipe</h2>
      <RecipeForm
        recipeId={recipe.id}
        initial={{
          title: recipe.title,
          sourceUrl: recipe.sourceUrl,
          description: recipe.description,
          ingredientsText: recipe.ingredientsText,
          instructionsText: recipe.instructionsText,
          prepTimeMinutes: recipe.prepTimeMinutes,
          cookTimeMinutes: recipe.cookTimeMinutes,
          totalTimeMinutes: recipe.totalTimeMinutes,
          servings: recipe.servings,
          imageUrl: recipe.imageUrl,
          author: recipe.author,
          category: recipe.category,
          tags: recipe.tags,
        }}
      />
    </div>
  );
}
