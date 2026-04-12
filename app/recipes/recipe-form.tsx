"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { removeLastMergedRecipeBlocks } from "@/lib/merge-recipe-text";
import {
  LinkedRecipeHints,
  type LinkedAddonMergeResult,
} from "./linked-recipe-hints";
import { MergeRecipePanel } from "./merge-recipe-panel";

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
  const [linkHintsScanNonce, setLinkHintsScanNonce] = useState(0);

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
      setLinkHintsScanNonce((n) => n + 1);
      setStatus("Imported! Review and click Save.");
      setStatusError(false);
    } catch {
      setStatus("Import failed. Try again or fill manually.");
      setStatusError(true);
    } finally {
      setImporting(false);
    }
  }

  async function handleMergeLinkedFromUrl(
    url: string
  ): Promise<LinkedAddonMergeResult> {
    const ok = window.confirm(
      "Import this recipe from the link and append it below your current ingredients and instructions?\n\nNothing is saved until you click Save."
    );
    if (!ok) return { ok: false, cancelled: true };
    const res = await fetch("/api/recipes/merge-from-url", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        url,
        ingredientsText: form.ingredientsText,
        instructionsText: form.instructionsText,
        ...(form.sourceUrl.trim().startsWith("http://") ||
        form.sourceUrl.trim().startsWith("https://")
          ? { sourceUrl: form.sourceUrl.trim() }
          : {}),
      }),
    });
    const data = await res.json().catch(() => ({}));
    if (!data.ok) {
      setStatus(data.error ?? "Merge failed.");
      setStatusError(true);
      return { ok: false, error: data.error };
    }
    const mergedTitle = (data.mergedTitle as string) ?? "recipe";
    setForm((prev) => ({
      ...prev,
      ingredientsText: data.ingredientsText ?? prev.ingredientsText,
      instructionsText: data.instructionsText ?? prev.instructionsText,
    }));
    setStatus(
      `Merged “${mergedTitle}” into this recipe. Review and click Save.`
    );
    setStatusError(false);
    return { ok: true, mergedTitle };
  }

  function handleUndoMergedSection(mergedTitle: string) {
    setForm((prev) => {
      const { ingredientsText, instructionsText } =
        removeLastMergedRecipeBlocks(
          prev.ingredientsText,
          prev.instructionsText,
          mergedTitle
        );
      return { ...prev, ingredientsText, instructionsText };
    });
    setStatus("Removed merged add-on from this draft.");
    setStatusError(false);
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

      <LinkedRecipeHints
        parentRecipeId={recipeId}
        sourceUrl={form.sourceUrl}
        autoScanNonce={linkHintsScanNonce}
        ingredientsText={form.ingredientsText}
        instructionsText={form.instructionsText}
        onUndoMergedSection={handleUndoMergedSection}
        onMergeFromLibrary={
          recipeId != null
            ? async (
                childRecipeId,
                mergedTitle
              ): Promise<LinkedAddonMergeResult> => {
                const ok = window.confirm(
                  `Merge “${mergedTitle}” from your library into this recipe?\n\n` +
                    "Its ingredients and instructions will be appended with a heading. Nothing is saved until you click Save."
                );
                if (!ok) return { ok: false, cancelled: true };
                const res = await fetch(`/api/recipes/${recipeId}/merge`, {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    childRecipeId,
                    ingredientsText: form.ingredientsText,
                    instructionsText: form.instructionsText,
                  }),
                });
                const data = await res.json().catch(() => ({}));
                if (!data.ok) {
                  setStatus(data.error ?? "Merge failed.");
                  setStatusError(true);
                  return { ok: false, error: data.error };
                }
                const title = (data.mergedTitle as string) ?? mergedTitle;
                setForm((prev) => ({
                  ...prev,
                  ingredientsText: data.ingredientsText ?? prev.ingredientsText,
                  instructionsText:
                    data.instructionsText ?? prev.instructionsText,
                }));
                setStatus(
                  `Merged “${title}” into this recipe. Review and click Save to store it.`
                );
                setStatusError(false);
                return { ok: true, mergedTitle: title };
              }
            : undefined
        }
        onMergeFromUrl={handleMergeLinkedFromUrl}
      />

      {recipeId != null && (
        <MergeRecipePanel
          parentRecipeId={recipeId}
          ingredientsText={form.ingredientsText}
          instructionsText={form.instructionsText}
          onMerged={(ing, inst, mergedTitle) => {
            setForm((prev) => ({
              ...prev,
              ingredientsText: ing,
              instructionsText: inst,
            }));
            setStatus(
              `Merged “${mergedTitle}” into this recipe. Review the text and click Save to store it.`
            );
            setStatusError(false);
          }}
        />
      )}

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
