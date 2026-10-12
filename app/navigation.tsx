"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { AUTH_ENABLED } from "@/lib/auth-config";
import { AuthControls } from "./auth/auth-controls";

const links = [
  { href: "/shop", label: "Shop", show: "always" },
  { href: "/weekly", label: "Weekly Plan", show: "sm" },
  { href: "/suggestions", label: "Discover", show: "md" },
  { href: "/recipes", label: "Recipes", show: "sm" },
] as const;

function isActive(pathname: string, href: string) {
  return href === "/shop" ? pathname === "/shop" : pathname.startsWith(href);
}

export function Navigation() {
  const pathname = usePathname();
  const [profileOpen, setProfileOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);
  const profileRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!searchOpen) return;
    function closeOnOutside(event: MouseEvent) {
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) setSearchOpen(false);
    }
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") setSearchOpen(false);
    }
    document.addEventListener("mousedown", closeOnOutside);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("mousedown", closeOnOutside);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [searchOpen]);
  useEffect(() => {
    if (!profileOpen) return;
    function closeOnOutside(event: MouseEvent) {
      if (profileRef.current && !profileRef.current.contains(event.target as Node)) setProfileOpen(false);
    }
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") setProfileOpen(false);
    }
    document.addEventListener("mousedown", closeOnOutside);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("mousedown", closeOnOutside);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [profileOpen]);
  return (
    <>
    <nav className="relative flex items-center gap-1 text-sm">
      {links.map((link) => (
        <Link
          key={link.href}
          href={link.href}
          aria-current={isActive(pathname, link.href) ? "page" : undefined}
          className={`rounded-lg px-3 py-2 font-medium transition-colors ${
            link.show === "sm" ? "hidden sm:inline-flex" :
            link.show === "md" ? "hidden md:inline-flex" :
            "inline-flex"
          } ${isActive(pathname, link.href) ? "bg-[#fff0c7] text-[#8a5200]" : "text-slate-700 hover:bg-[#fff0c7]"}`}
        >
          {link.label}
        </Link>
      ))}
      <div ref={searchRef} className="relative hidden lg:block">
        <button
          type="button"
          aria-expanded={searchOpen}
          onClick={() => setSearchOpen((open) => !open)}
          className={`rounded-lg px-3 py-2 font-medium ${searchOpen || pathname.startsWith("/search") ? "bg-[#fff0c7] text-[#8a5200]" : "text-slate-700 hover:bg-[#fff0c7]"}`}
        >
          Search
        </button>
        {searchOpen && (
          <form action="/search" method="get" className="absolute right-0 top-12 z-20 w-80 rounded-2xl border border-[#eadfca] bg-[#fffdf8] p-3 shadow-lg">
            <label className="block text-xs font-medium text-slate-500" htmlFor="nav-search-query">Recipe or keyword</label>
            <input id="nav-search-query" name="q" autoFocus placeholder="Try enchiladas…" className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm" />
            <div className="mt-2 grid grid-cols-2 gap-2">
              <input name="ingredient" placeholder="Ingredient" className="rounded-xl border border-slate-200 px-3 py-2 text-sm" />
              <select name="category" defaultValue="" className="rounded-xl border border-slate-200 px-3 py-2 text-sm">
                <option value="">Any type</option>
                <option value="breakfast">Breakfast</option>
                <option value="lunch">Lunch</option>
                <option value="dinner">Dinner</option>
                <option value="snack">Snack</option>
                <option value="dessert">Dessert</option>
                <option value="side">Side</option>
                <option value="sauce">Sauce</option>
              </select>
            </div>
            <button type="submit" onClick={() => setSearchOpen(false)} className="mt-3 w-full rounded-xl bg-[#f4a51c] px-3 py-2 text-sm font-semibold text-[#4a2b00] hover:bg-[#e39a0f]">Search recipes</button>
          </form>
        )}
      </div>
      <Link href="/recipes/new" className="hidden rounded-lg bg-[#f4a51c] px-3 py-2 font-medium text-[#4a2b00] hover:bg-[#e39a0f] sm:inline-flex">
        Add Recipe
      </Link>
      {AUTH_ENABLED && <AuthControls />}
      <div ref={profileRef} className="relative">
      <button
        type="button"
        aria-label="Profile"
        title="Profile"
        aria-expanded={profileOpen}
        onClick={() => setProfileOpen((open) => !open)}
        className={`ml-1 inline-flex h-8 w-8 items-center justify-center rounded-full border ${profileOpen || isActive(pathname, "/profile") ? "border-[#f4b942] bg-[#fff0c7] text-[#8a5200]" : "border-[#eadfca] bg-white text-slate-500 hover:bg-[#fff0c7]"}`}
      >
        <svg aria-hidden="true" viewBox="0 0 24 24" className="h-4 w-4 fill-none stroke-current" strokeWidth="1.8">
          <circle cx="12" cy="8" r="3.2" />
          <path d="M5.5 19.2c.8-3.1 3.1-4.8 6.5-4.8s5.7 1.7 6.5 4.8" strokeLinecap="round" />
        </svg>
      </button>
      {profileOpen && (
        <div role="dialog" aria-label="Profile menu" className="absolute right-0 top-12 z-20 w-64 rounded-2xl border border-[#eadfca] bg-[#fffdf8] p-4 shadow-lg">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-slate-900">Your profile</p>
              <p className="mt-1 text-xs text-slate-500">Preferences for recommendations.</p>
            </div>
            <button type="button" onClick={() => setProfileOpen(false)} aria-label="Close profile menu" className="text-lg leading-none text-slate-400 hover:text-slate-700">×</button>
          </div>
          <Link href="/profile" onClick={() => setProfileOpen(false)} className="mt-4 inline-flex w-full items-center justify-center rounded-xl bg-[#f4a51c] px-3 py-2 text-sm font-semibold text-[#4a2b00] hover:bg-[#e39a0f]">
            Edit preferences
          </Link>
        </div>
      )}
      </div>
    </nav>
    <nav aria-label="Mobile navigation" className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-4 border-t border-[#eadfca] bg-[#fffdf8]/95 px-2 py-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] shadow-[0_-4px_16px_rgba(74,43,0,0.08)] backdrop-blur sm:hidden">
      {[
        ["/shop", "Shop"],
        ["/weekly", "Plan"],
        ["/suggestions", "Discover"],
        ["/search", "Search"],
      ].map(([href, label]) => (
        <Link key={href} href={href} className={`flex flex-col items-center gap-0.5 rounded-xl px-2 py-1.5 text-[11px] font-medium ${isActive(pathname, href) ? "bg-[#fff0c7] text-[#8a5200]" : "text-slate-500"}`}>
          <span className="text-base leading-none">{href === "/shop" ? "▢" : href === "/weekly" ? "□" : href === "/suggestions" ? "✦" : "⌕"}</span>
          {label}
        </Link>
      ))}
    </nav>
    </>
  );
}
