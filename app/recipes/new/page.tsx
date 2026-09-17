import { RecipeForm, type RecipeFormInitial } from "../recipe-form";
import { requireUser } from "@/lib/require-user";

export default async function NewRecipePage({
  searchParams,
}: {
  searchParams: Promise<{ title?: string; sourceUrl?: string }>;
}) {
  await requireUser();
  const params = await searchParams;
  const initial: RecipeFormInitial = {
    title: params.title ?? "",
    sourceUrl: params.sourceUrl ?? "",
    description: "",
    ingredientsText: "",
    instructionsText: "",
    prepTimeMinutes: null,
    cookTimeMinutes: null,
    totalTimeMinutes: null,
    servings: "",
    imageUrl: "",
    author: "",
    category: "other",
    tags: "",
  };
  return (
    <div className="rounded-lg bg-white p-6 shadow-sm">
      <h2 className="mb-4 text-xl font-semibold">Add recipe</h2>
      <RecipeForm initial={initial} />
    </div>
  );
}
