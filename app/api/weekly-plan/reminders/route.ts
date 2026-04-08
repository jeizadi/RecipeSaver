import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

async function sendReminderEmail(to: string, subject: string, text: string) {
  const key = process.env.RESEND_API_KEY;
  const from = process.env.REMINDER_FROM_EMAIL;
  if (!key || !from) return false;
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ from, to, subject, text }),
  });
  return res.ok;
}

export async function POST(request: NextRequest) {
  const secret = request.headers.get("x-reminder-secret");
  if (!process.env.REMINDER_CRON_SECRET || secret !== process.env.REMINDER_CRON_SECRET) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }
  const now = new Date();
  const end = new Date(now.getTime() + 24 * 60 * 60 * 1000);
  const due = await prisma.weeklyMealPlan.findMany({
    where: {
      plannedFor: { gte: now, lt: end },
      reminderEmailSentAt: null,
      user: { email: { not: "" } },
    },
    include: { user: true, recipe: true },
  });
  let sent = 0;
  for (const d of due) {
    const ok = await sendReminderEmail(
      d.user.email,
      `Recipe reminder: ${d.recipe.title}`,
      `You planned "${d.recipe.title}" for ${d.plannedFor.toDateString()}. After cooking, rate it in Recipebox.`
    );
    if (ok) {
      sent += 1;
      await prisma.weeklyMealPlan.update({
        where: { id: d.id },
        data: { reminderEmailSentAt: new Date() },
      });
    }
  }
  return NextResponse.json({ ok: true, due: due.length, sent });
}
