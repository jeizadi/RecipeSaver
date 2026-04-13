import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/require-user";
import { WeeklyPlannerPageClient } from "./weekly-planner-page-client";

export const dynamic = "force-dynamic";

function startOfWeekMonday(base = new Date()): Date {
  const d = new Date(base);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

export default async function WeeklyPage() {
  const user = await requireUser();
  const weekStart = startOfWeekMonday(new Date());
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekEnd.getDate() + 6);
  weekEnd.setHours(23, 59, 59, 999);

  const [recipes, items] = await Promise.all([
    prisma.recipe.findMany({
      where: { userId: user.id },
      orderBy: { title: "asc" },
      select: { id: true, title: true, category: true },
    }),
    prisma.weeklyMealPlan.findMany({
      where: {
        userId: user.id,
        plannedFor: {
          gte: weekStart,
          lte: weekEnd,
        },
      },
      orderBy: [{ plannedFor: "asc" }, { id: "asc" }],
      include: { recipe: { select: { id: true, title: true } } },
    }),
  ]);

  return (
    <WeeklyPlannerPageClient
      recipes={recipes}
      initialItems={items.map((x) => ({
        id: x.id,
        recipeId: x.recipeId,
        plannedFor: x.plannedFor.toISOString(),
        status: x.status,
        rating: x.rating,
        recipe: x.recipe,
      }))}
    />
  );
}
