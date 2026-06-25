import { NextRequest, NextResponse } from "next/server";
import { getAppOrigin, sendEmail } from "@/lib/email";
import { createPasswordResetToken } from "@/lib/password-reset";
import { prisma } from "@/lib/prisma";

const GENERIC_MESSAGE =
  "If an account exists for that email, we sent a password reset link. Check your inbox (and spam).";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
    if (!email || !email.includes("@")) {
      return NextResponse.json({ ok: false, error: "Valid email is required." }, { status: 400 });
    }

    const user = await prisma.appUser.findUnique({ where: { email } });
    if (user) {
      const token = await createPasswordResetToken(user.id);
      const resetUrl = `${getAppOrigin(request)}/auth/reset?token=${token}`;
      const subject = "Reset your Recipe Saver password";
      const text = [
        "You requested a password reset for Recipe Saver.",
        "",
        `Open this link to choose a new password (expires in 1 hour):`,
        resetUrl,
        "",
        "If you didn't request this, you can ignore this email.",
      ].join("\n");

      const sent = await sendEmail(user.email, subject, text);
      if (!sent) {
        console.info("[password-reset] Email not configured. Reset link:", resetUrl);
      }
    }

    return NextResponse.json({ ok: true, message: GENERIC_MESSAGE });
  } catch (e) {
    console.error("forgot-password error", e);
    return NextResponse.json({ ok: false, error: "Failed to process request." }, { status: 500 });
  }
}
