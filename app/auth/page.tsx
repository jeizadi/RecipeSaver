"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useSearchParams } from "next/navigation";

export default function AuthPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit() {
    setLoading(true);
    setStatus("");
    const endpoint = mode === "login" ? "/api/auth/login" : "/api/auth/signup";
    const res = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password, name }),
    });
    const data = await res.json().catch(() => ({}));
    setLoading(false);
    if (!data.ok) {
      setStatus(data.error ?? "Auth failed.");
      return;
    }
    const next = searchParams.get("next");
    const nextPath = next && next.startsWith("/") ? next : "/";
    router.push(nextPath);
    router.refresh();
  }

  return (
    <div className="mx-auto max-w-md rounded-lg bg-white p-6 shadow-sm">
      <h2 className="mb-4 text-xl font-semibold">{mode === "login" ? "Login" : "Create account"}</h2>
      <div className="space-y-3">
        {mode === "signup" && (
          <input className="w-full rounded border border-[#d2c2af] px-3 py-2 text-sm" placeholder="Name (optional)" value={name} onChange={(e) => setName(e.target.value)} />
        )}
        <input className="w-full rounded border border-[#d2c2af] px-3 py-2 text-sm" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} />
        <input type="password" className="w-full rounded border border-[#d2c2af] px-3 py-2 text-sm" placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} />
        <button onClick={submit} disabled={loading} className="w-full rounded bg-[#e67e22] px-3 py-2 text-sm font-medium text-white hover:bg-[#cf711f] disabled:opacity-60">
          {loading ? "Please wait..." : mode === "login" ? "Login" : "Sign up"}
        </button>
        <button
          type="button"
          onClick={() => setMode((m) => (m === "login" ? "signup" : "login"))}
          className="w-full text-xs underline"
        >
          {mode === "login" ? "Need an account? Sign up" : "Already have an account? Login"}
        </button>
        {status && <p className="text-sm text-[#c0392b]">{status}</p>}
        <p className="text-xs text-[#7f8c8d]">
          If account creation fails after updates, run{" "}
          <code>npx prisma migrate dev</code> and restart the app.
        </p>
      </div>
    </div>
  );
}
