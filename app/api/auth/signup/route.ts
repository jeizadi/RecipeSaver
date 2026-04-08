import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { authCookieConfig, createSession, hashPassword } from "@/lib/auth";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
    const password = typeof body.password === "string" ? body.password : "";
    const name = typeof body.name === "string" ? body.name.trim() : "";
    if (!email || !email.includes("@")) {
      return NextResponse.json({ ok: false, error: "Valid email is required." }, { status: 400 });
    }
    if (password.length < 8) {
      return NextResponse.json({ ok: false, error: "Password must be at least 8 characters." }, { status: 400 });
    }
    const existing = await prisma.appUser.findUnique({ where: { email } });
    if (existing) {
      return NextResponse.json({ ok: false, error: "Email already in use." }, { status: 409 });
    }
    const user = await prisma.appUser.create({
      data: { email, name, passwordHash: hashPassword(password) },
    });
    await prisma.userProfile.create({
      data: { name: `user-${user.id}`, userId: user.id },
    });
    const token = await createSession(user.id);
    const res = NextResponse.json({ ok: true, user: { id: user.id, email: user.email, name: user.name } });
    res.cookies.set(authCookieConfig(token));
    return res;
  } catch (e) {
    console.error("signup error", e);
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
    return NextResponse.json({ ok: false, error: "Failed to create account." }, { status: 500 });
  }
}
