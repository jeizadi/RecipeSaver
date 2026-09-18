import { NextRequest, NextResponse } from "next/server";
import { getRequestUser } from "@/lib/access";
import { prisma } from "@/lib/prisma";
import { getOrCreateHousehold } from "@/lib/households";

export async function GET(request: NextRequest) {
  const user = await getRequestUser(request);
  if (!user) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  const household = await getOrCreateHousehold(user.id);
  return NextResponse.json({ ok: true, household });
}

export async function POST(request: NextRequest) {
  const user = await getRequestUser(request);
  if (!user) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  const body = await request.json().catch(() => ({}));
  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  if (!email || !email.includes("@")) {
    return NextResponse.json({ ok: false, error: "A valid partner email is required." }, { status: 400 });
  }
  if (email === user.email.toLowerCase()) {
    return NextResponse.json({ ok: false, error: "That is already your account." }, { status: 400 });
  }
  const household = await getOrCreateHousehold(user.id);
  const partner = await prisma.appUser.findUnique({ where: { email } });
  if (!partner) {
    return NextResponse.json({ ok: false, error: "That account does not exist yet. Have your partner create a Recipebox account first." }, { status: 404 });
  }
  await prisma.householdMember.upsert({
    where: { householdId_userId: { householdId: household.id, userId: partner.id } },
    update: {},
    create: { householdId: household.id, userId: partner.id, role: "member", invitedEmail: email },
  });
  return NextResponse.json({ ok: true, household: await getOrCreateHousehold(user.id) });
}
