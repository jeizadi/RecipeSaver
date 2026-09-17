"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
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

export function WeeklyPlannerPageClient({
  recipes,
  initialItems,
}: {
  recipes: RecipeOption[];
  initialItems: WeeklyItem[];
}) {
  const router = useRouter();
  const initialPref = initialWeekStartPreference();
  const [items, setItems] = useState<WeeklyItem[]>(initialItems);
  const [weekStartPreference, setWeekStartPreference] =
    useState<WeekStartPreference>(initialPref);
  const [weekStart, setWeekStart] = useState<Date>(startOfWeek(new Date(), initialPref));
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);
  const [quickRecipe, setQuickRecipe] = useState("");
  const [quickQuery, setQuickQuery] = useState("");
  const [quickDay, setQuickDay] = useState<DayKey>("monday");
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

  const quickMatches = useMemo(() => {
    const query = quickQuery.trim().toLowerCase();
    if (!query) return [];
    return recipes
      .filter((recipe) => recipe.title.toLowerCase().includes(query))
      .slice(0, 6);
  }, [quickQuery, recipes]);

  const quickLooksLikeUrl = /^https?:\/\//i.test(quickQuery.trim());
  const quickAddHref = `/recipes/new?${quickLooksLikeUrl ? "sourceUrl" : "title"}=${encodeURIComponent(quickQuery.trim())}`;

  async function addRecipe(day: DayKey, recipeId: number) {
    const selected = recipeId;
    if (!Number.isInteger(selected) || selected < 1) {
      setStatus("Select a recipe first.");
      return;
    }
    setBusy(true);
    const start = new Date(`${weekDates[day]}T12:00:00.000Z`);
    let firstError: string | null = null;
    let created = 0;
    for (let i = 0; i < 1; i++) {
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
    await refreshWeek(weekStart);
  }

  async function addQuickMeal() {
    const selected = Number(quickRecipe);
    if (!Number.isInteger(selected) || selected < 1) {
      setStatus("Select a recipe first.");
      return;
    }
    await addRecipe(quickDay, selected);
    setQuickRecipe("");
    setQuickQuery("");
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

      <Card className="border-[#eadfca] bg-white shadow-none">
        <CardContent className="p-4 sm:p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="font-semibold text-slate-900">Add a meal</h3>
              <p className="mt-1 text-sm text-slate-500">Pick a recipe and a day.</p>
            </div>
            <label className="text-sm text-slate-500">
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
                className="ml-2 rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-sm text-slate-700"
              >
                <option value="monday">Monday</option>
                <option value="sunday">Sunday</option>
              </select>
            </label>
          </div>
          <div className="mt-4 grid gap-2 sm:grid-cols-[1fr_10rem_auto]">
            <div className="relative min-w-0">
              <input
                type="search"
                value={quickQuery}
                onChange={(e) => {
                  setQuickQuery(e.target.value);
                  setQuickRecipe("");
                }}
                onKeyDown={(e) => {
                  if (
                    e.key === "Enter" &&
                    quickQuery.trim() &&
                    !quickRecipe &&
                    quickMatches.length === 0
                  ) {
                    e.preventDefault();
                    router.push(quickAddHref);
                  }
                }}
                placeholder="Search recipes or paste a URL…"
                className="min-h-10 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700"
                aria-label="Search recipes or paste a recipe URL"
              />
              {quickQuery.trim() && !quickRecipe && (
                <div className="absolute left-0 right-0 top-12 z-10 rounded-xl border border-slate-200 bg-white p-1 shadow-lg">
                  {quickMatches.length > 0 ? (
                    quickMatches.map((recipe) => (
                      <button
                        key={recipe.id}
                        type="button"
                        onClick={() => {
                          setQuickRecipe(String(recipe.id));
                          setQuickQuery(recipe.title);
                        }}
                        className="block w-full rounded-lg px-3 py-2 text-left text-sm text-slate-700 hover:bg-[#fff7e8]"
                      >
                        {recipe.title}
                      </button>
                    ))
                  ) : (
                    <div className="px-3 py-2 text-sm text-slate-500">
                      <p>{quickLooksLikeUrl ? "No saved recipe uses this link." : "No saved recipes match."}</p>
                      <Link
                        href={quickAddHref}
                        className="mt-2 inline-flex rounded-lg bg-[#f4b942] px-3 py-1.5 text-sm font-semibold text-[#4a2b00] hover:bg-[#e9aa2d]"
                      >
                        Add a new recipe
                      </Link>
                    </div>
                  )}
                </div>
              )}
            </div>
            <select
              value={quickDay}
              onChange={(e) => setQuickDay(e.target.value as DayKey)}
              className="min-h-10 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700"
            >
              {dayOrder.map((day) => <option key={day} value={day}>{dayLabel(day)}</option>)}
            </select>
            <Button type="button" onClick={() => void addQuickMeal()} disabled={busy || !quickRecipe}>Add meal</Button>
          </div>
        </CardContent>
      </Card>

      {status ? <p className="rounded-xl bg-white px-4 py-3 text-sm text-slate-500 shadow-sm">{status}</p> : null}

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {dayOrder.map((day) => (
          <Card key={day} className="min-h-[150px]">
            <CardContent className="p-4">
              <div className="mb-3 flex items-baseline justify-between gap-2 border-b border-slate-100 pb-3">
                <p className="font-semibold text-slate-900">{dayLabel(day)}</p>
                <p className="text-xs text-slate-400">{weekDates[day]}</p>
              </div>
              {byDay[day].length === 0 ? <p className="text-xs text-slate-400">Nothing planned yet.</p> : <ul className="space-y-2">{byDay[day].map((item) => <li key={item.id} className="rounded-xl bg-[#fff7e8] px-3 py-2"><p className="text-sm font-medium text-slate-800">{item.recipe.title}</p><button type="button" onClick={() => void removeMeal(item)} className="mt-1 text-xs text-slate-400 underline hover:text-slate-700">Remove</button></li>)}</ul>}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
