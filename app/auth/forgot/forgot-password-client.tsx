"use client";

import Link from "next/link";
import { useState } from "react";

export default function ForgotPasswordPageClient() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit() {
    setLoading(true);
    setStatus("");
    setMessage("");
    const res = await fetch("/api/auth/forgot-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });
    const data = await res.json().catch(() => ({}));
    setLoading(false);
    if (!data.ok) {
      setStatus(data.error ?? "Request failed.");
      return;
    }
    setMessage(data.message ?? "Check your email for a reset link.");
  }

  return (
    <div className="mx-auto max-w-md rounded-lg bg-white p-6 shadow-sm">
      <h2 className="mb-2 text-xl font-semibold">Forgot password</h2>
      <p className="mb-4 text-sm text-[#7f8c8d]">
        Enter your account email and we&apos;ll send a link to reset your password.
      </p>
      <div className="space-y-3">
        <input
          className="w-full rounded border border-[#d2c2af] px-3 py-2 text-sm"
          placeholder="Email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <button
          onClick={submit}
          disabled={loading}
          className="w-full rounded bg-[#e67e22] px-3 py-2 text-sm font-medium text-white hover:bg-[#cf711f] disabled:opacity-60"
        >
          {loading ? "Sending…" : "Send reset link"}
        </button>
        <Link href="/auth" className="block text-center text-xs underline">
          Back to login
        </Link>
        {status && <p className="text-sm text-[#c0392b]">{status}</p>}
        {message && <p className="text-sm text-[#27ae60]">{message}</p>}
      </div>
    </div>
  );
}
