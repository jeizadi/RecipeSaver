import { NextRequest, NextResponse } from "next/server";
import { getOrCreateProfile, updateProfile } from "@/lib/suggestions/learn";
import { getCurrentUserFromRequest } from "@/lib/auth";

function parseList(x: unknown): string[] | undefined {
  if (!Array.isArray(x)) return undefined;
  return x
    .map((v) => String(v).trim().toLowerCase())
    .filter(Boolean)
    .slice(0, 100);
}

export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUserFromRequest(request);
    if (!user) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    const profileName =
      new URL(request.url).searchParams.get("profileName")?.trim() || "default";
    const profile = await getOrCreateProfile(profileName, user.id);
    return NextResponse.json({ ok: true, profile });
  } catch (e) {
    console.error("suggestions/profile GET error", e);
    return NextResponse.json(
      { ok: false, error: "Failed to fetch profile" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUserFromRequest(request);
    if (!user) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    const body = await request.json();
    const profileName =
      typeof body.profileName === "string" && body.profileName.trim()
        ? body.profileName.trim()
        : "default";

    await updateProfile(profileName, {
      dietaryRestrictions: parseList(body.dietaryRestrictions),
      fitnessGoal: typeof body.fitnessGoal === "string" ? body.fitnessGoal : undefined,
      preferredDomains: parseList(body.preferredDomains),
      blockedDomains: parseList(body.blockedDomains),
      favoriteIngredients: parseList(body.favoriteIngredients),
      dislikedIngredients: parseList(body.dislikedIngredients),
      calorieTarget:
        typeof body.calorieTarget === "number" ? Math.round(body.calorieTarget) : undefined,
      proteinTarget:
        typeof body.proteinTarget === "number" ? Math.round(body.proteinTarget) : undefined,
      carbTarget:
        typeof body.carbTarget === "number" ? Math.round(body.carbTarget) : undefined,
      fatTarget: typeof body.fatTarget === "number" ? Math.round(body.fatTarget) : undefined,
      explorationRatio:
        typeof body.explorationRatio === "number"
          ? Math.min(1, Math.max(0, body.explorationRatio))
          : undefined,
    }, user.id);

    const profile = await getOrCreateProfile(profileName, user.id);
    return NextResponse.json({ ok: true, profile });
  } catch (e) {
    console.error("suggestions/profile POST error", e);
    return NextResponse.json(
      { ok: false, error: "Failed to update profile" },
      { status: 500 }
    );
  }
}
