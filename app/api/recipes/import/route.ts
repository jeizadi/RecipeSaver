import { NextRequest, NextResponse } from "next/server";
import {
  importRecipeFromUrl,
  RecipeImportError,
} from "@/lib/import-recipe";
import { getCurrentUserFromRequest } from "@/lib/auth";

export async function POST(request: NextRequest) {
  const user = await getCurrentUserFromRequest(request);
  if (!user) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }
  let body: { url?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { ok: false, error: "Invalid JSON body" },
      { status: 400 }
    );
  }
  const url = typeof body?.url === "string" ? body.url.trim() : "";
  if (!url) {
    return NextResponse.json(
      { ok: false, error: "Please provide a URL to import." },
      { status: 400 }
    );
  }
  try {
    const imported = await importRecipeFromUrl(url);
    return NextResponse.json({
      ok: true,
      data: {
        title: imported.title,
        ingredientsText: imported.ingredientsText,
        instructionsText: imported.instructionsText,
        prepTimeMinutes: imported.prepTimeMinutes,
        cookTimeMinutes: imported.cookTimeMinutes,
        totalTimeMinutes: imported.totalTimeMinutes,
        servings: imported.servings,
        imageUrl: imported.imageUrl,
        author: imported.author,
        category: imported.category,
      },
    });
  } catch (err) {
    if (err instanceof RecipeImportError) {
      return NextResponse.json(
        { ok: false, error: err.message },
        { status: 422 }
      );
    }
    return NextResponse.json(
      {
        ok: false,
        error:
          "Import failed (site may block automated access). Try again or fill manually.",
      },
      { status: 502 }
    );
  }
}
