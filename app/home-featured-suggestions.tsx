"use client";

import { useState } from "react";
import Link from "next/link";

type FeaturedSuggestion = {
  id: number;
  title: string;
  sourceDomain: string | null;
  recipeId: number | null;
  candidateUrl: string | null;
};

export function HomeFeaturedSuggestions({
  featured,
}: {
  featured: FeaturedSuggestion[];
}) {
  const storageKey = "home.featuredSuggestions.open";
  const [open, setOpen] = useState(() => {
    if (typeof window === "undefined") return true;
    return window.localStorage.getItem(storageKey) !== "0";
  });

  function toggleOpen() {
    setOpen((prev) => {
      const next = !prev;
      window.localStorage.setItem(storageKey, next ? "1" : "0");
      return next;
    });
  }

  return (
    <section className="mb-6 rounded border border-[#e0d4c7] bg-white p-3">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-lg font-semibold">Featured suggestion candidates</h3>
        <button
          type="button"
          onClick={toggleOpen}
          className="rounded border border-[#d2c2af] bg-[#fffdf8] px-2 py-1 text-xs text-[#5b3b2a] hover:bg-[#f6efe9]"
        >
          {open ? "Hide" : "Show"}
        </button>
      </div>
      {open && (
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          {featured.length ? (
            featured.map((f) => (
              <div key={f.id} className="rounded border border-[#e0d4c7] bg-[#fffdf8] p-3">
                <p className="text-sm font-medium">{f.title}</p>
                <p className="text-xs text-[#7f8c8d]">{f.sourceDomain || "unknown source"}</p>
                <div className="mt-2 flex gap-2">
                  {f.recipeId ? (
                    <Link href={`/recipes/${f.recipeId}`} className="text-xs underline">
                      Open
                    </Link>
                  ) : f.candidateUrl ? (
                    <form action="/api/recipes/import-and-save" method="post">
                      <input type="hidden" name="url" value={f.candidateUrl} />
                      <button className="text-xs underline" type="submit">
                        Import to library
                      </button>
                    </form>
                  ) : null}
                  {f.candidateUrl && (
                    <a
                      href={f.candidateUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs underline"
                    >
                      Source
                    </a>
                  )}
                </div>
              </div>
            ))
          ) : (
            <p className="text-sm text-[#7f8c8d]">
              No suggestion run yet. Use the suggestion controls below to generate one.
            </p>
          )}
        </div>
      )}
    </section>
  );
}
