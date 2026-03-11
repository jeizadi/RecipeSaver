"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

const CATEGORIES = [
  "breakfast",
  "lunch",
  "dinner",
  "snack",
  "dessert",
  "drink",
  "side",
  "sauce",
  "other",
];

export interface RecipeFormInitial {
  title: string;
  sourceUrl: string;
  description: string;
  ingredientsText: string;
  instructionsText: string;
  prepTimeMinutes: number | null;
  cookTimeMinutes: number | null;
  totalTimeMinutes: number | null;
  servings: string;
  imageUrl: string;
  author: string;
  category: string;
  tags: string;
}

const emptyInitial: RecipeFormInitial = {
  title: "",
  sourceUrl: "",
  description: "",
  ingredientsText: "",
  instructionsText: "",
  prepTimeMinutes: null,
  cookTimeMinutes: null,
  totalTimeMinutes: null,
  servings: "",
  imageUrl: "",
  author: "",
  category: "other",
  tags: "",
};

export function RecipeForm({
  recipeId,
  initial = emptyInitial,
}: {
  recipeId?: number;
  initial?: RecipeFormInitial;
}) {
  const router = useRouter();
  const [status, setStatus] = useState("");
  const [statusError, setStatusError] = useState(false);
  const [loading, setLoading] = useState(false);
  const [importing, setImporting] = useState(false);

  const [form, setForm] = useState(initial);

  function setValue<K extends keyof RecipeFormInitial>(
    key: K,
    value: RecipeFormInitial[K]
  ) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function handleImport() {
    const url = form.sourceUrl.trim();
    if (!url) {
      setStatus("Paste a recipe URL first.");
      setStatusError(true);
      return;
    }
    setStatus("Importing…");
    setStatusError(false);
    setImporting(true);
    try {
      const res = await fetch("/api/recipes/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
      });
      const data = await res.json().catch(() => ({}));
      if (!data.ok) {
        setStatus(data.error ?? "Import failed.");
        setStatusError(true);
        return;
      }
      const d = data.data ?? {};
      setForm((prev) => ({
        ...prev,
        title: d.title ?? prev.title,
        ingredientsText: d.ingredientsText ?? prev.ingredientsText,
        instructionsText: d.instructionsText ?? prev.instructionsText,
        prepTimeMinutes: d.prepTimeMinutes ?? prev.prepTimeMinutes,
        cookTimeMinutes: d.cookTimeMinutes ?? prev.cookTimeMinutes,
        totalTimeMinutes: d.totalTimeMinutes ?? prev.totalTimeMinutes,
        servings: d.servings ?? prev.servings,
        imageUrl: d.imageUrl ?? prev.imageUrl,
        author: d.author ?? prev.author,
        category: d.category ?? prev.category,
      }));
      setStatus("Imported! Review and click Save.");
      setStatusError(false);
    } catch {
      setStatus("Import failed. Try again or fill manually.");
      setStatusError(true);
    } finally {
      setImporting(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setStatus("");
    try {
      const url = recipeId
        ? `/api/recipes/${recipeId}`
        : "/api/recipes";
      const method = recipeId ? "PATCH" : "POST";
      const body = {
        title: form.title.trim(),
        sourceUrl: form.sourceUrl.trim(),
        description: form.description.trim(),
        ingredientsText: form.ingredientsText.trim(),
        instructionsText: form.instructionsText.trim(),
        prepTimeMinutes: form.prepTimeMinutes ?? null,
        cookTimeMinutes: form.cookTimeMinutes ?? null,
        totalTimeMinutes: form.totalTimeMinutes ?? null,
        servings: form.servings.trim(),
        imageUrl: form.imageUrl.trim(),
        author: form.author.trim(),
        category: form.category,
        tags: form.tags.trim(),
      };
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        setStatus(err.error ?? "Failed to save.");
        setStatusError(true);
        return;
      }
      router.push(recipeId ? `/recipes/${recipeId}` : "/");
      router.refresh();
    } catch {
      setStatus("Failed to save.");
      setStatusError(true);
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <label className="text-sm font-medium">Source URL</label>
        <div className="flex flex-wrap gap-2">
          <input
            type="url"
            value={form.sourceUrl}
            onChange={(e) => setValue("sourceUrl", e.target.value)}
            placeholder="https://..."
            className="min-w-[200px] flex-1 rounded border border-[#d2c2af] px-2 py-1.5 text-sm"
          />
          <button
            type="button"
            onClick={handleImport}
            disabled={importing}
            className="rounded border border-[#d2c2af] bg-white px-3 py-1.5 text-sm hover:bg-[#f6efe9] disabled:opacity-70"
          >
            Import
          </button>
        </div>
        {status && (
          <p
            className={`text-sm ${statusError ? "text-[#c0392b]" : "text-[#7f8c8d]"}`}
          >
            {status}
          </p>
        )}
      </div>

      <div className="flex flex-col gap-1">
        <label className="text-sm font-medium">Title *</label>
        <input
          type="text"
          value={form.title}
          onChange={(e) => setValue("title", e.target.value)}
          required
          className="rounded border border-[#d2c2af] px-2 py-1.5 text-sm"
        />
      </div>

      <div className="flex flex-col gap-1">
        <label className="text-sm font-medium">Ingredients *</label>
        <textarea
          value={form.ingredientsText}
          onChange={(e) => setValue("ingredientsText", e.target.value)}
          required
          rows={6}
          className="rounded border border-[#d2c2af] px-2 py-1.5 text-sm"
        />
      </div>

      <div className="flex flex-col gap-1">
        <label className="text-sm font-medium">Instructions</label>
        <textarea
          value={form.instructionsText}
          onChange={(e) => setValue("instructionsText", e.target.value)}
          rows={6}
          className="rounded border border-[#d2c2af] px-2 py-1.5 text-sm"
        />
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium">Prep (min)</label>
          <input
            type="number"
            min={0}
            value={form.prepTimeMinutes ?? ""}
            onChange={(e) =>
              setValue(
                "prepTimeMinutes",
                e.target.value === "" ? null : parseInt(e.target.value, 10)
              )
            }
            className="rounded border border-[#d2c2af] px-2 py-1.5 text-sm"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium">Cook (min)</label>
          <input
            type="number"
            min={0}
            value={form.cookTimeMinutes ?? ""}
            onChange={(e) =>
              setValue(
                "cookTimeMinutes",
                e.target.value === "" ? null : parseInt(e.target.value, 10)
              )
            }
            className="rounded border border-[#d2c2af] px-2 py-1.5 text-sm"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium">Total (min)</label>
          <input
            type="number"
            min={0}
            value={form.totalTimeMinutes ?? ""}
            onChange={(e) =>
              setValue(
                "totalTimeMinutes",
                e.target.value === "" ? null : parseInt(e.target.value, 10)
              )
            }
            className="rounded border border-[#d2c2af] px-2 py-1.5 text-sm"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium">Servings</label>
          <input
            type="text"
            value={form.servings}
            onChange={(e) => setValue("servings", e.target.value)}
            className="rounded border border-[#d2c2af] px-2 py-1.5 text-sm"
          />
        </div>
      </div>

      <div className="flex flex-col gap-1">
        <label className="text-sm font-medium">Image URL</label>
        <input
          type="url"
          value={form.imageUrl}
          onChange={(e) => setValue("imageUrl", e.target.value)}
          className="rounded border border-[#d2c2af] px-2 py-1.5 text-sm"
        />
      </div>

      <div className="flex flex-col gap-1">
        <label className="text-sm font-medium">Author</label>
        <input
          type="text"
          value={form.author}
          onChange={(e) => setValue("author", e.target.value)}
          className="rounded border border-[#d2c2af] px-2 py-1.5 text-sm"
        />
      </div>

      <div className="flex flex-col gap-1">
        <label className="text-sm font-medium">Category</label>
        <select
          value={form.category}
          onChange={(e) => setValue("category", e.target.value)}
          className="rounded border border-[#d2c2af] px-2 py-1.5 text-sm"
        >
          {CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {c.charAt(0).toUpperCase() + c.slice(1)}
            </option>
          ))}
        </select>
      </div>

      <div className="flex flex-col gap-1">
        <label className="text-sm font-medium">Description / notes</label>
        <textarea
          value={form.description}
          onChange={(e) => setValue("description", e.target.value)}
          rows={2}
          className="rounded border border-[#d2c2af] px-2 py-1.5 text-sm"
        />
      </div>

      <div className="flex flex-col gap-1">
        <label className="text-sm font-medium">Tags (comma-separated)</label>
        <input
          type="text"
          value={form.tags}
          onChange={(e) => setValue("tags", e.target.value)}
          placeholder="e.g. gluten-free, holiday"
          className="rounded border border-[#d2c2af] px-2 py-1.5 text-sm"
        />
      </div>

      <div className="flex gap-3">
        <button
          type="submit"
          disabled={loading}
          className="rounded bg-[#e67e22] px-4 py-2 text-sm font-medium text-white hover:bg-[#cf711f] disabled:opacity-70"
        >
          {loading ? "Saving…" : "Save"}
        </button>
        <Link
          href={recipeId ? `/recipes/${recipeId}` : "/"}
          className="rounded border border-[#d2c2af] bg-white px-4 py-2 text-sm hover:bg-[#f6efe9]"
        >
          Cancel
        </Link>
      </div>
    </form>
  );
}
