"use client";

import { useMemo, useState } from "react";

type RecipeOption = { id: number; title: string; category: string };

type WeeklyItem = {
  id: number;
  recipeId: number;
  plannedFor: string;
  status: "planned" | "cooked" | "skipped";
  rating: number | null;
  recipe: { id: number; title: string };
};

type DayKey =
  | "monday"
  | "tuesday"
  | "wednesday"
  | "thursday"
  | "friday"
  | "saturday"
  | "sunday";

const dayOrder: DayKey[] = [
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
  "sunday",
];

function dayLabel(key: DayKey): string {
  return key.charAt(0).toUpperCase() + key.slice(1);
}

function startOfWeekMonday(base = new Date()): Date {
  const d = new Date(base);
  const day = d.getDay(); // 0 Sun..6 Sat
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

function toIsoDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function WeeklyPlannerPageClient({
  recipes,
  initialItems,
}: {
  recipes: RecipeOption[];
  initialItems: WeeklyItem[];
}) {
  const [items, setItems] = useState<WeeklyItem[]>(initialItems);
  const [weekStart, setWeekStart] = useState<Date>(startOfWeekMonday(new Date()));
  const [addByDay, setAddByDay] = useState<Record<DayKey, string>>({
    monday: "",
    tuesday: "",
    wednesday: "",
    thursday: "",
    friday: "",
    saturday: "",
    sunday: "",
  });
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);

  const weekDates = useMemo(() => {
    const out: Record<DayKey, string> = {
      monday: "",
      tuesday: "",
      wednesday: "",
      thursday: "",
      friday: "",
      saturday: "",
      sunday: "",
    };
    dayOrder.forEach((k, idx) => {
      const d = new Date(weekStart);
      d.setDate(d.getDate() + idx);
      out[k] = toIsoDate(d);
    });
    return out;
  }, [weekStart]);

  const byDay = useMemo(() => {
    const out: Record<DayKey, WeeklyItem[]> = {
      monday: [],
      tuesday: [],
      wednesday: [],
      thursday: [],
      friday: [],
      saturday: [],
      sunday: [],
    };
    for (const item of items) {
      const date = toIsoDate(new Date(item.plannedFor));
      const key = (Object.entries(weekDates).find(([, v]) => v === date)?.[0] ??
        null) as DayKey | null;
      if (key) out[key].push(item);
    }
    for (const key of dayOrder) {
      out[key].sort(
        (a, b) =>
          new Date(a.plannedFor).getTime() - new Date(b.plannedFor).getTime()
      );
    }
    return out;
  }, [items, weekDates]);

  const uniqueWeekRecipes = useMemo(() => {
    const m = new Map<number, string>();
    for (const item of items) {
      m.set(item.recipe.id, item.recipe.title);
    }
    return Array.from(m.entries())
      .map(([id, title]) => ({ id, title }))
      .sort((a, b) => a.title.localeCompare(b.title));
  }, [items]);

  async function refreshWeek(targetStart = weekStart) {
    const start = toIsoDate(targetStart);
    const endDate = new Date(targetStart);
    endDate.setDate(endDate.getDate() + 6);
    const end = toIsoDate(endDate);
    const res = await fetch(`/api/weekly-plan?start=${start}&end=${end}`);
    const data = await res.json().catch(() => ({ items: [] }));
    if (data.ok) setItems(data.items ?? []);
  }

  async function addRecipe(day: DayKey) {
    const selected = Number(addByDay[day]);
    if (!Number.isInteger(selected) || selected < 1) {
      setStatus("Select a recipe first.");
      return;
    }
    setBusy(true);
    const plannedFor = weekDates[day];
    const res = await fetch("/api/weekly-plan", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ recipeId: selected, plannedFor }),
    });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (!data.ok) {
      setStatus(data.error ?? "Could not add recipe to this day.");
      return;
    }
    setStatus(`Added to ${dayLabel(day)}.`);
    setAddByDay((prev) => ({ ...prev, [day]: "" }));
    await refreshWeek();
  }

  async function setMealStatus(item: WeeklyItem, statusValue: "planned" | "cooked" | "skipped") {
    setBusy(true);
    await fetch("/api/weekly-plan", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: item.id, status: statusValue }),
    });
    setBusy(false);
    await refreshWeek();
  }

  function shiftWeek(deltaDays: number) {
    const d = new Date(weekStart);
    d.setDate(d.getDate() + deltaDays);
    d.setHours(0, 0, 0, 0);
    setWeekStart(d);
    void refreshWeek(d);
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-xl font-semibold">Weekly plan</h2>
          <p className="text-sm text-[#7f8c8d]">
            Assign recipes to specific days and track what you actually cooked.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => shiftWeek(-7)}
            className="rounded border border-[#d2c2af] bg-white px-2 py-1 text-sm hover:bg-[#f6efe9]"
          >
            Prev week
          </button>
          <div className="rounded bg-[#fffdf8] px-2 py-1 text-sm">
            {toIsoDate(weekStart)} to{" "}
            {(() => {
              const e = new Date(weekStart);
              e.setDate(e.getDate() + 6);
              return toIsoDate(e);
            })()}
          </div>
          <button
            type="button"
            onClick={() => shiftWeek(7)}
            className="rounded border border-[#d2c2af] bg-white px-2 py-1 text-sm hover:bg-[#f6efe9]"
          >
            Next week
          </button>
        </div>
      </div>

      {status ? <p className="text-sm text-[#7f8c8d]">{status}</p> : null}

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {dayOrder.map((day) => (
          <section
            key={day}
            className="rounded border border-[#e0d4c7] bg-white p-3 shadow-sm"
          >
            <div className="mb-2">
              <p className="font-semibold text-[#5b3b2a]">{dayLabel(day)}</p>
              <p className="text-xs text-[#7f8c8d]">{weekDates[day]}</p>
            </div>
            <div className="mb-2 flex gap-2">
              <select
                value={addByDay[day]}
                onChange={(e) =>
                  setAddByDay((prev) => ({ ...prev, [day]: e.target.value }))
                }
                className="min-w-0 flex-1 rounded border border-[#d2c2af] px-2 py-1 text-xs"
              >
                <option value="">Add recipe…</option>
                {recipes.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.title}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={() => void addRecipe(day)}
                disabled={busy}
                className="rounded bg-[#e67e22] px-2 py-1 text-xs font-medium text-white hover:bg-[#cf711f] disabled:opacity-60"
              >
                Add
              </button>
            </div>
            {byDay[day].length === 0 ? (
              <p className="text-xs text-[#7f8c8d]">No recipes assigned.</p>
            ) : (
              <ul className="space-y-1">
                {byDay[day].map((item) => (
                  <li
                    key={item.id}
                    className="rounded border border-[#f0e7dc] bg-[#fffdf8] p-2"
                  >
                    <p className="text-sm font-medium">{item.recipe.title}</p>
                    <p className="text-[11px] text-[#7f8c8d]">
                      status: {item.status}
                    </p>
                    <div className="mt-1 flex gap-2 text-[11px]">
                      <button
                        type="button"
                        onClick={() => void setMealStatus(item, "planned")}
                        className="underline"
                      >
                        Planned
                      </button>
                      <button
                        type="button"
                        onClick={() => void setMealStatus(item, "cooked")}
                        className="underline"
                      >
                        Cooked
                      </button>
                      <button
                        type="button"
                        onClick={() => void setMealStatus(item, "skipped")}
                        className="underline"
                      >
                        Skipped
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
        ))}
      </div>

      <section className="rounded border border-[#e0d4c7] bg-white p-4 shadow-sm">
        <h3 className="font-semibold">This week&apos;s recipe list</h3>
        {uniqueWeekRecipes.length === 0 ? (
          <p className="mt-1 text-sm text-[#7f8c8d]">
            No recipes assigned this week yet.
          </p>
        ) : (
          <ul className="mt-2 list-inside list-disc text-sm">
            {uniqueWeekRecipes.map((r) => (
              <li key={r.id}>{r.title}</li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
