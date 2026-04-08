import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { authCookieConfig, createSession, verifyPassword } from "@/lib/auth";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
    const password = typeof body.password === "string" ? body.password : "";
    const user = await prisma.appUser.findUnique({ where: { email } });
    if (!user || !verifyPassword(password, user.passwordHash)) {
      return NextResponse.json({ ok: false, error: "Invalid email/password." }, { status: 401 });
    }
    const token = await createSession(user.id);
    const res = NextResponse.json({ ok: true, user: { id: user.id, email: user.email, name: user.name } });
    res.cookies.set(authCookieConfig(token));
    return res;
  } catch (e) {
    console.error("login error", e);
    if (e && typeof e === "object" && "code" in e) {
      const code = (e as { code?: string }).code;
      if (code === "P2021" || code === "P2022") {
        return NextResponse.json(
          {
            ok: false,
            error:
              "Account tables are missing. Run database migrations (npx prisma migrate dev) and try again.",
          },
          { status: 500 }
        );
      }
    }
    return NextResponse.json({ ok: false, error: "Failed to login." }, { status: 500 });
  }
}
