import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

function parseId(id: string): number | null {
  const n = parseInt(id, 10);
  return Number.isFinite(n) ? n : null;
}

function joinSection(
  existing: string,
  heading: string,
  addition: string
): string {
  const a = existing.trim();
  const b = addition.trim();
  if (!b) return a;
  if (!a) return `${heading}\n${b}`;
  return `${a}\n\n${heading}\n${b}`;
}

/**
 * Computes merged ingredients/instructions by appending a child recipe to the
 * parent's current text (sent from the form so unsaved edits are not lost).
 * Does not write to the database — user saves the form to persist.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const parentId = parseId((await params).id);
  if (parentId == null) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }

  let body: {
    childRecipeId?: unknown;
    ingredientsText?: unknown;
    instructionsText?: unknown;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const childId = Number(body.childRecipeId);
  if (!Number.isInteger(childId) || childId < 1) {
    return NextResponse.json(
      { error: "childRecipeId is required" },
      { status: 400 }
    );
  }

  if (childId === parentId) {
    return NextResponse.json(
      { error: "Cannot merge a recipe into itself" },
      { status: 400 }
    );
  }

  const parentIngredients =
    typeof body.ingredientsText === "string" ? body.ingredientsText : "";
  const parentInstructions =
    typeof body.instructionsText === "string" ? body.instructionsText : "";

  try {
    const parent = await prisma.recipe.findUnique({
      where: { id: parentId },
      select: { id: true },
    });
    if (!parent) {
      return NextResponse.json({ error: "Recipe not found" }, { status: 404 });
    }

    const child = await prisma.recipe.findUnique({ where: { id: childId } });
    if (!child) {
      return NextResponse.json(
        { error: "Recipe to merge was not found" },
        { status: 404 }
      );
    }

    const heading = `--- ${child.title} (merged) ---`;

    const ingredientsText = joinSection(
      parentIngredients,
      heading,
      child.ingredientsText
    );
    const instructionsText = joinSection(
      parentInstructions,
      heading,
      child.instructionsText
    );

    return NextResponse.json({
      ok: true,
      ingredientsText,
      instructionsText,
      mergedTitle: child.title,
    });
  } catch (e) {
    console.error(e);
    return NextResponse.json(
      { error: "Failed to merge recipes" },
      { status: 500 }
    );
  }
}
