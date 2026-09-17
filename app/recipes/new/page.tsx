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
    <div className="rounded-2xl border border-[#eadfca] bg-[#fffdf8] p-6 shadow-none sm:p-8">
      <p className="text-sm font-semibold uppercase tracking-[0.16em] text-[#b66a00]">Recipe box</p>
      <h2 className="mt-1 text-3xl font-semibold tracking-tight text-slate-950">Add a recipe</h2>
      <p className="mt-2 mb-6 text-sm text-slate-500">
        Paste a recipe link to import it, or fill in the details by hand.
      </p>
      <RecipeForm initial={initial} autoImport={Boolean(params.sourceUrl)} />
    </div>
  );
}
