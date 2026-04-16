import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  consolidateIngredients,
  formatAggregatedForClipboard,
} from "@/lib/ingredients";
import { importRecipeFromUrl } from "@/lib/import-recipe";
import { parseBaseServings, scaleIngredientsText } from "@/lib/ingredient-scale";
import { refineAggregatedItemsWithLlm } from "@/lib/shopping-list-llm";
import { getCurrentUserFromRequest } from "@/lib/auth";

type RequestBody = {
  recipeIds?: number[];
  sauceUrls?: string[];
  /** When true and GEMINI_API_KEY or OPENAI_API_KEY is set, run an optional LLM merge pass */
  useAiMerge?: boolean;
  plannedServingsByRecipe?: Record<string, number>;
};

export async function POST(request: NextRequest) {
  const user = await getCurrentUserFromRequest(request);
  if (!user) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }
  let body: RequestBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { ok: false, error: "Invalid JSON body" },
      { status: 400 }
    );
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
        where: { id: { in: recipeIds }, userId: user.id },
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

