"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

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
    <div className="mx-auto max-w-5xl space-y-4 pb-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.16em] text-[#b66a00]">Plan</p>
          <h2 className="mt-1 text-3xl font-semibold tracking-tight text-slate-950">Your week, at a glance</h2>
          <p className="mt-1 text-sm text-slate-500">Choose what you want to cook, then we&apos;ll build the shop list.</p>
        </div>
        <div className="flex items-center gap-1">
          <Button type="button" variant="ghost" onClick={() => shiftWeek(-7)} aria-label="Previous week">←</Button>
          <span className="px-2 text-sm font-medium text-slate-500">{toIsoDate(weekStart)} – {(() => { const e = new Date(weekStart); e.setDate(e.getDate() + 6); return toIsoDate(e); })()}</span>
          <Button type="button" variant="ghost" onClick={() => shiftWeek(7)} aria-label="Next week">→</Button>
        </div>
      </header>

      <Card className="border-[#f0d48d] bg-[#fff0c7] shadow-none">
        <CardContent className="p-4 sm:p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="font-semibold text-[#4a2b00]">Meal ideas</h3>
              <p className="mt-1 text-sm text-[#8a5200]">Keep a short list of recipes you&apos;re considering.</p>
            </div>
            <label className="text-sm text-[#8a5200]">
              Week starts
              <select
                value={weekStartPreference}
                onChange={(e) => {
                  const pref = e.target.value as WeekStartPreference;
                  setWeekStartPreference(pref);
                  const nextStart = startOfWeek(weekStart, pref);
                  setWeekStart(nextStart);
                  void refreshWeek(nextStart);
                }}
                className="ml-2 rounded-lg border border-[#f0d48d] bg-white px-2 py-1.5 text-sm text-slate-700"
              >
                <option value="monday">Monday</option>
                <option value="sunday">Sunday</option>
              </select>
            </label>
          </div>
          <div className="mt-4 flex flex-col gap-2 sm:flex-row">
            <select
              value={weekPoolPick}
              onChange={(e) => setWeekPoolPick(e.target.value)}
              className="min-h-10 min-w-0 flex-1 rounded-xl border border-[#f0d48d] bg-white px-3 py-2 text-sm text-slate-700"
            >
              <option value="">Add a recipe to this week…</option>
              {recipes.map((r) => <option key={r.id} value={r.id}>{r.title}</option>)}
            </select>
            <Button type="button" variant="secondary" onClick={addRecipeToWeekPool}>Add idea</Button>
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-[#8a5200]">
            <span>Repeat for</span>
            <input type="number" min={1} max={7} value={spanDays} onChange={(e) => setSpanDays(Math.min(7, Math.max(1, Number(e.target.value) || 1)))} className="w-14 rounded-lg border border-[#f0d48d] bg-white px-2 py-1 text-center text-xs text-slate-700" />
            <span>day(s)</span>
          </div>
          {weekPoolRecipes.length ? <div className="mt-3 flex flex-wrap gap-2">
            {weekPoolRecipes.map((r) => <span key={r.id} className="inline-flex items-center gap-2 rounded-full bg-white px-3 py-1.5 text-sm text-slate-700 shadow-sm"><span>{r.title}</span><button type="button" onClick={() => removeRecipeFromWeekPool(r.id)} className="text-slate-400 hover:text-slate-700" aria-label={`Remove ${r.title}`}>×</button></span>)}
          </div> : <p className="mt-3 text-sm text-[#8a5200]">No meal ideas yet.</p>}
        </CardContent>
      </Card>

      {status ? <p className="rounded-xl bg-white px-4 py-3 text-sm text-slate-500 shadow-sm">{status}</p> : null}

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {dayOrder.map((day) => (
          <Card key={day} className="min-h-[220px]">
            <CardContent className="p-4">
              <div className="mb-3 flex items-baseline justify-between gap-2 border-b border-slate-100 pb-3">
                <p className="font-semibold text-slate-900">{dayLabel(day)}</p>
                <p className="text-xs text-slate-400">{weekDates[day]}</p>
              </div>
              <div className="mb-3 space-y-2">
                <select value={addByDay[day]} onChange={(e) => setAddByDay((prev) => ({ ...prev, [day]: e.target.value }))} className="min-h-9 w-full rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs text-slate-700">
                  <option value="">Choose a meal…</option>
                  {weekPoolRecipes.map((r) => <option key={r.id} value={r.id}>{r.title}</option>)}
                </select>
                <Button type="button" onClick={() => void addRecipe(day)} disabled={busy} className="w-full">Add to {dayLabel(day)}</Button>
              </div>
              {byDay[day].length === 0 ? <p className="text-xs text-slate-400">Nothing planned yet.</p> : <ul className="space-y-2">{byDay[day].map((item) => <li key={item.id} className="rounded-xl bg-[#fff7e8] px-3 py-2"><p className="text-sm font-medium text-slate-800">{item.recipe.title}</p><button type="button" onClick={() => void removeMeal(item)} className="mt-1 text-xs text-slate-400 underline hover:text-slate-700">Remove</button></li>)}</ul>}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
