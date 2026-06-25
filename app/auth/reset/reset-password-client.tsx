"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";

export default function ResetPasswordPageClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token") ?? "";
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [status, setStatus] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit() {
    if (password !== confirm) {
      setStatus("Passwords do not match.");
      return;
    }
    setLoading(true);
    setStatus("");
    setMessage("");
    const res = await fetch("/api/auth/reset-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, password }),
    });
    const data = await res.json().catch(() => ({}));
    setLoading(false);
    if (!data.ok) {
      setStatus(data.error ?? "Reset failed.");
      return;
    }
    setMessage(data.message ?? "Password updated.");
    setTimeout(() => router.push("/auth"), 1500);
  }

  if (!token) {
    return (
      <div className="mx-auto max-w-md rounded-lg bg-white p-6 shadow-sm">
        <h2 className="mb-4 text-xl font-semibold">Invalid reset link</h2>
        <p className="mb-4 text-sm text-[#7f8c8d]">This link is missing a token. Request a new reset email.</p>
        <Link href="/auth/forgot" className="text-sm underline">
          Request password reset
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-md rounded-lg bg-white p-6 shadow-sm">
      <h2 className="mb-4 text-xl font-semibold">Choose a new password</h2>
      <div className="space-y-3">
        <input
          type="password"
          className="w-full rounded border border-[#d2c2af] px-3 py-2 text-sm"
          placeholder="New password (min 8 characters)"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        <input
          type="password"
          className="w-full rounded border border-[#d2c2af] px-3 py-2 text-sm"
          placeholder="Confirm new password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
        />
        <button
          onClick={submit}
          disabled={loading}
          className="w-full rounded bg-[#e67e22] px-3 py-2 text-sm font-medium text-white hover:bg-[#cf711f] disabled:opacity-60"
        >
          {loading ? "Saving…" : "Update password"}
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
