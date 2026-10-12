"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

type Component = {
  id: number;
  label: string;
  includedByDefault: boolean;
  childRecipe: { id: number; title: string; category: string };
};

type RecipeRow = { id: number; title: string; category: string };

export function RecipeComponentsPanel({
  parentRecipeId,
  initialComponents,
}: {
  parentRecipeId: number;
  initialComponents: Component[];
}) {
  const [components, setComponents] = useState(initialComponents);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<RecipeRow[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const search = useCallback(async (value: string) => {
    if (!value.trim()) {
      setResults([]);
      return;
    }
    const response = await fetch(`/api/recipes?q=${encodeURIComponent(value.trim())}`);
    const data = await response.json().catch(() => ({}));
    setResults((data.recipes ?? []).filter((row: RecipeRow) =>
      row.id !== parentRecipeId && !components.some((component) => component.childRecipe.id === row.id)
    ));
  }, [components, parentRecipeId]);

  useEffect(() => {
    const timer = setTimeout(() => void search(query).catch(() => setResults([])), 250);
    return () => clearTimeout(timer);
  }, [query, search]);

  async function addComponent(recipe: RecipeRow) {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch(`/api/recipes/${parentRecipeId}/components`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ childRecipeId: recipe.id }),
      });
      const data = await response.json().catch(() => ({}));
      if (!data.ok) throw new Error(data.error ?? "Could not add component.");
      setComponents((current) => [...current, data.component]);
      setQuery("");
      setResults([]);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not add component.");
    } finally {
      setBusy(false);
    }
  }

  async function toggleComponent(component: Component) {
    setError(null);
    const includedByDefault = !component.includedByDefault;
    setComponents((current) => current.map((item) => item.id === component.id ? { ...item, includedByDefault } : item));
    const response = await fetch(`/api/recipes/${parentRecipeId}/components`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: component.id, includedByDefault }),
    });
    if (!response.ok) {
      setComponents((current) => current.map((item) => item.id === component.id ? component : item));
      setError("Could not update the default setting.");
    }
  }

  async function removeComponent(component: Component) {
    setBusy(true);
    setError(null);
    const response = await fetch(`/api/recipes/${parentRecipeId}/components?id=${component.id}`, { method: "DELETE" });
    if (response.ok) setComponents((current) => current.filter((item) => item.id !== component.id));
    else setError("Could not remove component.");
    setBusy(false);
  }

  return (
    <section className="mb-6 rounded-2xl border border-[#eadfca] bg-white p-4">
      <div className="mb-3">
        <h3 className="font-medium text-slate-950">Optional components</h3>
        <p className="mt-1 text-xs text-slate-500">Keep sauces, toppings, and sides linked to this recipe. Included components add their ingredients to the weekly plan.</p>
      </div>
      {components.length > 0 && (
        <ul className="mb-3 space-y-2">
          {components.map((component) => (
            <li key={component.id} className="flex items-center gap-2 rounded-lg border border-[#eadfca] px-3 py-2 text-sm">
              <input type="checkbox" checked={component.includedByDefault} onChange={() => void toggleComponent(component)} aria-label={`Include ${component.childRecipe.title} by default`} />
              <Link href={`/recipes/${component.childRecipe.id}`} className="min-w-0 flex-1 font-medium text-[#5b3b2a] hover:underline">{component.label || component.childRecipe.title}</Link>
              <span className="text-xs text-slate-500">{component.includedByDefault ? "included" : "optional"}</span>
              <button type="button" disabled={busy} onClick={() => void removeComponent(component)} className="text-xs text-[#c0392b] hover:underline">Remove</button>
            </li>
          ))}
        </ul>
      )}
      <label className="mb-1 block text-xs font-medium text-slate-600">Add a recipe component</label>
      <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search sauces, sides, toppings…" className="w-full rounded border border-[#d2c2af] px-3 py-2 text-sm" />
      {results.length > 0 && <ul className="mt-2 space-y-1">{results.slice(0, 5).map((recipe) => <li key={recipe.id}><button type="button" disabled={busy} onClick={() => void addComponent(recipe)} className="w-full rounded border border-[#eadfca] px-3 py-2 text-left text-sm hover:bg-[#fff7e8]">{recipe.title}</button></li>)}</ul>}
      {error && <p className="mt-2 text-xs text-[#c0392b]">{error}</p>}
    </section>
  );
}
