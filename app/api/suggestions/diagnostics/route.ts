import { NextRequest, NextResponse } from "next/server";
import { getCurrentUserFromRequest } from "@/lib/auth";
import { getOrBuildBehaviorStats } from "@/lib/suggestions/behavior";

export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }
    const stats = await getOrBuildBehaviorStats(user.id);
    return NextResponse.json({
      ok: true,
      diagnostics: {
        topIngredients: Object.entries(stats.ingredientAffinity)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 12)
          .map(([name, score]) => ({ name, score: Number(score.toFixed(3)) })),
        topDomains: Object.entries(stats.domainAffinity)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 10)
          .map(([domain, score]) => ({ domain, score: Number(score.toFixed(3)) })),
        mostCookedRecipeIds: Object.entries(stats.recipeFrequency)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 12)
          .map(([recipeId, count]) => ({ recipeId: Number(recipeId), count })),
      },
    });
  } catch (error) {
    console.error("suggestions/diagnostics error", error);
    return NextResponse.json(
      { ok: false, error: "Failed to compute diagnostics" },
      { status: 500 }
    );
  }
}
