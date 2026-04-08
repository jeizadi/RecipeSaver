import { NextRequest, NextResponse } from "next/server";
import { generateSuggestions } from "@/lib/suggestions";
import { getCurrentUserFromRequest } from "@/lib/auth";

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUserFromRequest(request);
    if (!user) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    const body = await request.json().catch(() => ({}));
    const result = await generateSuggestions({
      userId: user.id,
      profileName:
        typeof body.profileName === "string" && body.profileName.trim()
          ? body.profileName.trim()
          : "default",
      limit:
        typeof body.limit === "number" && Number.isFinite(body.limit)
          ? body.limit
          : 12,
      includeWebCandidates: Boolean(body.includeWebCandidates),
      strictFitness: Boolean(body.strictFitness),
    });
    return NextResponse.json({ ok: true, ...result });
  } catch (e) {
    console.error("suggestions/generate error", e);
    return NextResponse.json(
      { ok: false, error: "Failed to generate suggestions" },
      { status: 500 }
    );
  }
}
