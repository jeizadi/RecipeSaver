import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUserFromRequest } from "@/lib/auth";
import { buildBehaviorStats, storeBehaviorStats } from "@/lib/suggestions/behavior";

export async function GET(request: NextRequest) {
  const user = await getCurrentUserFromRequest(request);
  if (!user) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  const url = new URL(request.url);
  const start = url.searchParams.get("start");
  const end = url.searchParams.get("end");
  const parsedStart = start ? new Date(start) : null;
  const parsedEnd = end ? new Date(end) : null;
  const hasRange =
    parsedStart != null &&
    parsedEnd != null &&
    !Number.isNaN(parsedStart.getTime()) &&
    !Number.isNaN(parsedEnd.getTime());
  const rows = await prisma.weeklyMealPlan.findMany({
    where: hasRange
      ? {
          userId: user.id,
          plannedFor: {
            gte: parsedStart!,
            lte: parsedEnd!,
          },
        }
      : { userId: user.id },
    orderBy: { plannedFor: "asc" },
    take: hasRange ? 200 : 50,
    include: { recipe: { select: { id: true, title: true } } },
  });
  return NextResponse.json({ ok: true, items: rows });
}

export async function POST(request: NextRequest) {
  const user = await getCurrentUserFromRequest(request);
  if (!user) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  const body = await request.json().catch(() => ({}));
  const recipeId = Number(body.recipeId);
  const plannedForRaw = typeof body.plannedFor === "string" ? body.plannedFor : "";
  const m = plannedForRaw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  const plannedFor = m
    ? new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 12, 0, 0))
    : new Date(NaN);
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

export async function DELETE(request: NextRequest) {
  const user = await getCurrentUserFromRequest(request);
  if (!user) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  const body = await request.json().catch(() => ({}));
  const start = typeof body.start === "string" ? body.start : "";
  const end = typeof body.end === "string" ? body.end : "";
  const mStart = start.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  const mEnd = end.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (mStart && mEnd) {
    const startDate = new Date(
      Date.UTC(Number(mStart[1]), Number(mStart[2]) - 1, Number(mStart[3]), 0, 0, 0)
    );
    const endDate = new Date(
      Date.UTC(Number(mEnd[1]), Number(mEnd[2]) - 1, Number(mEnd[3]), 23, 59, 59)
    );
    await prisma.weeklyMealPlan.deleteMany({
      where: {
        userId: user.id,
        plannedFor: { gte: startDate, lte: endDate },
      },
    });
    const behavior = await buildBehaviorStats(user.id);
    await storeBehaviorStats(user.id, behavior);
    return NextResponse.json({ ok: true, clearedWeek: true });
  }
  const id = Number(body.id);
  if (!Number.isInteger(id)) {
    return NextResponse.json({ ok: false, error: "id required" }, { status: 400 });
  }
  const existing = await prisma.weeklyMealPlan.findFirst({ where: { id, userId: user.id } });
  if (!existing) return NextResponse.json({ ok: false, error: "Not found" }, { status: 404 });
  await prisma.weeklyMealPlan.delete({ where: { id } });
  const behavior = await buildBehaviorStats(user.id);
  await storeBehaviorStats(user.id, behavior);
  return NextResponse.json({ ok: true });
}

export async function PATCH(request: NextRequest) {
  const user = await getCurrentUserFromRequest(request);
  if (!user) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  const body = await request.json().catch(() => ({}));
  const id = Number(body.id);
  if (!Number.isInteger(id)) return NextResponse.json({ ok: false, error: "id required" }, { status: 400 });
  const existing = await prisma.weeklyMealPlan.findFirst({ where: { id, userId: user.id } });
  if (!existing) return NextResponse.json({ ok: false, error: "Not found" }, { status: 404 });
  const plannedForRaw = typeof body.plannedFor === "string" ? body.plannedFor : "";
  const mp = plannedForRaw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  const plannedFor =
    mp != null
      ? new Date(Date.UTC(Number(mp[1]), Number(mp[2]) - 1, Number(mp[3]), 12, 0, 0))
      : undefined;
  const item = await prisma.weeklyMealPlan.update({
    where: { id },
    data: {
      status: body.status,
      rating: typeof body.rating === "number" ? Math.min(5, Math.max(1, Math.round(body.rating))) : undefined,
      notes: typeof body.notes === "string" ? body.notes : undefined,
      plannedFor,
    },
  });
  const behavior = await buildBehaviorStats(user.id);
  await storeBehaviorStats(user.id, behavior);
  return NextResponse.json({ ok: true, item });
}
