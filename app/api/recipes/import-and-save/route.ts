import { NextRequest, NextResponse } from "next/server";
import { importRecipeFromUrl } from "@/lib/import-recipe";
import { getCurrentUserFromRequest } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST(request: NextRequest) {
  const user = await getCurrentUserFromRequest(request);
  if (!user) return NextResponse.redirect(new URL("/auth", request.url));

  const form = await request.formData().catch(() => null);
  const url =
    (form?.get("url")?.toString() || "").trim() ||
    (await request.json().catch(() => ({ url: "" }))).url?.trim() ||
    "";
  if (!url) {
    return NextResponse.json({ ok: false, error: "URL required" }, { status: 400 });
  }
  try {
    const imported = await importRecipeFromUrl(url);
    const recipe = await prisma.recipe.create({
      data: {
        userId: user.id,
        title: imported.title || "Imported recipe",
        sourceUrl: url,
        description: "",
        ingredientsText: imported.ingredientsText || "",
        instructionsText: imported.instructionsText || "",
        prepTimeMinutes: imported.prepTimeMinutes,
        cookTimeMinutes: imported.cookTimeMinutes,
        totalTimeMinutes: imported.totalTimeMinutes,
        servings: imported.servings || "",
        imageUrl: imported.imageUrl || "",
        author: imported.author || "",
        category: imported.category || "other",
        tags: "",
      },
    });
    return NextResponse.redirect(new URL(`/recipes/${recipe.id}`, request.url));
  } catch {
    return NextResponse.json({ ok: false, error: "Import failed." }, { status: 502 });
  }
}
