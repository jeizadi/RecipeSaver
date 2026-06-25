import { NextRequest, NextResponse } from "next/server";
import { hashPassword } from "@/lib/auth";
import {
  findValidPasswordResetToken,
} from "@/lib/password-reset";
import { prisma } from "@/lib/prisma";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const token = typeof body.token === "string" ? body.token.trim() : "";
    const password = typeof body.password === "string" ? body.password : "";

    if (!token) {
      return NextResponse.json({ ok: false, error: "Reset token is required." }, { status: 400 });
    }
    if (password.length < 8) {
      return NextResponse.json(
        { ok: false, error: "Password must be at least 8 characters." },
        { status: 400 }
      );
    }

    const reset = await findValidPasswordResetToken(token);
    if (!reset) {
      return NextResponse.json(
        { ok: false, error: "This reset link is invalid or has expired. Request a new one." },
        { status: 400 }
      );
    }

    await prisma.$transaction([
      prisma.appUser.update({
        where: { id: reset.userId },
        data: { passwordHash: hashPassword(password) },
      }),
      prisma.userSession.deleteMany({ where: { userId: reset.userId } }),
      prisma.passwordResetToken.deleteMany({ where: { userId: reset.userId } }),
    ]);

    return NextResponse.json({ ok: true, message: "Password updated. You can log in now." });
  } catch (e) {
    console.error("reset-password error", e);
    return NextResponse.json({ ok: false, error: "Failed to reset password." }, { status: 500 });
  }
}
