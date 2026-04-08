import { NextRequest, NextResponse } from "next/server";
import {
  importRecipeFromUrl,
  RecipeImportError,
} from "@/lib/import-recipe";
import { appendMergedRecipeBlocks } from "@/lib/merge-recipe-text";
import { normalizeUrlForMatch } from "@/lib/recipe-link-heuristics";
import { getCurrentUserFromRequest } from "@/lib/auth";

export async function POST(request: NextRequest) {
  const user = await getCurrentUserFromRequest(request);
  if (!user) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, {
      status: 401,
    });
  }
  let body: {
    url?: unknown;
    ingredientsText?: unknown;
    instructionsText?: unknown;
    /** Main recipe URL (optional) — blocks merging the same page into itself */
    sourceUrl?: unknown;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON body" }, {
      status: 400,
    });
  }

  const url = typeof body.url === "string" ? body.url.trim() : "";
  if (!url || (!url.startsWith("http://") && !url.startsWith("https://"))) {
    return NextResponse.json(
      { ok: false, error: "A valid http(s) URL is required." },
      { status: 400 }
    );
  }

  const parentIngredients =
    typeof body.ingredientsText === "string" ? body.ingredientsText : "";
  const parentInstructions =
    typeof body.instructionsText === "string" ? body.instructionsText : "";

  const sourceUrlStr =
    typeof body.sourceUrl === "string" ? body.sourceUrl.trim() : "";
  if (sourceUrlStr.startsWith("http://") || sourceUrlStr.startsWith("https://")) {
    try {
      if (normalizeUrlForMatch(url) === normalizeUrlForMatch(sourceUrlStr)) {
        return NextResponse.json(
          {
            ok: false,
            error: "That link is this recipe’s page — pick a different recipe to merge.",
          },
          { status: 400 }
        );
      }
    } catch {
      // ignore compare errors
    }
  }

  try {
    const imported = await importRecipeFromUrl(url);
    const { ingredientsText, instructionsText } = appendMergedRecipeBlocks(
      parentIngredients,
      parentInstructions,
      imported.title,
      imported.ingredientsText,
      imported.instructionsText
    );

    return NextResponse.json({
      ok: true,
      ingredientsText,
      instructionsText,
      mergedTitle: imported.title,
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
          "Could not import that page (site may block access). Open the link and paste manually if needed.",
      },
      { status: 502 }
    );
  }
}
