import { RecipeForm } from "../recipe-form";

export default function NewRecipePage() {
  return (
    <div className="rounded-lg bg-white p-6 shadow-sm">
      <h2 className="mb-4 text-xl font-semibold">Add recipe</h2>
      <RecipeForm />
    </div>
  );
}
