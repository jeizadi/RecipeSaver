"use client";

import Link from "next/link";
import { FormEvent, useEffect, useMemo, useState } from "react";

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

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm font-medium uppercase tracking-wide text-[#e67e22]">Shop</p>
          <h2 className="text-2xl font-semibold">What do I need this week?</h2>
          <p className="mt-1 text-sm text-[#7f8c8d]">Meals, staples, and everything else in one list.</p>
        </div>
        <div className="flex items-center gap-2 text-sm">
          <button type="button" onClick={() => setWeekStart((value) => shiftWeek(value, -7))} className="rounded border border-[#d2c2af] bg-white px-2 py-1.5">←</button>
          <span className="rounded bg-[#f6efe9] px-3 py-1.5 font-medium">Week of {prettyDate(weekStart)}</span>
          <button type="button" onClick={() => setWeekStart((value) => shiftWeek(value, 7))} className="rounded border border-[#d2c2af] bg-white px-2 py-1.5">→</button>
        </div>
      </div>

      <section className="rounded-xl border border-[#e0d4c7] bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-lg font-semibold">Shopping list</p>
            <p className="text-sm text-[#7f8c8d]">{completed} of {items.length} items checked</p>
          </div>
          <div className="flex gap-2">
            <button type="button" onClick={() => void regenerate()} disabled={busy} className="rounded border border-[#d2c2af] px-3 py-2 text-sm hover:bg-[#f6efe9] disabled:opacity-60">Update from meals</button>
            <Link href="/weekly" className="rounded bg-[#e67e22] px-3 py-2 text-sm font-medium text-white hover:bg-[#cf711f]">Plan a meal</Link>
          </div>
        </div>
        <div className="mt-3 h-2 overflow-hidden rounded-full bg-[#f0e7dc]">
          <div className="h-full rounded-full bg-[#e67e22] transition-all" style={{ width: `${items.length ? (completed / items.length) * 100 : 0}%` }} />
        </div>
      </section>

      {status ? <p className="text-sm text-[#7f8c8d]">{status}</p> : null}
      {busy && !items.length ? <p className="rounded-lg bg-white p-6 text-sm text-[#7f8c8d]">Loading your list…</p> : null}
      {!busy && !items.length ? (
        <section className="rounded-xl border border-dashed border-[#d2c2af] bg-white p-8 text-center">
          <p className="font-medium">Your list is empty.</p>
          <p className="mt-1 text-sm text-[#7f8c8d]">Plan a meal or add a staple below to get started.</p>
        </section>
      ) : null}

      <div className="space-y-3">
        {grouped.map(({ category, items: categoryItems }) => (
          <section key={category} className="rounded-xl border border-[#e0d4c7] bg-white p-4 shadow-sm">
            <h3 className="mb-2 font-semibold">{CATEGORY_LABELS[category] ?? category}</h3>
            <ul className="divide-y divide-[#f0e7dc]">
              {categoryItems.map((item) => (
                <li key={item.id} className="flex items-start gap-3 py-3 first:pt-1 last:pb-1">
                  <input type="checkbox" checked={item.checked} onChange={() => void toggle(item)} className="mt-1 h-5 w-5 accent-[#e67e22]" aria-label={`Mark ${item.name} complete`} />
                  <div className="min-w-0 flex-1">
                    <p className={item.checked ? "text-sm text-[#a59a91] line-through" : "text-sm font-medium"}>{item.quantity ? `${item.quantity} ` : ""}{item.name}</p>
                    {item.sourceLabels ? <p className="mt-0.5 truncate text-xs text-[#7f8c8d]">{sourceSummary(item.sourceLabels)}</p> : null}
                  </div>
                  <button type="button" onClick={() => void remove(item)} className="text-xs text-[#7f8c8d] underline">Remove</button>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>

      <section className="rounded-xl border border-[#e0d4c7] bg-white p-4 shadow-sm">
        <h3 className="font-semibold">Add a staple or one-off item</h3>
        <form onSubmit={addItem} className="mt-3 grid gap-2 sm:grid-cols-[1fr_9rem_auto]">
          <input value={name} onChange={(event) => setName(event.target.value)} placeholder="e.g. Coffee" className="rounded border border-[#d2c2af] px-3 py-2 text-sm" />
          <input value={quantity} onChange={(event) => setQuantity(event.target.value)} placeholder="Quantity" className="rounded border border-[#d2c2af] px-3 py-2 text-sm" />
          <button type="submit" disabled={busy || !name.trim()} className="rounded bg-[#e67e22] px-3 py-2 text-sm font-medium text-white hover:bg-[#cf711f] disabled:opacity-60">Add item</button>
        </form>
        <label className="mt-3 flex items-center gap-2 text-sm text-[#7f8c8d]">
          <input type="checkbox" checked={saveAsStaple} onChange={(event) => setSaveAsStaple(event.target.checked)} className="accent-[#e67e22]" />
          Save this as a recurring staple
        </label>
      </section>
    </div>
  );
}
