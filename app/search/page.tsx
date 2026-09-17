import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { recipeReadFilter } from "@/lib/access";
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

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; ingredient?: string; category?: string }>;
}) {
  const user = await requireUser();
  const params = await searchParams;
  const q = params.q?.trim() ?? "";
  const ingredient = params.ingredient?.trim() ?? "";
  const category = params.category?.trim() ?? "";
  const where: Record<string, unknown> = { ...recipeReadFilter(user) };
  if (q) where.title = { contains: q, mode: "insensitive" };
  if (ingredient) where.ingredientsText = { contains: ingredient, mode: "insensitive" };
  if (category) where.category = category;

  const recipes = await prisma.recipe.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: 80,
  });

  return (
    <div className="space-y-5">
      <div>
        <p className="text-sm font-semibold uppercase tracking-[0.16em] text-[#b66a00]">Recipe book</p>
        <h2 className="mt-1 text-3xl font-semibold tracking-tight text-slate-950">Find a recipe</h2>
      </div>
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
      </form>
      <ul className="grid gap-3 sm:grid-cols-2">
        {recipes.map((r) => (
          <li key={r.id} className="rounded-2xl border border-[#eadfca] bg-white p-4 shadow-none">
            <h3 className="font-semibold"><Link href={`/recipes/${r.id}`} className="hover:underline">{r.title}</Link></h3>
            <p className="text-xs text-[#7f8c8d]">{r.category} {r.tags ? `· ${r.tags}` : ""}</p>
          </li>
        ))}
      </ul>
    </div>
  );
}
