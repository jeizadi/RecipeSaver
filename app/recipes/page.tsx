import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { householdRecipeReadFilter } from "@/lib/access";
import { requireUser } from "@/lib/require-user";

export const dynamic = "force-dynamic";

export default async function RecipesLibraryPage() {
  const user = await requireUser();
  const recipes = await prisma.recipe.findMany({
    where: await householdRecipeReadFilter(user),
    orderBy: [{ title: "asc" }, { createdAt: "desc" }],
    select: { id: true, title: true, category: true, cuisine: true, tags: true, servings: true },
  });

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.16em] text-[#b66a00]">Recipe book</p>
          <h2 className="mt-1 text-3xl font-semibold tracking-tight text-slate-950">Your recipes</h2>
          <p className="mt-2 text-sm text-slate-500">Everything saved to your household library, in one place.</p>
        </div>
        <Link href="/recipes/new" className="rounded-xl bg-[#f4a51c] px-3 py-2 text-sm font-semibold text-[#4a2b00] hover:bg-[#e39a0f]">Add recipe</Link>
      </div>
      {recipes.length ? (
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {recipes.map((recipe) => (
            <li key={recipe.id} className="rounded-2xl border border-[#eadfca] bg-white p-4">
              <h3 className="font-semibold text-slate-900"><Link href={`/recipes/${recipe.id}`} className="hover:underline">{recipe.title}</Link></h3>
              <p className="mt-1 text-xs text-slate-500">{recipe.category}{recipe.cuisine ? ` · ${recipe.cuisine}` : ""}</p>
              {recipe.tags && <p className="mt-2 text-xs text-slate-500">{recipe.tags}</p>}
              {recipe.servings && <p className="mt-2 text-xs text-slate-400">{recipe.servings} servings</p>}
            </li>
          ))}
        </ul>
      ) : (
        <div className="rounded-2xl border border-dashed border-[#d2c2af] bg-white p-8 text-center text-sm text-slate-500">No recipes saved yet. <Link href="/recipes/new" className="text-[#b66a00] underline">Add your first recipe</Link>.</div>
      )}
    </div>
  );
}
