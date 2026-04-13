import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUserFromRequest } from "@/lib/auth";
import { buildBehaviorStats, storeBehaviorStats } from "@/lib/suggestions/behavior";
import { normalizeDomain } from "@/lib/suggestions/feature-extract";

export async function GET(request: NextRequest) {
  const user = await getCurrentUserFromRequest(request);
  if (!user) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  const rows = await prisma.weeklyMealPlan.findMany({
    where: { userId: user.id },
    orderBy: { plannedFor: "asc" },
    take: 50,
    include: { recipe: { select: { id: true, title: true } } },
  });
  return NextResponse.json({ ok: true, items: rows });
}

export async function POST(request: NextRequest) {
  const user = await getCurrentUserFromRequest(request);
  if (!user) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  const body = await request.json().catch(() => ({}));
  const recipeId = Number(body.recipeId);
  const plannedFor = new Date(body.plannedFor);
  if (!Number.isInteger(recipeId) || Number.isNaN(plannedFor.getTime())) {
    return NextResponse.json({ ok: false, error: "recipeId and plannedFor are required." }, { status: 400 });
  }
  const recipe = await prisma.recipe.findFirst({ where: { id: recipeId, userId: user.id } });
  if (!recipe) return NextResponse.json({ ok: false, error: "Recipe not found." }, { status: 404 });
  const item = await prisma.weeklyMealPlan.create({
    data: {
      userId: user.id,
      recipeId,
      plannedFor,
      notes: typeof body.notes === "string" ? body.notes : "",
    },
  });
  return NextResponse.json({ ok: true, item });
}

export async function PATCH(request: NextRequest) {
  const user = await getCurrentUserFromRequest(request);
  if (!user) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  const body = await request.json().catch(() => ({}));
  const id = Number(body.id);
  if (!Number.isInteger(id)) return NextResponse.json({ ok: false, error: "id required" }, { status: 400 });
  const existing = await prisma.weeklyMealPlan.findFirst({ where: { id, userId: user.id } });
  if (!existing) return NextResponse.json({ ok: false, error: "Not found" }, { status: 404 });
  const item = await prisma.weeklyMealPlan.update({
    where: { id },
    data: {
      status: body.status,
      rating: typeof body.rating === "number" ? Math.min(5, Math.max(1, Math.round(body.rating))) : undefined,
      notes: typeof body.notes === "string" ? body.notes : undefined,
    },
  });
  const sourceDomain = normalizeDomain(
    (
      await prisma.recipe.findUnique({
        where: { id: item.recipeId },
        select: { sourceUrl: true },
      })
    )?.sourceUrl ?? null
  );
  if (body.status === "cooked") {
    await prisma.recipeFeedback.create({
      data: {
        recipeId: item.recipeId,
        sourceDomain,
        signal: "cooked",
      },
    });
  }
  if (typeof body.rating === "number") {
    await prisma.recipeFeedback.create({
      data: {
        recipeId: item.recipeId,
        sourceDomain,
        signal: "rate",
        rating: Math.min(5, Math.max(1, Math.round(body.rating))),
      },
    });
  }
  const behavior = await buildBehaviorStats(user.id);
  await storeBehaviorStats(user.id, behavior);
  return NextResponse.json({ ok: true, item });
}
