import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUserFromRequest } from "@/lib/auth";

export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUserFromRequest(request);
    if (!user) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    const url = new URL(request.url);
    const limit = Math.min(
      20,
      Math.max(1, parseInt(url.searchParams.get("limit") ?? "6", 10))
    );
    const profileName = url.searchParams.get("profileName")?.trim() || "default";

    const profile = await prisma.userProfile.findFirst({
      where: { name: profileName, userId: user.id },
      select: { id: true, name: true },
    });
    if (!profile) {
      return NextResponse.json({ ok: true, runs: [] });
    }

    const runs = await prisma.suggestionRun.findMany({
      where: { profileId: profile.id },
      orderBy: { createdAt: "desc" },
      take: limit,
      include: { items: { orderBy: { score: "desc" }, take: 12 } },
    });

    return NextResponse.json({
      ok: true,
      profileName: profile.name,
      runs: runs.map((r) => ({
        id: r.id,
        createdAt: r.createdAt,
        inputJson: r.inputJson,
        items: r.items.map((i) => ({
          id: i.id,
          recipeId: i.recipeId,
          sourceDomain: i.sourceDomain,
          title: i.title,
          score: i.score,
          reasonJson: i.reasonJson,
        })),
      })),
    });
  } catch (e) {
    console.error("suggestions/history error", e);
    return NextResponse.json(
      { ok: false, error: "Failed to fetch suggestion history" },
      { status: 500 }
    );
  }
}
