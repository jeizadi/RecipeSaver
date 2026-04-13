import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/require-user";
import { IngredientsCopyReadOnly } from "../ingredients-with-copy";

const CATEGORIES: Record<string, string> = {
  breakfast: "Breakfast",
  lunch: "Lunch",
  dinner: "Dinner",
  snack: "Snack",
  dessert: "Dessert",
  drink: "Drink",
  side: "Side",
  sauce: "Sauce",
  other: "Other",
};

export default async function RecipePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requireUser();
  const id = parseInt((await params).id, 10);
  if (!Number.isFinite(id)) notFound();

  const recipe = await prisma.recipe.findFirst({ where: { id, userId: user.id } });
  if (!recipe) notFound();

  const categoryLabel = CATEGORIES[recipe.category] ?? recipe.category;

  return (
    <article className="rounded-lg bg-white p-6 shadow-sm">
      <header className="mb-6">
        <h2 className="text-2xl font-semibold">{recipe.title}</h2>
        <p className="mt-2 flex flex-wrap items-center gap-2 text-sm text-[#7f8c8d]">
          <span className="rounded-full bg-[#fdebd0] px-2 py-0.5">
            {categoryLabel}
          </span>
          {recipe.tags && <span>{recipe.tags}</span>}
        </p>
        <p className="mt-3">
          <a
            href={recipe.sourceUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-block rounded bg-[#e67e22] px-4 py-2 text-sm font-medium text-white hover:bg-[#cf711f]"
          >
            Open source link
          </a>
        </p>
      </header>

      <IngredientsCopyReadOnly text={recipe.ingredientsText} />

      {recipe.instructionsText && (
        <section className="mb-6">
          <h3 className="mb-2 font-medium">Instructions</h3>
          <pre className="whitespace-pre-wrap rounded border border-[#e0d4c7] bg-[#fffdf8] p-4 text-sm">
            {recipe.instructionsText}
          </pre>
        </section>
      )}

      {(recipe.servings ||
        recipe.prepTimeMinutes != null ||
        recipe.cookTimeMinutes != null ||
        recipe.totalTimeMinutes != null ||
        recipe.author ||
        recipe.imageUrl) && (
        <section className="mb-6">
          <h3 className="mb-2 font-medium">Details</h3>
          <ul className="list-inside list-disc space-y-1 text-sm">
            {recipe.author && (
              <li>
                <strong>Author:</strong> {recipe.author}
              </li>
            )}
            {recipe.servings && (
              <li>
                <strong>Servings:</strong> {recipe.servings}
              </li>
            )}
            {recipe.prepTimeMinutes != null && (
              <li>
                <strong>Prep:</strong> {recipe.prepTimeMinutes} min
              </li>
            )}
            {recipe.cookTimeMinutes != null && (
              <li>
                <strong>Cook:</strong> {recipe.cookTimeMinutes} min
              </li>
            )}
            {recipe.totalTimeMinutes != null && (
              <li>
                <strong>Total:</strong> {recipe.totalTimeMinutes} min
              </li>
            )}
            {recipe.imageUrl && (
              <li>
                <strong>Image:</strong>{" "}
                <a
                  href={recipe.imageUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[#e67e22] hover:underline"
                >
                  Open
                </a>
              </li>
            )}
          </ul>
        </section>
      )}

      {recipe.description && (
        <section className="mb-6">
          <h3 className="mb-2 font-medium">Notes</h3>
          <p className="text-sm">{recipe.description}</p>
        </section>
      )}

      <footer className="flex flex-wrap gap-3 border-t border-[#e0d4c7] pt-4">
        <Link
          href={`/recipes/${recipe.id}/edit`}
          className="rounded border border-[#d2c2af] bg-white px-3 py-1.5 text-sm hover:bg-[#f6efe9]"
        >
          Edit
        </Link>
        <Link
          href={`/recipes/${recipe.id}/delete`}
          className="rounded bg-[#c0392b] px-3 py-1.5 text-sm text-white hover:bg-[#a93226]"
        >
          Delete
        </Link>
        <Link
          href="/"
          className="text-sm text-[#5b3b2a] hover:underline"
        >
          Back to list
        </Link>
      </footer>
    </article>
  );
}
