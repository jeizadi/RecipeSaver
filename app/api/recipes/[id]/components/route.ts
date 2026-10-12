import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getRequestUser, householdRecipeReadFilter } from "@/lib/access";

async function parentIdFrom(params: Promise<{ id: string }>) {
  const id = Number((await params).id);
  return Number.isInteger(id) && id > 0 ? id : null;
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getRequestUser(request);
  if (!user) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  const parentId = await parentIdFrom(params);
  if (!parentId) return NextResponse.json({ ok: false, error: "Invalid recipe id" }, { status: 400 });
  const access = await householdRecipeReadFilter(user);
  const parent = await prisma.recipe.findFirst({ where: { id: parentId, ...access }, select: { id: true } });
  if (!parent) return NextResponse.json({ ok: false, error: "Recipe not found" }, { status: 404 });
  const components = await prisma.recipeComponent.findMany({
    where: { parentRecipeId: parentId, childRecipe: access },
    include: { childRecipe: { select: { id: true, title: true, category: true, ingredientsText: true } } },
    orderBy: { sortOrder: "asc" },
  });
  return NextResponse.json({ ok: true, components });
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getRequestUser(request);
  if (!user) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  const parentId = await parentIdFrom(params);
  const body = await request.json().catch(() => ({}));
  const childId = Number(body.childRecipeId);
  if (!parentId || !Number.isInteger(childId) || childId < 1 || parentId === childId) {
    return NextResponse.json({ ok: false, error: "A different child recipe is required." }, { status: 400 });
  }
  const access = await householdRecipeReadFilter(user);
  const [parent, child] = await Promise.all([
    prisma.recipe.findFirst({ where: { id: parentId, ...access }, select: { id: true } }),
    prisma.recipe.findFirst({ where: { id: childId, ...access }, select: { id: true } }),
  ]);
  if (!parent || !child) return NextResponse.json({ ok: false, error: "Recipe not found" }, { status: 404 });
  const cycle = await prisma.recipeComponent.findFirst({ where: { parentRecipeId: childId, childRecipeId: parentId } });
  if (cycle) return NextResponse.json({ ok: false, error: "That would create a recipe cycle." }, { status: 400 });
  const component = await prisma.recipeComponent.upsert({
    where: { parentRecipeId_childRecipeId: { parentRecipeId: parentId, childRecipeId: childId } },
    update: { label: typeof body.label === "string" ? body.label.trim() : "", includedByDefault: body.includedByDefault !== false },
    create: { parentRecipeId: parentId, childRecipeId: childId, label: typeof body.label === "string" ? body.label.trim() : "", includedByDefault: body.includedByDefault !== false },
    include: { childRecipe: { select: { id: true, title: true, category: true, ingredientsText: true } } },
  });
  return NextResponse.json({ ok: true, component });
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getRequestUser(request);
  if (!user) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  const parentId = await parentIdFrom(params);
  const body = await request.json().catch(() => ({}));
  const componentId = Number(body.id);
  if (!parentId || !Number.isInteger(componentId)) return NextResponse.json({ ok: false, error: "Valid component id is required." }, { status: 400 });
  const access = await householdRecipeReadFilter(user);
  const existing = await prisma.recipeComponent.findFirst({ where: { id: componentId, parentRecipeId: parentId, parentRecipe: access } });
  if (!existing) return NextResponse.json({ ok: false, error: "Component not found" }, { status: 404 });
  const component = await prisma.recipeComponent.update({ where: { id: componentId }, data: { includedByDefault: Boolean(body.includedByDefault) } });
  return NextResponse.json({ ok: true, component });
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getRequestUser(request);
  if (!user) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  const parentId = await parentIdFrom(params);
  const componentId = Number(request.nextUrl.searchParams.get("id"));
  if (!parentId || !Number.isInteger(componentId)) return NextResponse.json({ ok: false, error: "Valid component id is required." }, { status: 400 });
  const access = await householdRecipeReadFilter(user);
  const existing = await prisma.recipeComponent.findFirst({ where: { id: componentId, parentRecipeId: parentId, parentRecipe: access } });
  if (!existing) return NextResponse.json({ ok: false, error: "Component not found" }, { status: 404 });
  await prisma.recipeComponent.delete({ where: { id: componentId } });
  return NextResponse.json({ ok: true });
}
