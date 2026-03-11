"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function DeleteForm({ recipeId }: { recipeId: number }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch(`/api/recipes/${recipeId}`, { method: "DELETE" });
      if (res.ok) router.push("/");
      else router.refresh();
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="mt-4 flex gap-3">
      <button
        type="submit"
        disabled={loading}
        className="rounded bg-[#c0392b] px-3 py-1.5 text-sm text-white hover:bg-[#a93226] disabled:opacity-70"
      >
        {loading ? "Deleting…" : "Yes, delete"}
      </button>
    </form>
  );
}
