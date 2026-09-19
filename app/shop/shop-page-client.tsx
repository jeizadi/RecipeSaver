"use client";

import Link from "next/link";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";

type ShoppingItem = {
  id: number;
  name: string;
  quantity: string;
  category: string;
  checked: boolean;
  isManual: boolean;
  sourceLabels: string;
};

const CATEGORY_ORDER = [
  "produce",
  "meat & seafood",
  "dairy & eggs",
  "pantry",
  "frozen",
  "bakery",
  "household",
  "other",
];

const CATEGORY_LABELS: Record<string, string> = {
  produce: "Produce",
  "meat & seafood": "Meat & seafood",
  "dairy & eggs": "Dairy & eggs",
  pantry: "Pantry",
  frozen: "Frozen",
  bakery: "Bakery",
  household: "Household",
  other: "Other",
};

function mondayKey(base = new Date()): string {
  const date = new Date(base);
  const day = date.getDay();
  date.setDate(date.getDate() + (day === 0 ? -6 : 1 - day));
  return date.toISOString().slice(0, 10);
}

function shiftWeek(value: string, amount: number): string {
  const date = new Date(`${value}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + amount);
  return date.toISOString().slice(0, 10);
}

function prettyDate(value: string): string {
  return new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" }).format(
    new Date(`${value}T00:00:00.000Z`)
  );
}

function sourceSummary(raw: string): string {
  try {
    const labels = JSON.parse(raw) as unknown;
    if (Array.isArray(labels) && labels.length) return labels.join(", ");
  } catch {
    // Older rows may contain plain text.
  }
  return raw;
}

export function ShopPageClient() {
  const [weekStart, setWeekStart] = useState(mondayKey);
  const [items, setItems] = useState<ShoppingItem[]>([]);
  const [name, setName] = useState("");
  const [quantity, setQuantity] = useState("");
  const [saveAsStaple, setSaveAsStaple] = useState(false);
  const [busy, setBusy] = useState(true);
  const [status, setStatus] = useState("");

  async function load(target = weekStart) {
    setBusy(true);
    const response = await fetch(`/api/shopping-list?weekStart=${target}`);
    const data = await response.json().catch(() => ({}));
    if (data.ok) setItems(data.list?.items ?? []);
    else setStatus(data.error ?? "Could not load your shopping list.");
    setBusy(false);
  }

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/shopping-list?weekStart=${weekStart}`)
      .then((response) => response.json())
      .then((data) => {
        if (cancelled) return;
        if (data.ok) setItems(data.list?.items ?? []);
        else setStatus(data.error ?? "Could not load your shopping list.");
        setBusy(false);
      })
      .catch(() => {
        if (!cancelled) {
          setStatus("Could not load your shopping list.");
          setBusy(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [weekStart]);

  const completed = items.filter((item) => item.checked).length;
  const grouped = useMemo(() => {
    const map = new Map<string, ShoppingItem[]>();
    for (const item of items) {
      const group = map.get(item.category) ?? [];
      group.push(item);
      map.set(item.category, group);
    }
    return CATEGORY_ORDER.filter((category) => map.has(category)).map((category) => ({
      category,
      items: map.get(category) ?? [],
    }));
  }, [items]);

  async function toggle(item: ShoppingItem) {
    setItems((current) => current.map((x) => (x.id === item.id ? { ...x, checked: !x.checked } : x)));
    const response = await fetch("/api/shopping-list", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: item.id, checked: !item.checked }),
    });
    if (!response.ok) await load();
  }

  async function addItem(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!name.trim()) return;
    setBusy(true);
    const response = await fetch("/api/shopping-list", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "add", weekStart, name, quantity, saveAsStaple }),
    });
    const data = await response.json().catch(() => ({}));
    if (data.ok) {
      setName("");
      setQuantity("");
      setSaveAsStaple(false);
      setStatus(saveAsStaple ? "Added to this week and saved as a staple." : "Added to this week.");
      await load();
    } else {
      setStatus(data.error ?? "Could not add item.");
      setBusy(false);
    }
  }

  async function remove(item: ShoppingItem) {
    const response = await fetch(`/api/shopping-list?id=${item.id}`, { method: "DELETE" });
    if (response.ok) setItems((current) => current.filter((x) => x.id !== item.id));
  }

  async function regenerate() {
    setBusy(true);
    const response = await fetch("/api/shopping-list", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "sync", weekStart }),
    });
    const data = await response.json().catch(() => ({}));
    if (data.ok) {
      setItems(data.list?.items ?? []);
      setStatus("Updated from your planned meals and saved staples.");
    } else setStatus(data.error ?? "Could not update the list.");
    setBusy(false);
  }

  async function copyForGoogleKeep() {
    const lines = grouped.flatMap(({ items: categoryItems }) =>
      categoryItems
        .filter((item) => !item.checked)
        .map((item) => `${item.quantity ? `${item.quantity} ` : ""}${item.name}`)
    );
    try {
      await navigator.clipboard.writeText(lines.join("\n").trim());
      setStatus("Copied your checklist. Paste it into a Google Keep note.");
    } catch {
      setStatus("Could not copy the checklist. Check your browser permissions.");
    }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-4 pb-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.16em] text-[#b66a00]">Your weekly shop</p>
          <h2 className="mt-1 text-3xl font-semibold tracking-tight text-slate-950">What do you need this week?</h2>
          <p className="mt-1 text-sm text-slate-500">Meals, staples, and everything else in one calm list.</p>
        </div>
        <div className="flex items-center gap-2 text-sm">
          <Button type="button" variant="ghost" onClick={() => setWeekStart((value) => shiftWeek(value, -7))} aria-label="Previous week">←</Button>
          <span className="px-1 text-sm font-medium text-slate-500">Week of {prettyDate(weekStart)}</span>
          <Button type="button" variant="ghost" onClick={() => setWeekStart((value) => shiftWeek(value, 7))} aria-label="Next week">→</Button>
        </div>
      </div>

      <Card className="border-[#f0d48d] bg-[#fff0c7] shadow-none">
        <CardContent className="p-4 sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-lg font-semibold text-[#4a2b00]">Shopping list</p>
            <p className="text-sm text-[#8a5200]">{completed} of {items.length} items checked</p>
          </div>
          <div className="flex gap-2">
            <Button type="button" variant="ghost" onClick={() => void regenerate()} disabled={busy}>Refresh</Button>
            <Button type="button" variant="ghost" onClick={() => void copyForGoogleKeep()} disabled={!items.length}>Copy for Keep</Button>
            <Link href="/weekly" className="inline-flex min-h-10 items-center rounded-xl bg-[#fff0c7] px-3 py-2 text-sm font-medium text-[#8a5200] hover:bg-[#ffe6a3]">Plan meals</Link>
          </div>
        </div>
        <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-slate-100">
          <div className="h-full rounded-full bg-[#e9a227] transition-all" style={{ width: `${items.length ? (completed / items.length) * 100 : 0}%` }} />
        </div>
        </CardContent>
      </Card>

      {status ? <p className="text-sm text-[#7f8c8d]">{status}</p> : null}
      {busy && !items.length ? <p className="rounded-lg bg-white p-6 text-sm text-[#7f8c8d]">Loading your list…</p> : null}
      {!busy && !items.length ? (
        <Card className="border-dashed">
          <CardContent className="p-8 text-center">
          <p className="font-medium text-slate-900">Your list is empty.</p>
          <p className="mt-1 text-sm text-slate-500">Plan a meal or add a staple below to get started.</p>
          </CardContent>
        </Card>
      ) : null}

      <div className="space-y-3">
        {grouped.length ? <Card><CardContent className="p-4 sm:p-5"><div className="divide-y divide-slate-100">
          {grouped.map(({ category, items: categoryItems }) => (
            <section key={category} className="border-l-4 border-[#f4a51c] py-2 pl-3 first:pt-0 last:pb-0">
              <h3 className="mb-1 text-xs font-semibold uppercase tracking-[0.14em] text-[#b66a00]">{CATEGORY_LABELS[category] ?? category}</h3>
              <ul className="divide-y divide-slate-100">
              {categoryItems.map((item) => (
                <li key={item.id} className="flex items-start gap-3 py-3 first:pt-1 last:pb-1">
                  <Checkbox checked={item.checked} onChange={() => void toggle(item)} aria-label={`Mark ${item.name} complete`} />
                  <div className="min-w-0 flex-1">
                    <p title={item.sourceLabels ? sourceSummary(item.sourceLabels) : undefined} className={item.checked ? "text-sm text-slate-400 line-through" : "text-sm font-medium text-slate-800"}>{item.quantity ? `${item.quantity} ` : ""}{item.name}</p>
                  </div>
                  <Button type="button" variant="quiet" onClick={() => void remove(item)} className="min-h-7 px-1 text-xs">Remove</Button>
                </li>
              ))}
              </ul>
            </section>
          ))}
        </div></CardContent></Card> : null}
      </div>

      <Card className="bg-[#fffdf7]">
        <CardContent className="p-4 sm:p-5">
        <h3 className="font-semibold text-slate-900">Add an item</h3>
        <form onSubmit={addItem} className="mt-3 grid gap-2 sm:grid-cols-[1fr_9rem_auto]">
          <input value={name} onChange={(event) => setName(event.target.value)} placeholder="e.g. Coffee" className="min-h-10 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none ring-[#e9a227] placeholder:text-slate-400 focus:ring-2" />
          <input value={quantity} onChange={(event) => setQuantity(event.target.value)} placeholder="Quantity" className="min-h-10 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none ring-[#e9a227] placeholder:text-slate-400 focus:ring-2" />
          <Button type="submit" disabled={busy || !name.trim()}>Add item</Button>
        </form>
        <label className="mt-3 flex items-center gap-2 text-sm text-slate-500">
          <Checkbox checked={saveAsStaple} onChange={(event) => setSaveAsStaple(event.target.checked)} />
          Save this as a recurring staple
        </label>
        </CardContent>
      </Card>
    </div>
  );
}
