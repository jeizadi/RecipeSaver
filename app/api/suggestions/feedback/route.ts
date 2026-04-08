import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { normalizeDomain } from "@/lib/suggestions/feature-extract";
import { getCurrentUserFromRequest } from "@/lib/auth";

const VALID_SIGNALS = new Set([
  "like",
  "dislike",
  "skip",
  "add_to_plan",
  "cooked",
  "rate",
]);

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUserFromRequest(request);
    if (!user) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    const body = await request.json();
    const signal = typeof body.signal === "string" ? body.signal : "";
    if (!VALID_SIGNALS.has(signal)) {
      return NextResponse.json({ ok: false, error: "Invalid signal" }, { status: 400 });
    }

    const recipeId =
      typeof body.recipeId === "number" && Number.isFinite(body.recipeId)
        ? body.recipeId
        : null;
    const candidateUrl =
      typeof body.sourceUrl === "string" && body.sourceUrl.trim()
        ? body.sourceUrl.trim()
        : null;
    const sourceDomain =
      typeof body.sourceDomain === "string" && body.sourceDomain.trim()
        ? body.sourceDomain.trim().toLowerCase()
        : normalizeDomain(candidateUrl);
    const rating =
      typeof body.rating === "number" && body.rating >= 1 && body.rating <= 5
        ? Math.round(body.rating)
        : null;
    const note = typeof body.note === "string" ? body.note.slice(0, 500) : "";

    const row = await prisma.recipeFeedback.create({
      data: {
        recipeId:
          recipeId != null
            ? (
                await prisma.recipe.findFirst({
                  where: { id: recipeId, userId: user.id },
                  select: { id: true },
                })
              )?.id ?? null
            : null,
        candidateUrl,
        sourceDomain,
        signal: signal as
          | "like"
          | "dislike"
          | "skip"
          | "add_to_plan"
          | "cooked"
          | "rate",
        rating,
        note,
      },
    });

    return NextResponse.json({ ok: true, feedbackId: row.id });
  } catch (e) {
    console.error("suggestions/feedback error", e);
    return NextResponse.json(
      { ok: false, error: "Failed to save feedback" },
      { status: 500 }
    );
  }
}
