import Link from "next/link";
import { prisma } from "@/lib/prisma";
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
  const where: Record<string, unknown> = { userId: user.id };
  if (q) where.title = { contains: q, mode: "insensitive" };
  if (ingredient) where.ingredientsText = { contains: ingredient, mode: "insensitive" };
  if (category) where.category = category;

  const recipes = await prisma.recipe.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: 80,
  });

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-semibold">Search recipes</h2>
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
      </form>
      <ul className="grid gap-3 sm:grid-cols-2">
        {recipes.map((r) => (
          <li key={r.id} className="rounded-lg bg-white p-4 shadow-sm">
            <h3 className="font-semibold"><Link href={`/recipes/${r.id}`} className="hover:underline">{r.title}</Link></h3>
            <p className="text-xs text-[#7f8c8d]">{r.category} {r.tags ? `· ${r.tags}` : ""}</p>
          </li>
        ))}
      </ul>
    </div>
  );
}
