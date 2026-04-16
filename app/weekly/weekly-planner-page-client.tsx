"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

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

type WeekStartPreference = "monday" | "sunday";

function initialWeekStartPreference(): WeekStartPreference {
  if (typeof window === "undefined") return "monday";
  const stored = window.localStorage.getItem("weeklyPlanner.weekStart");
  return stored === "sunday" ? "sunday" : "monday";
}

function dayLabel(key: DayKey): string {
  return key.charAt(0).toUpperCase() + key.slice(1);
}

function orderedDays(weekStartPreference: WeekStartPreference): DayKey[] {
  return weekStartPreference === "sunday"
    ? [
        "sunday",
        "monday",
        "tuesday",
        "wednesday",
        "thursday",
        "friday",
        "saturday",
      ]
    : [
        "monday",
        "tuesday",
        "wednesday",
        "thursday",
        "friday",
        "saturday",
        "sunday",
      ];
}

function startOfWeek(base = new Date(), weekStartPreference: WeekStartPreference): Date {
  const d = new Date(base);
  const day = d.getDay();
  const diff =
    weekStartPreference === "sunday"
      ? -day
      : day === 0
        ? -6
        : 1 - day;
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

function plannedItemDateKey(value: string): string {
  if (/^\d{4}-\d{2}-\d{2}/.test(value)) return value.slice(0, 10);
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  return d.toISOString().slice(0, 10);
}

function weekPoolStorageKey(weekStartPreference: WeekStartPreference, weekStart: Date): string {
  return `weeklyPlanner.weekPool.${weekStartPreference}.${toIsoDate(weekStart)}`;
}

export function WeeklyPlannerPageClient({
  recipes,
  initialItems,
}: {
  recipes: RecipeOption[];
  initialItems: WeeklyItem[];
}) {
  const initialPref = initialWeekStartPreference();
  const [items, setItems] = useState<WeeklyItem[]>(initialItems);
  const [weekStartPreference, setWeekStartPreference] =
    useState<WeekStartPreference>(initialPref);
  const [weekStart, setWeekStart] = useState<Date>(startOfWeek(new Date(), initialPref));
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
  const [spanDays, setSpanDays] = useState(1);
  const [weekPoolPick, setWeekPoolPick] = useState("");
  const [, setWeekPoolRevision] = useState(0);
  const dayOrder = useMemo(
    () => orderedDays(weekStartPreference),
    [weekStartPreference]
  );

  const refreshWeek = useCallback(
    async (targetStart: Date) => {
      const start = toIsoDate(targetStart);
      const endDate = new Date(targetStart);
      endDate.setDate(endDate.getDate() + 6);
      const end = toIsoDate(endDate);
      const res = await fetch(`/api/weekly-plan?start=${start}&end=${end}`);
      const data = await res.json().catch(() => ({ items: [] }));
      if (data.ok) setItems(data.items ?? []);
    },
    []
  );

  useEffect(() => {
    if (typeof window !== "undefined") {
      window.localStorage.setItem("weeklyPlanner.weekStart", weekStartPreference);
    }
  }, [weekStartPreference]);

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
  }, [weekStart, dayOrder]);

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
      const date = plannedItemDateKey(item.plannedFor);
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
  }, [items, weekDates, dayOrder]);

  const uniqueWeekRecipes = useMemo(() => {
    const m = new Map<number, string>();
    for (const item of items) {
      m.set(item.recipe.id, item.recipe.title);
    }
    return Array.from(m.entries())
      .map(([id, title]) => ({ id, title }))
      .sort((a, b) => a.title.localeCompare(b.title));
  }, [items]);

  const weekPoolKey = useMemo(
    () => weekPoolStorageKey(weekStartPreference, weekStart),
    [weekStartPreference, weekStart]
  );

  const manualWeekRecipeIds = (() => {
    if (typeof window === "undefined") return [] as number[];
    const raw = window.localStorage.getItem(weekPoolKey);
    if (!raw) return [] as number[];
    try {
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) return [] as number[];
      return parsed
        .map((v) => Number(v))
        .filter((v) => Number.isInteger(v) && v > 0);
    } catch {
      return [] as number[];
    }
  })();

  const weekPoolRecipes = useMemo(() => {
    const ids = new Set([
      ...uniqueWeekRecipes.map((r) => r.id),
      ...manualWeekRecipeIds,
    ]);
    return recipes
      .filter((r) => ids.has(r.id))
      .map((r) => ({ id: r.id, title: r.title }))
      .sort((a, b) => a.title.localeCompare(b.title));
  }, [recipes, uniqueWeekRecipes, manualWeekRecipeIds]);

  function saveManualWeekPool(ids: number[]) {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(weekPoolKey, JSON.stringify(Array.from(new Set(ids))));
    setWeekPoolRevision((v) => v + 1);
  }

  async function addRecipe(day: DayKey) {
    const selected = Number(addByDay[day]);
    if (!Number.isInteger(selected) || selected < 1) {
      setStatus("Select a recipe first.");
      return;
    }
    setBusy(true);
    const start = new Date(`${weekDates[day]}T12:00:00.000Z`);
    let firstError: string | null = null;
    let created = 0;
    for (let i = 0; i < spanDays; i++) {
      const d = new Date(start);
      d.setUTCDate(d.getUTCDate() + i);
      const plannedFor = d.toISOString().slice(0, 10);
      const res = await fetch("/api/weekly-plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ recipeId: selected, plannedFor }),
      });
      const data = await res.json().catch(() => ({}));
      if (!data.ok && !firstError) {
        firstError = data.error ?? "Could not add recipe to this day.";
      }
      if (data.ok) created += 1;
    }
    setBusy(false);
    if (firstError && created === 0) {
      setStatus(firstError);
      return;
    }
    setStatus(
      created > 1
        ? `Added to ${dayLabel(day)} and next ${created - 1} day(s).`
        : `Added to ${dayLabel(day)}.`
    );
    setAddByDay((prev) => ({ ...prev, [day]: "" }));
    await refreshWeek(weekStart);
  }

  async function removeMeal(item: WeeklyItem) {
    setBusy(true);
    await fetch("/api/weekly-plan", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: item.id }),
    });
    setBusy(false);
    await refreshWeek(weekStart);
  }

  function addRecipeToWeekPool() {
    const id = Number(weekPoolPick);
    if (!Number.isInteger(id) || id < 1) {
      setStatus("Select a recipe to add to this week first.");
      return;
    }
    saveManualWeekPool(manualWeekRecipeIds.includes(id) ? manualWeekRecipeIds : [...manualWeekRecipeIds, id]);
    setWeekPoolPick("");
    setStatus("Added to this week's recipe list. Assign it to a day when ready.");
  }

  function removeRecipeFromWeekPool(recipeId: number) {
    saveManualWeekPool(manualWeekRecipeIds.filter((id) => id !== recipeId));
    setAddByDay((prev) => {
      const next = { ...prev };
      (Object.keys(next) as DayKey[]).forEach((k) => {
        if (next[k] === String(recipeId)) next[k] = "";
      });
      return next;
    });
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
            Assign recipes to specific days. Suggestions learn from repetition frequency.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <label className="rounded border border-[#d2c2af] bg-white px-2 py-1 text-sm">
            Week starts:
            <select
              value={weekStartPreference}
              onChange={(e) => {
                const pref = e.target.value as WeekStartPreference;
                setWeekStartPreference(pref);
                const nextStart = startOfWeek(weekStart, pref);
                setWeekStart(nextStart);
                void refreshWeek(nextStart);
              }}
              className="ml-2 bg-transparent"
            >
              <option value="monday">Monday</option>
              <option value="sunday">Sunday</option>
            </select>
          </label>
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

      <section className="rounded border border-[#e0d4c7] bg-white p-4 shadow-sm">
        <h3 className="font-semibold">This week&apos;s recipe list</h3>
        <div className="mt-2 flex gap-2">
          <select
            value={weekPoolPick}
            onChange={(e) => setWeekPoolPick(e.target.value)}
            className="min-w-0 flex-1 rounded border border-[#d2c2af] px-2 py-1 text-sm"
          >
            <option value="">Add recipe to this week&apos;s list…</option>
            {recipes.map((r) => (
              <option key={r.id} value={r.id}>
                {r.title}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={addRecipeToWeekPool}
            className="rounded border border-[#d2c2af] bg-white px-2 py-1 text-sm hover:bg-[#f6efe9]"
          >
            Add to week list
          </button>
        </div>
        <div className="mt-2 flex items-center gap-2 text-xs text-[#7f8c8d]">
          <span>When adding:</span>
          <label className="inline-flex items-center gap-1">
            span
            <input
              type="number"
              min={1}
              max={7}
              value={spanDays}
              onChange={(e) =>
                setSpanDays(Math.min(7, Math.max(1, Number(e.target.value) || 1)))
              }
              className="w-14 rounded border border-[#d2c2af] px-1 py-0.5 text-xs"
            />
            day(s)
          </label>
          <span>You can add multiple recipes to the same day.</span>
        </div>
        {weekPoolRecipes.length === 0 ? (
          <p className="mt-1 text-sm text-[#7f8c8d]">
            No recipes assigned this week yet.
          </p>
        ) : (
          <ul className="mt-2 space-y-1 text-sm">
            {weekPoolRecipes.map((r) => (
              <li key={r.id} className="flex items-center justify-between rounded border border-[#f0e7dc] bg-[#fffdf8] px-2 py-1">
                <span>{r.title}</span>
                <button
                  type="button"
                  onClick={() => removeRecipeFromWeekPool(r.id)}
                  className="text-xs underline"
                >
                  Remove
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-7">
        {dayOrder.map((day) => (
          <section
            key={day}
            className="rounded border border-[#e0d4c7] bg-white p-3 shadow-sm min-h-[260px]"
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
                <option value="">Assign recipe…</option>
                {weekPoolRecipes.map((r) => (
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
                Add recipe
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
                    <div className="mt-1 flex gap-2 text-[11px]">
                      <button
                        type="button"
                        onClick={() => void removeMeal(item)}
                        className="underline"
                      >
                        Remove
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
        ))}
      </div>

    </div>
  );
}
