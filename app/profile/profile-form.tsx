"use client";

import { useEffect, useState } from "react";

type Profile = {
  dietaryRestrictions: string[];
  fitnessGoal: string;
  preferredDomains: string[];
  blockedDomains: string[];
  favoriteIngredients: string[];
  dislikedIngredients: string[];
  explorationRatio: number;
  weeklyBudgetCents: number | null;
  budgetToleranceRatio: number;
  trustedSourceRatio: number;
};

function asCsv(xs: string[]) {
  return xs.join(", ");
}

function parseCsv(v: string) {
  return v
    .split(",")
    .map((x) => x.trim().toLowerCase())
    .filter(Boolean);
}

export function ProfileForm() {
  const [dietaryRestrictions, setDietaryRestrictions] = useState("");
  const [fitnessGoal, setFitnessGoal] = useState("");
  const [preferredDomains, setPreferredDomains] = useState("");
  const [blockedDomains, setBlockedDomains] = useState("");
  const [favoriteIngredients, setFavoriteIngredients] = useState("");
  const [dislikedIngredients, setDislikedIngredients] = useState("");
  const [explorationRatio, setExplorationRatio] = useState(0.35);
  const [weeklyBudgetCents, setWeeklyBudgetCents] = useState<number | "">("");
  const [budgetToleranceRatio, setBudgetToleranceRatio] = useState(0.15);
  const [trustedSourceRatio, setTrustedSourceRatio] = useState(0.65);
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetch("/api/suggestions/profile")
      .then((r) => r.json())
      .then((d) => {
        if (!d.ok || !d.profile) return;
        const p = d.profile as Profile;
        setDietaryRestrictions(asCsv(p.dietaryRestrictions ?? []));
        setFitnessGoal(p.fitnessGoal ?? "");
        setPreferredDomains(asCsv(p.preferredDomains ?? []));
        setBlockedDomains(asCsv(p.blockedDomains ?? []));
        setFavoriteIngredients(asCsv(p.favoriteIngredients ?? []));
        setDislikedIngredients(asCsv(p.dislikedIngredients ?? []));
        setExplorationRatio(
          typeof p.explorationRatio === "number" ? p.explorationRatio : 0.35
        );
        setWeeklyBudgetCents(
          typeof p.weeklyBudgetCents === "number" ? p.weeklyBudgetCents : ""
        );
        setBudgetToleranceRatio(
          typeof p.budgetToleranceRatio === "number" ? p.budgetToleranceRatio : 0.15
        );
        setTrustedSourceRatio(
          typeof p.trustedSourceRatio === "number" ? p.trustedSourceRatio : 0.65
        );
      })
      .catch(() => undefined);
  }, []);

  async function save() {
    setLoading(true);
    setStatus("");
    const res = await fetch("/api/suggestions/profile", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        dietaryRestrictions: parseCsv(dietaryRestrictions),
        fitnessGoal,
        preferredDomains: parseCsv(preferredDomains),
        blockedDomains: parseCsv(blockedDomains),
        favoriteIngredients: parseCsv(favoriteIngredients),
        dislikedIngredients: parseCsv(dislikedIngredients),
        explorationRatio,
        weeklyBudgetCents:
          typeof weeklyBudgetCents === "number" ? weeklyBudgetCents : undefined,
        budgetToleranceRatio,
        trustedSourceRatio,
      }),
    });
    const data = await res.json().catch(() => ({}));
    setLoading(false);
    setStatus(data.ok ? "Saved profile preferences." : data.error ?? "Failed to save.");
  }

  return (
    <div className="space-y-3">
      <label className="block text-sm">
        <span className="mb-1 block text-[#7f8c8d]">Dietary restrictions</span>
        <input
          value={dietaryRestrictions}
          onChange={(e) => setDietaryRestrictions(e.target.value)}
          placeholder="vegan, gluten-free"
          className="w-full rounded border border-[#d2c2af] px-3 py-2"
        />
      </label>
      <label className="block text-sm">
        <span className="mb-1 block text-[#7f8c8d]">Fitness goal</span>
        <input
          value={fitnessGoal}
          onChange={(e) => setFitnessGoal(e.target.value)}
          placeholder="high protein"
          className="w-full rounded border border-[#d2c2af] px-3 py-2"
        />
      </label>
      <label className="block text-sm">
        <span className="mb-1 block text-[#7f8c8d]">Preferred sites/domains</span>
        <input value={preferredDomains} onChange={(e) => setPreferredDomains(e.target.value)} className="w-full rounded border border-[#d2c2af] px-3 py-2" />
      </label>
      <label className="block text-sm">
        <span className="mb-1 block text-[#7f8c8d]">Blocked sites/domains</span>
        <input value={blockedDomains} onChange={(e) => setBlockedDomains(e.target.value)} className="w-full rounded border border-[#d2c2af] px-3 py-2" />
      </label>
      <label className="block text-sm">
        <span className="mb-1 block text-[#7f8c8d]">Favorite ingredients</span>
        <input value={favoriteIngredients} onChange={(e) => setFavoriteIngredients(e.target.value)} className="w-full rounded border border-[#d2c2af] px-3 py-2" />
      </label>
      <label className="block text-sm">
        <span className="mb-1 block text-[#7f8c8d]">Disliked ingredients</span>
        <input value={dislikedIngredients} onChange={(e) => setDislikedIngredients(e.target.value)} className="w-full rounded border border-[#d2c2af] px-3 py-2" />
      </label>
      <label className="block text-sm">
        <span className="mb-1 block text-[#7f8c8d]">Exploration ratio (0-1)</span>
        <input
          type="number"
          min={0}
          max={1}
          step={0.05}
          value={explorationRatio}
          onChange={(e) => setExplorationRatio(Number(e.target.value))}
          className="w-full rounded border border-[#d2c2af] px-3 py-2"
        />
      </label>
      <label className="block text-sm">
        <span className="mb-1 block text-[#7f8c8d]">Weekly budget target ($)</span>
        <input
          type="number"
          min={0}
          value={weeklyBudgetCents === "" ? "" : Math.round(weeklyBudgetCents / 100)}
          onChange={(e) =>
            setWeeklyBudgetCents(
              e.target.value === "" ? "" : Math.max(0, Math.round(Number(e.target.value) * 100))
            )
          }
          className="w-full rounded border border-[#d2c2af] px-3 py-2"
        />
      </label>
      <label className="block text-sm">
        <span className="mb-1 block text-[#7f8c8d]">Budget tolerance ratio (0-1)</span>
        <input
          type="number"
          min={0.01}
          max={0.9}
          step={0.01}
          value={budgetToleranceRatio}
          onChange={(e) => setBudgetToleranceRatio(Number(e.target.value))}
          className="w-full rounded border border-[#d2c2af] px-3 py-2"
        />
      </label>
      <label className="block text-sm">
        <span className="mb-1 block text-[#7f8c8d]">Trusted source ratio (0-1)</span>
        <input
          type="number"
          min={0}
          max={1}
          step={0.05}
          value={trustedSourceRatio}
          onChange={(e) => setTrustedSourceRatio(Number(e.target.value))}
          className="w-full rounded border border-[#d2c2af] px-3 py-2"
        />
      </label>
      <button
        type="button"
        onClick={save}
        disabled={loading}
        className="rounded bg-[#e67e22] px-3 py-2 text-sm font-medium text-white hover:bg-[#cf711f] disabled:opacity-60"
      >
        {loading ? "Saving..." : "Save profile"}
      </button>
      {status && <p className="text-sm text-[#7f8c8d]">{status}</p>}
    </div>
  );
}
