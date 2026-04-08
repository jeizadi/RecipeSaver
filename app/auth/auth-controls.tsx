"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

type Me = { id: number; email: string; name: string } | null;

export function AuthControls() {
  const router = useRouter();
  const [user, setUser] = useState<Me>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/auth/me")
      .then((r) => r.json())
      .then((d) => {
        if (!cancelled) setUser(d.user ?? null);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    setUser(null);
    router.push("/auth");
    router.refresh();
  }

  if (!user) {
    return (
      <Link
        href="/auth"
        className="rounded border border-[#d2c2af] bg-white px-3 py-1.5 text-sm font-medium text-[#5b3b2a] hover:bg-[#f6efe9]"
      >
        Login / Sign up
      </Link>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <span className="text-xs text-[#7f8c8d]">{user.email}</span>
      <button
        type="button"
        onClick={logout}
        className="rounded border border-[#d2c2af] bg-white px-3 py-1.5 text-sm hover:bg-[#f6efe9]"
      >
        Logout
      </button>
    </div>
  );
}
