import Link from "next/link";
import { prisma } from "@/lib/prisma";

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

const PAGE_SIZE = 20;

export const dynamic = "force-dynamic";

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; ingredient?: string; category?: string; page?: string }>;
}) {
  const params = await searchParams;
  const q = params.q?.trim() ?? "";
  const ingredient = params.ingredient?.trim() ?? "";
  const category = params.category?.trim() ?? "";
  const page = Math.max(1, parseInt(params.page ?? "1", 10));

  const where: Record<string, unknown> = {};
  if (q) where.title = { contains: q, mode: "insensitive" };
  if (ingredient)
    where.ingredientsText = { contains: ingredient, mode: "insensitive" };
  if (category) where.category = category;

  let recipes: Awaited<ReturnType<typeof prisma.recipe.findMany>>;
  let total: number;
  try {
    [recipes, total] = await Promise.all([
      prisma.recipe.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * PAGE_SIZE,
        take: PAGE_SIZE,
      }),
      prisma.recipe.count({ where }),
    ]);
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

  const totalPages = Math.ceil(total / PAGE_SIZE);
  function buildSearchParams(overrides: { page?: number } = {}) {
    const sp = new URLSearchParams();
    if (q) sp.set("q", q);
    if (ingredient) sp.set("ingredient", ingredient);
    if (category) sp.set("category", category);
    if (overrides.page != null) sp.set("page", String(overrides.page));
    return sp;
  }

  function categoryLabel(cat: string) {
    return CATEGORIES.find((c) => c.value === cat)?.label ?? cat;
  }

  return (
    <>
      <section className="mb-6">
        <h2 className="mb-3 text-xl font-semibold">Your recipes</h2>
        <form method="get" className="flex flex-wrap items-end gap-3 rounded-lg bg-white p-4 shadow-sm">
          <label className="flex flex-col gap-1">
            <span className="text-sm font-medium">Title</span>
            <input
              type="text"
              name="q"
              defaultValue={q}
              placeholder="Search by name"
              className="rounded border border-[#d2c2af] px-2 py-1.5 text-sm"
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-sm font-medium">Ingredient</span>
            <input
              type="text"
              name="ingredient"
              defaultValue={ingredient}
              placeholder="e.g. chocolate"
              className="rounded border border-[#d2c2af] px-2 py-1.5 text-sm"
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-sm font-medium">Category</span>
            <select
              name="category"
              defaultValue={category}
              className="rounded border border-[#d2c2af] px-2 py-1.5 text-sm"
            >
              {CATEGORIES.map((c) => (
                <option key={c.value || "any"} value={c.value}>
                  {c.label}
                </option>
              ))}
            </select>
          </label>
          <input type="hidden" name="page" value="1" />
          <button
            type="submit"
            className="rounded bg-[#e67e22] px-3 py-1.5 text-sm font-medium text-white hover:bg-[#cf711f]"
          >
            Search
          </button>
          <Link
            href="/"
            className="rounded border border-[#d2c2af] bg-white px-3 py-1.5 text-sm hover:bg-[#f6efe9]"
          >
            Clear
          </Link>
        </form>
        {(q || ingredient || category) && (
          <p className="mt-2 text-sm text-[#7f8c8d]">
            Showing results
            {q && ` matching title "${q}"`}
            {ingredient && ` with ingredient "${ingredient}"`}
            {category && ` in category "${categoryLabel(category)}"`}
          </p>
        )}
      </section>

      <section>
        {recipes.length > 0 ? (
          <>
            <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {recipes.map((r) => (
                <li
                  key={r.id}
                  className="rounded-lg bg-white p-4 shadow-sm transition hover:shadow"
                >
                  <h3 className="font-semibold">
                    <Link
                      href={`/recipes/${r.id}`}
                      className="text-[#5b3b2a] hover:underline"
                    >
                      {r.title}
                    </Link>
                  </h3>
                  <p className="mt-1 flex flex-wrap items-center gap-2 text-sm text-[#7f8c8d]">
                    <span className="rounded-full bg-[#fdebd0] px-2 py-0.5 text-xs">
                      {categoryLabel(r.category)}
                    </span>
                    {r.tags && <span>{r.tags}</span>}
                  </p>
                  {r.description && (
                    <p className="mt-2 line-clamp-2 text-sm text-zinc-600">
                      {r.description}
                    </p>
                  )}
                </li>
              ))}
            </ul>
            {totalPages > 1 && (
              <div className="mt-4 flex items-center gap-3">
                {page > 1 && (
                  <Link
                    href={`/?${buildSearchParams({ page: page - 1 }).toString()}`}
                    className="text-sm text-[#5b3b2a] hover:underline"
                  >
                    Previous
                  </Link>
                )}
                <span className="text-sm text-[#7f8c8d]">
                  Page {page} of {totalPages}
                </span>
                {page < totalPages && (
                  <Link
                    href={`/?${buildSearchParams({ page: page + 1 }).toString()}`}
                    className="text-sm text-[#5b3b2a] hover:underline"
                  >
                    Next
                  </Link>
                )}
              </div>
            )}
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
