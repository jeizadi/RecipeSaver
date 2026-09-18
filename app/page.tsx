import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { WeeklyPlannerClient } from "./weekly-planner-client";
import { AUTH_ENABLED } from "@/lib/auth-config";
import { householdRecipeReadFilter } from "@/lib/access";
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
    where: AUTH_ENABLED
      ? { run: { profile: { userId: user.id } } }
      : { run: { profile: { name: "default" } } },
    orderBy: [{ run: { createdAt: "desc" } }, { score: "desc" }],
    take: 8,
  });

  try {
    const where: Record<string, unknown> = { ...await householdRecipeReadFilter(user) };
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
      <div className="rounded-2xl border border-[#eadfca] bg-[#fffdf8] p-6 text-[#8a5200]">
        <p className="font-medium">Could not load recipes</p>
        <p className="mt-1 text-sm">Check your database connection and try again.</p>
        <Link href="/" className="mt-3 inline-block text-sm text-amber-700 underline">Retry</Link>
      </div>
    );
  }

  let allRecipesCount = recipes.length;
  if (q || ingredient || category) {
    allRecipesCount = await prisma.recipe.count({ where: await householdRecipeReadFilter(user) });
  }

  function categoryLabel(cat: string) {
    return CATEGORIES.find((c) => c.value === cat)?.label ?? cat;
  }

  return (
    <>
      <section className="mb-6">
        <p className="text-sm font-semibold uppercase tracking-[0.16em] text-[#b66a00]">Recipe book</p>
        <h2 className="mt-1 text-3xl font-semibold tracking-tight text-slate-950">What sounds good?</h2>
        <p className="mt-2 text-sm text-slate-500">
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
        <h3 className="mb-2 text-lg font-semibold text-slate-900">Find a recipe</h3>
        <form method="get" className="flex flex-wrap items-end gap-3 rounded-2xl border border-[#eadfca] bg-white p-4 shadow-none">
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
          <button type="submit" className="rounded-xl bg-[#f4a51c] px-3 py-2 text-sm font-semibold text-[#4a2b00] hover:bg-[#e39a0f]">Search</button>
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
          <p className="rounded-2xl border border-[#eadfca] bg-white p-8 text-center text-slate-500">
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
