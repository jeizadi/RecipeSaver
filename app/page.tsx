import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { WeeklyPlannerClient } from "./weekly-planner-client";
import { requireUser } from "@/lib/require-user";
import { HomeFeaturedSuggestions } from "./home-featured-suggestions";

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

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; ingredient?: string; category?: string }>;
}) {
  const user = await requireUser();
  const params = await searchParams;
  const q = params.q?.trim() ?? "";
  const ingredient = params.ingredient?.trim() ?? "";
  const category = params.category?.trim() ?? "";

  let recipes: Awaited<ReturnType<typeof prisma.recipe.findMany>>;
  const featured = await prisma.suggestionItem.findMany({
    where: { run: { profile: { userId: user.id } } },
    orderBy: [{ run: { createdAt: "desc" } }, { score: "desc" }],
    take: 8,
  });

  try {
    const where: Record<string, unknown> = { userId: user.id };
    if (q) where.title = { contains: q, mode: "insensitive" };
    if (ingredient) where.ingredientsText = { contains: ingredient, mode: "insensitive" };
    if (category) where.category = category;
    recipes = await prisma.recipe.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: 80,
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

  let allRecipesCount = recipes.length;
  if (q || ingredient || category) {
    allRecipesCount = await prisma.recipe.count({ where: { userId: user.id } });
  }

  function categoryLabel(cat: string) {
    return CATEGORIES.find((c) => c.value === cat)?.label ?? cat;
  }

  return (
    <>
      <section className="mb-6">
        <h2 className="mb-3 text-xl font-semibold">Recipebox Home</h2>
        <p className="rounded-lg bg-white p-4 text-sm text-[#7f8c8d] shadow-sm">
          Plan your week, build shopping lists, and quickly search recipes right from home.
        </p>
      </section>
      <HomeFeaturedSuggestions
        featured={featured.map((f) => ({
          id: f.id,
          title: f.title,
          sourceDomain: f.sourceDomain,
          recipeId: f.recipeId,
          candidateUrl: f.candidateUrl,
        }))}
      />
      <section className="mb-6">
        <h3 className="mb-2 text-lg font-semibold">Search recipes</h3>
        <form method="get" className="flex flex-wrap items-end gap-3 rounded-lg bg-white p-4 shadow-sm">
          <label className="flex flex-col gap-1">
            <span className="text-sm font-medium">Title</span>
            <input type="text" name="q" defaultValue={q} className="rounded border border-[#d2c2af] px-2 py-1.5 text-sm" />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-sm font-medium">Ingredient</span>
            <input type="text" name="ingredient" defaultValue={ingredient} className="rounded border border-[#d2c2af] px-2 py-1.5 text-sm" />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-sm font-medium">Category</span>
            <select name="category" defaultValue={category} className="rounded border border-[#d2c2af] px-2 py-1.5 text-sm">
              {CATEGORIES.map((c) => (
                <option key={c.value || "any"} value={c.value}>{c.label}</option>
              ))}
            </select>
          </label>
          <button type="submit" className="rounded bg-[#e67e22] px-3 py-1.5 text-sm font-medium text-white hover:bg-[#cf711f]">Search</button>
          {(q || ingredient || category) && (
            <Link href="/" className="text-sm underline">Clear</Link>
          )}
        </form>
        {(q || ingredient || category) && (
          <p className="mt-2 text-sm text-[#7f8c8d]">
            Showing {recipes.length} matching recipes{allRecipesCount ? ` out of ${allRecipesCount}` : ""}.
          </p>
        )}
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
                servings: r.servings,
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
