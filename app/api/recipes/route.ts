import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

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

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const q = searchParams.get("q")?.trim() ?? "";
    const ingredient = searchParams.get("ingredient")?.trim() ?? "";
    const category = searchParams.get("category")?.trim() ?? "";
    const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10));
    const pageSize = 20;

    const where: Record<string, unknown> = {};
    if (q) where.title = { contains: q, mode: "insensitive" };
    if (ingredient)
      where.ingredientsText = { contains: ingredient, mode: "insensitive" };
    if (category && CATEGORIES.includes(category as (typeof CATEGORIES)[number]))
      where.category = category;

    const [recipes, total] = await Promise.all([
      prisma.recipe.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.recipe.count({ where }),
    ]);

    return NextResponse.json({
      recipes,
      pagination: {
        page,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize),
      },
    });
  } catch (e) {
    console.error(e);
    return NextResponse.json(
      { error: "Failed to fetch recipes" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      title,
      sourceUrl,
      description = "",
      ingredientsText,
      instructionsText = "",
      prepTimeMinutes,
      cookTimeMinutes,
      totalTimeMinutes,
      servings = "",
      imageUrl = "",
      author = "",
      category = "other",
      tags = "",
    } = body;

    if (!title || typeof title !== "string" || title.trim() === "") {
      return NextResponse.json(
        { error: "title is required" },
        { status: 400 }
      );
    }
    if (!sourceUrl || typeof sourceUrl !== "string" || sourceUrl.trim() === "") {
      return NextResponse.json(
        { error: "sourceUrl is required" },
        { status: 400 }
      );
    }
    if (!ingredientsText || typeof ingredientsText !== "string") {
      return NextResponse.json(
        { error: "ingredientsText is required" },
        { status: 400 }
      );
    }

    const cat =
      typeof category === "string" && CATEGORIES.includes(category as (typeof CATEGORIES)[number])
        ? category
        : "other";

    const recipe = await prisma.recipe.create({
      data: {
        title: title.trim(),
        sourceUrl: sourceUrl.trim(),
        description: (description ?? "").toString().trim(),
        ingredientsText: ingredientsText.trim(),
        instructionsText: (instructionsText ?? "").toString().trim(),
        prepTimeMinutes:
          prepTimeMinutes != null ? parseInt(String(prepTimeMinutes), 10) : null,
        cookTimeMinutes:
          cookTimeMinutes != null ? parseInt(String(cookTimeMinutes), 10) : null,
        totalTimeMinutes:
          totalTimeMinutes != null
            ? parseInt(String(totalTimeMinutes), 10)
            : null,
        servings: (servings ?? "").toString().trim(),
        imageUrl: (imageUrl ?? "").toString().trim(),
        author: (author ?? "").toString().trim(),
        category: cat,
        tags: (tags ?? "").toString().trim(),
      },
    });

    return NextResponse.json(recipe);
  } catch (e) {
    console.error(e);
    return NextResponse.json(
      { error: "Failed to create recipe" },
      { status: 500 }
    );
  }
}
