import type { NextRequest } from "next/server";

export async function sendEmail(to: string, subject: string, text: string): Promise<boolean> {
  const key = process.env.RESEND_API_KEY;
  const from = process.env.REMINDER_FROM_EMAIL ?? process.env.AUTH_FROM_EMAIL;
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

export function getAppOrigin(request?: NextRequest): string {
  const configured = process.env.APP_URL?.replace(/\/$/, "");
  if (configured) return configured;
  const vercel = process.env.VERCEL_URL;
  if (vercel) return `https://${vercel}`;
  if (request) return request.nextUrl.origin;
  return "http://localhost:3000";
}
