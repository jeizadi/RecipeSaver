import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { WeeklyPlannerClient } from "./weekly-planner-client";
import { requireUser } from "@/lib/require-user";

const CATEGORIES = [
  { value: "", label: "Any" },
  { value: "breakfast", label: "Breakfast" },
  { value: "lunch", label: "Lunch" },
  { value: "dinner", label: "Dinner" },
  { value: "snack", label: "Snack" },
  { value: "dessert", label: "Dessert" },
  { value: "drink", label: "Drink" },
  { value: "side", label: "Side" },
  { value: "sauce", label: "Sauce" },
  { value: "other", label: "Other" },
];

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const user = await requireUser();

  let recipes: Awaited<ReturnType<typeof prisma.recipe.findMany>>;
  const featured = await prisma.suggestionItem.findMany({
    where: { run: { profile: { userId: user.id } } },
    orderBy: [{ run: { createdAt: "desc" } }, { score: "desc" }],
    take: 8,
  });

  try {
    recipes = await prisma.recipe.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
      take: 40,
    });
  } catch (err) {
    console.error("HomePage DB error:", err);
    return (
      <div className="rounded-lg bg-amber-50 border border-amber-200 p-6 text-amber-800">
        <p className="font-medium">Could not load recipes</p>
        <p className="mt-1 text-sm">Check your database connection and try again.</p>
        <Link href="/" className="mt-3 inline-block text-sm text-amber-700 underline">Retry</Link>
      </div>
    );
  }

  function categoryLabel(cat: string) {
    return CATEGORIES.find((c) => c.value === cat)?.label ?? cat;
  }

  return (
    <>
      <section className="mb-6">
        <h2 className="mb-3 text-xl font-semibold">Recipebox Home</h2>
        <p className="rounded-lg bg-white p-4 text-sm text-[#7f8c8d] shadow-sm">
          Search is now in its own tab. Use <Link href="/search" className="underline">Search</Link> for discovery, and use the featured suggestions below to quickly import or try new recipes.
        </p>
      </section>
      <section className="mb-6">
        <h3 className="mb-2 text-lg font-semibold">Featured suggestion candidates</h3>
        <div className="grid gap-2 sm:grid-cols-2">
          {featured.length ? featured.map((f) => (
            <div key={f.id} className="rounded border border-[#e0d4c7] bg-white p-3">
              <p className="text-sm font-medium">{f.title}</p>
              <p className="text-xs text-[#7f8c8d]">{f.sourceDomain || "unknown source"}</p>
              <div className="mt-2 flex gap-2">
                {f.recipeId ? (
                  <Link href={`/recipes/${f.recipeId}`} className="text-xs underline">Open</Link>
                ) : f.candidateUrl ? (
                  <form action="/api/recipes/import-and-save" method="post">
                    <input type="hidden" name="url" value={f.candidateUrl} />
                    <button className="text-xs underline" type="submit">Import to library</button>
                  </form>
                ) : null}
                {f.candidateUrl && (
                  <a href={f.candidateUrl} target="_blank" rel="noopener noreferrer" className="text-xs underline">Source</a>
                )}
              </div>
            </div>
          )) : (
            <p className="text-sm text-[#7f8c8d]">No suggestion run yet. Use the suggestion controls below to generate one.</p>
          )}
        </div>
      </section>

      <section>
        {recipes.length > 0 ? (
          <>
            <WeeklyPlannerClient
              recipes={recipes.map((r) => ({
                id: r.id,
                title: r.title,
                category: categoryLabel(r.category),
                tags: r.tags,
                description: r.description,
                ingredientsText: r.ingredientsText,
              }))}
            />
          </>
        ) : (
          <p className="rounded-lg bg-white p-6 text-center text-[#7f8c8d]">
            No recipes yet.{" "}
            <Link href="/recipes/new" className="text-[#e67e22] hover:underline">
              Add your first one
            </Link>
            .
          </p>
        )}
      </section>
    </>
  );
}
