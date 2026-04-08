import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUserFromRequest } from "@/lib/auth";

const CATEGORIES = [
  "breakfast",
  "lunch",
  "dinner",
  "snack",
  "dessert",
  "drink",
  "side",
  "sauce",
  "other",
] as const;

function parseId(id: string): number | null {
  const n = parseInt(id, 10);
  return Number.isFinite(n) ? n : null;
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUserFromRequest(_request);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const id = parseId((await params).id);
  if (id == null) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }
  try {
    const recipe = await prisma.recipe.findFirst({ where: { id, userId: user.id } });
    if (!recipe) {
      return NextResponse.json({ error: "Recipe not found" }, { status: 404 });
    }
    return NextResponse.json(recipe);
  } catch (e) {
    console.error(e);
    return NextResponse.json(
      { error: "Failed to fetch recipe" },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUserFromRequest(request);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const id = parseId((await params).id);
  if (id == null) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }
  try {
    const body = await request.json();
    const {
      title,
      sourceUrl,
      description,
      ingredientsText,
      instructionsText,
      prepTimeMinutes,
      cookTimeMinutes,
      totalTimeMinutes,
      servings,
      imageUrl,
      author,
      category,
      tags,
    } = body;

    const data: Record<string, unknown> = {};
    if (typeof title === "string") data.title = title.trim();
    if (typeof sourceUrl === "string") data.sourceUrl = sourceUrl.trim();
    if (description !== undefined) data.description = String(description).trim();
    if (typeof ingredientsText === "string")
      data.ingredientsText = ingredientsText.trim();
    if (instructionsText !== undefined)
      data.instructionsText = String(instructionsText).trim();
    if (prepTimeMinutes !== undefined)
      data.prepTimeMinutes =
        prepTimeMinutes == null ? null : parseInt(String(prepTimeMinutes), 10);
    if (cookTimeMinutes !== undefined)
      data.cookTimeMinutes =
        cookTimeMinutes == null ? null : parseInt(String(cookTimeMinutes), 10);
    if (totalTimeMinutes !== undefined)
      data.totalTimeMinutes =
        totalTimeMinutes == null
          ? null
          : parseInt(String(totalTimeMinutes), 10);
    if (servings !== undefined) data.servings = String(servings).trim();
    if (imageUrl !== undefined) data.imageUrl = String(imageUrl).trim();
    if (author !== undefined) data.author = String(author).trim();
    if (
      typeof category === "string" &&
      CATEGORIES.includes(category as (typeof CATEGORIES)[number])
    ) {
      data.category = category;
    }
    if (tags !== undefined) data.tags = String(tags).trim();

    const recipe = await prisma.recipe.findFirst({ where: { id, userId: user.id } });
    if (!recipe) return NextResponse.json({ error: "Recipe not found" }, { status: 404 });
    const updated = await prisma.recipe.update({
      where: { id },
      data,
    });
    return NextResponse.json(updated);
  } catch (e) {
    if (e && typeof e === "object" && "code" in e && (e as { code: string }).code === "P2025") {
      return NextResponse.json({ error: "Recipe not found" }, { status: 404 });
    }
    console.error(e);
    return NextResponse.json(
      { error: "Failed to update recipe" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUserFromRequest(_request);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const id = parseId((await params).id);
  if (id == null) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }
  try {
    const recipe = await prisma.recipe.findFirst({ where: { id, userId: user.id } });
    if (!recipe) return NextResponse.json({ error: "Recipe not found" }, { status: 404 });
    await prisma.recipe.delete({ where: { id } });
    return new NextResponse(null, { status: 204 });
  } catch (e) {
    if (e && typeof e === "object" && "code" in e && (e as { code: string }).code === "P2025") {
      return NextResponse.json({ error: "Recipe not found" }, { status: 404 });
    }
    console.error(e);
    return NextResponse.json(
      { error: "Failed to delete recipe" },
      { status: 500 }
    );
  }
}
