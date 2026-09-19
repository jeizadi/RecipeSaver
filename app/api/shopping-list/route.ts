import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  consolidateIngredients,
  formatAggregatedForClipboard,
} from "@/lib/ingredients";
import { importRecipeFromUrl } from "@/lib/import-recipe";
import { parseBaseServings, scaleIngredientsText } from "@/lib/ingredient-scale";
import { refineAggregatedItemsWithLlm } from "@/lib/shopping-list-llm";
import { getRequestUser, householdRecipeReadFilter } from "@/lib/access";
import { getHouseholdUserIds } from "@/lib/households";
import {
  categoryForIngredient,
  getOwnedShoppingList,
  normalizeShoppingName,
  parseWeekStart,
  SHOPPING_CATEGORIES,
  syncShoppingList,
} from "@/lib/shopping-list";

type RequestBody = {
  action?: "sync" | "add";
  weekStart?: string;
  name?: string;
  quantity?: string;
  category?: string;
  saveAsStaple?: boolean;
  recipeIds?: number[];
  sauceUrls?: string[];
  /** When true and GEMINI_API_KEY or OPENAI_API_KEY is set, run an optional LLM merge pass */
  useAiMerge?: boolean;
  plannedServingsByRecipe?: Record<string, number>;
};

export async function GET(request: NextRequest) {
  const user = await getRequestUser(request);
  if (!user) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  const householdUserIds = await getHouseholdUserIds(user.id);
  const weekStart = parseWeekStart(request.nextUrl.searchParams.get("weekStart"));
  const list = await syncShoppingList(householdUserIds, weekStart);
  return NextResponse.json({ ok: true, weekStart: weekStart.toISOString().slice(0, 10), list });
}

export async function POST(request: NextRequest) {
  const user = await getRequestUser(request);
  if (!user) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }
  const householdUserIds = await getHouseholdUserIds(user.id);
  let body: RequestBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { ok: false, error: "Invalid JSON body" },
      { status: 400 }
    );
  }

  if (body.action === "sync") {
    const weekStart = parseWeekStart(body.weekStart);
    const list = await syncShoppingList(householdUserIds, weekStart);
    return NextResponse.json({ ok: true, weekStart: weekStart.toISOString().slice(0, 10), list });
  }

  if (body.action === "add") {
    const name = typeof body.name === "string" ? body.name.trim() : "";
    if (!name) return NextResponse.json({ ok: false, error: "Item name is required." }, { status: 400 });
    const normalized = consolidateIngredients([{ ingredientsText: name }])[0];
    const normalizedLine = normalized ? formatAggregatedForClipboard([normalized]) : name;
    const normalizedName = normalized?.displayName ?? name;
    const normalizedQuantity = normalized
      ? normalizedLine.replace(new RegExp(`${normalizedName}s?$`, "i"), "").trim()
      : body.quantity?.trim() ?? "";
    const category = SHOPPING_CATEGORIES.includes(body.category as (typeof SHOPPING_CATEGORIES)[number])
      ? body.category!
      : categoryForIngredient(normalizedName);
    const weekStart = parseWeekStart(body.weekStart);
    const list = await prisma.shoppingList.upsert({
      where: { userId_weekStart: { userId: householdUserIds[0], weekStart } },
      create: { userId: householdUserIds[0], weekStart },
      update: {},
    });
    const nameKey = normalized?.nameKey ?? normalizeShoppingName(normalizedName);
    const item = await prisma.shoppingListItem.upsert({
      where: { shoppingListId_nameKey: { shoppingListId: list.id, nameKey } },
      create: {
        shoppingListId: list.id,
        nameKey,
        name: normalizedName,
        quantity: normalizedQuantity || body.quantity?.trim() || "",
        category,
        isManual: true,
        sourceLabels: JSON.stringify(["Added manually"]),
      },
      update: { name: normalizedName, quantity: normalizedQuantity || body.quantity?.trim() || "", category, isManual: true },
    });
    if (body.saveAsStaple) {
      await prisma.shoppingStaple.upsert({
        where: { userId_nameKey: { userId: householdUserIds[0], nameKey } },
        create: { userId: householdUserIds[0], name: normalizedName, nameKey, quantity: normalizedQuantity || body.quantity?.trim() || "", category },
        update: { name: normalizedName, quantity: normalizedQuantity || body.quantity?.trim() || "", category, active: true },
      });
    }
    return NextResponse.json({ ok: true, item });
  }

  const recipeIds =
    Array.isArray(body.recipeIds) && body.recipeIds.length
      ? body.recipeIds
          .map((id) => Number(id))
          .filter((id) => Number.isInteger(id) && id > 0)
      : [];

  const sauceUrls =
    Array.isArray(body.sauceUrls) && body.sauceUrls.length
      ? Array.from(
          new Set(
            body.sauceUrls
              .map((u) => (typeof u === "string" ? u.trim() : ""))
              .filter((u) => u)
          )
        )
      : [];
  const plannedServingsByRecipe = body.plannedServingsByRecipe ?? {};

  if (!recipeIds.length && !sauceUrls.length) {
    return NextResponse.json(
      { ok: false, error: "Provide at least one recipeId or sauce URL." },
      { status: 400 }
    );
  }

  try {
    const sources: {
      recipeId?: number;
      title?: string;
      ingredientsText: string;
    }[] = [];

    if (recipeIds.length) {
      const recipes = await prisma.recipe.findMany({
        where: { id: { in: recipeIds }, ...await householdRecipeReadFilter(user) },
        select: {
          id: true,
          title: true,
          ingredientsText: true,
          servings: true,
        },
      });

      for (const r of recipes) {
        if (!r.ingredientsText.trim()) continue;
        const targetServings = Number((plannedServingsByRecipe as Record<string, unknown>)[String(r.id)]);
        const baseServings = parseBaseServings(r.servings);
        const scaleFactor =
          baseServings && Number.isFinite(targetServings) && targetServings > 0
            ? targetServings / baseServings
            : 1;
        sources.push({
          recipeId: r.id,
          title: r.title,
          ingredientsText:
            scaleFactor === 1
              ? r.ingredientsText
              : scaleIngredientsText(r.ingredientsText, scaleFactor),
        });
      }
    }

    if (sauceUrls.length) {
      // Best-effort: use the same importer as the main import endpoint.
      for (const url of sauceUrls) {
        try {
          const imported = await importRecipeFromUrl(url);
          if (!imported.ingredientsText) continue;
          sources.push({
            title: imported.title ?? url,
            ingredientsText: imported.ingredientsText,
          });
        } catch (e) {
          // Ignore individual sauce failures but log for debugging.
          console.error("Failed to import sauce recipe", url, e);
        }
      }
    }

    if (!sources.length) {
      return NextResponse.json(
        {
          ok: false,
          error: "No ingredients found for the selected recipes.",
        },
        { status: 422 }
      );
    }

    let items = consolidateIngredients(sources);
    let clipboardText = formatAggregatedForClipboard(items);

    let aiMergeApplied = false;
    let aiMergeError: string | null = null;
    if (body.useAiMerge === true) {
      const refined = await refineAggregatedItemsWithLlm(items);
      if (refined.ok) {
        items = refined.items.sort((a, b) =>
          a.displayName.localeCompare(b.displayName)
        );
        clipboardText = formatAggregatedForClipboard(items);
        aiMergeApplied = true;
      } else {
        aiMergeError = refined.error;
      }
    }

    return NextResponse.json({
      ok: true,
      items,
      clipboardText,
      aiMergeApplied,
      aiMergeError,
    });
  } catch (e) {
    console.error(e);
    return NextResponse.json(
      { ok: false, error: "Failed to build shopping list." },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest) {
  const user = await getRequestUser(request);
  if (!user) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  const householdUserIds = await getHouseholdUserIds(user.id);
  const body = (await request.json().catch(() => null)) as {
    id?: number;
    checked?: boolean;
    name?: string;
    quantity?: string;
    category?: string;
  } | null;
  const id = Number(body?.id);
  if (!Number.isInteger(id) || id < 1) return NextResponse.json({ ok: false, error: "Valid item id is required." }, { status: 400 });
  const existing = await getOwnedShoppingList(householdUserIds, id);
  if (!existing) return NextResponse.json({ ok: false, error: "Shopping item not found." }, { status: 404 });
  const item = await prisma.shoppingListItem.update({
    where: { id },
    data: {
      ...(typeof body?.checked === "boolean" ? { checked: body.checked } : {}),
      ...(typeof body?.name === "string" && body.name.trim() ? { name: body.name.trim() } : {}),
      ...(typeof body?.quantity === "string" ? { quantity: body.quantity.trim() } : {}),
      ...(typeof body?.category === "string" && SHOPPING_CATEGORIES.includes(body.category as (typeof SHOPPING_CATEGORIES)[number])
        ? { category: body.category }
        : {}),
    },
  });
  return NextResponse.json({ ok: true, item });
}

export async function DELETE(request: NextRequest) {
  const user = await getRequestUser(request);
  if (!user) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  const householdUserIds = await getHouseholdUserIds(user.id);
  const id = Number(request.nextUrl.searchParams.get("id"));
  if (!Number.isInteger(id) || id < 1) return NextResponse.json({ ok: false, error: "Valid item id is required." }, { status: 400 });
  const existing = await getOwnedShoppingList(householdUserIds, id);
  if (!existing) return NextResponse.json({ ok: false, error: "Shopping item not found." }, { status: 404 });
  await prisma.shoppingListItem.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
