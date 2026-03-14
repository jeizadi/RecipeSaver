import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  consolidateIngredients,
  formatAggregatedForClipboard,
} from "@/lib/ingredients";
import { importRecipeFromUrl } from "@/lib/import-recipe";

type RequestBody = {
  recipeIds?: number[];
  sauceUrls?: string[];
};

export async function POST(request: NextRequest) {
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
        where: { id: { in: recipeIds } },
        select: {
          id: true,
          title: true,
          ingredientsText: true,
        },
      });

      for (const r of recipes) {
        if (!r.ingredientsText.trim()) continue;
        sources.push({
          recipeId: r.id,
          title: r.title,
          ingredientsText: r.ingredientsText,
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

    const items = consolidateIngredients(sources);
    const clipboardText = formatAggregatedForClipboard(items);

    return NextResponse.json({
      ok: true,
      items,
      clipboardText,
    });
  } catch (e) {
    console.error(e);
    return NextResponse.json(
      { ok: false, error: "Failed to build shopping list." },
      { status: 500 }
    );
  }
}

