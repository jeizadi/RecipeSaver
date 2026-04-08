import { NextRequest, NextResponse } from "next/server";
import { AUTH_SESSION_COOKIE } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST(request: NextRequest) {
  const token = request.cookies.get(AUTH_SESSION_COOKIE)?.value;
  if (token) {
    await prisma.userSession.delete({ where: { token } }).catch(() => undefined);
  }
  const res = NextResponse.json({ ok: true });
  res.cookies.set({
    name: AUTH_SESSION_COOKIE,
    value: "",
    path: "/",
    httpOnly: true,
    expires: new Date(0),
  });
  return res;
}
