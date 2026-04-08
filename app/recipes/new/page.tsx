import { RecipeForm } from "../recipe-form";
import { requireUser } from "@/lib/require-user";

export default async function NewRecipePage() {
  await requireUser();
  return (
    <div className="rounded-lg bg-white p-6 shadow-sm">
      <h2 className="mb-4 text-xl font-semibold">Add recipe</h2>
      <RecipeForm />
    </div>
  );
}
