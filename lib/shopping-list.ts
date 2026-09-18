import { prisma } from "@/lib/prisma";
import { consolidateIngredients } from "@/lib/ingredients";

export const SHOPPING_CATEGORIES = [
  "produce",
  "meat & seafood",
  "dairy & eggs",
  "pantry",
  "frozen",
  "bakery",
  "household",
  "other",
] as const;

export type ShoppingCategory = (typeof SHOPPING_CATEGORIES)[number];

export function parseWeekStart(value?: string | null): Date {
  if (value && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const parsed = new Date(`${value}T00:00:00.000Z`);
    if (!Number.isNaN(parsed.getTime())) return parsed;
  }
  const now = new Date();
  const day = now.getUTCDay();
  const diff = day === 0 ? -6 : 1 - day;
  const monday = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  monday.setUTCDate(monday.getUTCDate() + diff);
  return monday;
}

export function weekEndExclusive(weekStart: Date): Date {
  const end = new Date(weekStart);
  end.setUTCDate(end.getUTCDate() + 7);
  return end;
}

export function weekStartKey(value: Date): string {
  return value.toISOString().slice(0, 10);
}

export function normalizeShoppingName(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .split(/\s+/)
    .sort()
    .join("");
}

function formatQuantity(quantity: number | null, unit: string | null, fallback: string): string {
  if (quantity == null) return fallback;
  const rounded = Number.isInteger(quantity) ? String(quantity) : String(Number(quantity.toFixed(2)));
  return `${rounded}${unit ? ` ${unit}` : ""}`.trim();
}

export function categoryForIngredient(name: string): ShoppingCategory {
  const value = name.toLowerCase();
  if (/(milk|cheese|yogurt|butter|cream|egg)/.test(value)) return "dairy & eggs";
  if (/(chicken|beef|pork|turkey|salmon|shrimp|fish|tofu)/.test(value)) return "meat & seafood";
  if (/(frozen|ice cream)/.test(value)) return "frozen";
  if (/(bread|bun|tortilla|bagel|croissant)/.test(value)) return "bakery";
  if (/(onion|garlic|tomato|lettuce|spinach|apple|banana|lemon|lime|carrot|pepper|potato|herb|avocado|mushroom)/.test(value)) return "produce";
  if (/(soap|paper towel|toilet paper|detergent|sponge|foil|plastic wrap)/.test(value)) return "household";
  if (/(flour|sugar|rice|pasta|oil|vinegar|salt|pepper|spice|sauce|broth|bean|oat|cereal|coffee|tea)/.test(value)) return "pantry";
  return "other";
}

type Source = {
  recipeId: number;
  title: string;
  ingredientsText: string;
  servings: string;
};

export async function syncShoppingList(userId: number | number[], weekStart: Date) {
  const userIds = Array.isArray(userId) ? userId : [userId];
  const plans = await prisma.weeklyMealPlan.findMany({
    where: {
      userId: { in: userIds },
      plannedFor: { gte: weekStart, lt: weekEndExclusive(weekStart) },
      status: { not: "skipped" },
    },
    include: { recipe: { select: { id: true, title: true, ingredientsText: true, servings: true } } },
    orderBy: { plannedFor: "asc" },
  });

  const sources: Source[] = plans
    .filter((plan) => plan.recipe.ingredientsText.trim())
    .map((plan) => ({
      recipeId: plan.recipe.id,
      title: plan.recipe.title,
      ingredientsText: plan.recipe.ingredientsText,
      servings: plan.recipe.servings,
    }));

  const aggregates = consolidateIngredients(sources);
  const sourceByKey = new Map<string, { ids: number[]; labels: string[] }>();
  for (const source of sources) {
    for (const item of consolidateIngredients([source])) {
      const current = sourceByKey.get(item.nameKey) ?? { ids: [], labels: [] };
      if (!current.ids.includes(source.recipeId)) current.ids.push(source.recipeId);
      if (!current.labels.includes(source.title)) current.labels.push(source.title);
      sourceByKey.set(item.nameKey, current);
    }
  }

  const list = await prisma.shoppingList.upsert({
    where: { userId_weekStart: { userId: userIds[0], weekStart } },
    create: { userId: userIds[0], weekStart },
    update: {},
  });

  const generatedKeys = aggregates.map((item) => item.nameKey || normalizeShoppingName(item.displayName));
  for (const item of aggregates) {
    const nameKey = item.nameKey || normalizeShoppingName(item.displayName);
    const source = sourceByKey.get(item.nameKey) ?? { ids: [], labels: [] };
    await prisma.shoppingListItem.upsert({
      where: { shoppingListId_nameKey: { shoppingListId: list.id, nameKey } },
      create: {
        shoppingListId: list.id,
        nameKey,
        name: item.displayName,
        quantity: formatQuantity(item.totalQuantity, item.unit, item.lines[0] ?? ""),
        category: categoryForIngredient(item.displayName),
        sourceRecipeIds: JSON.stringify(source.ids),
        sourceLabels: JSON.stringify(source.labels),
      },
      update: {
        name: item.displayName,
        quantity: formatQuantity(item.totalQuantity, item.unit, item.lines[0] ?? ""),
        category: categoryForIngredient(item.displayName),
        isManual: false,
        sourceRecipeIds: JSON.stringify(source.ids),
        sourceLabels: JSON.stringify(source.labels),
      },
    });
  }

  const staleWhere = generatedKeys.length
    ? { shoppingListId: list.id, isManual: false, nameKey: { notIn: generatedKeys } }
    : { shoppingListId: list.id, isManual: false };
  await prisma.shoppingListItem.deleteMany({ where: staleWhere });

  const staples = await prisma.shoppingStaple.findMany({ where: { userId: { in: userIds }, active: true }, orderBy: { name: "asc" } });
  for (const staple of staples) {
    if (generatedKeys.includes(staple.nameKey)) continue;
    await prisma.shoppingListItem.upsert({
      where: { shoppingListId_nameKey: { shoppingListId: list.id, nameKey: staple.nameKey } },
      create: {
        shoppingListId: list.id,
        nameKey: staple.nameKey,
        name: staple.name,
        quantity: staple.quantity,
        category: staple.category,
        isManual: true,
        sourceLabels: JSON.stringify(["Saved staple"]),
      },
      update: { name: staple.name, quantity: staple.quantity, category: staple.category, isManual: true },
    });
  }

  return prisma.shoppingList.findUniqueOrThrow({
    where: { id: list.id },
    include: { items: { orderBy: [{ category: "asc" }, { checked: "asc" }, { name: "asc" }] } },
  });
}

export async function getOwnedShoppingList(userId: number | number[], itemId: number) {
  const userIds = Array.isArray(userId) ? userId : [userId];
  return prisma.shoppingListItem.findFirst({
    where: { id: itemId, shoppingList: { userId: { in: userIds } } },
  });
}
