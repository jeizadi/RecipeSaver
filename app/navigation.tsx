"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { AUTH_ENABLED } from "@/lib/auth-config";
import { AuthControls } from "./auth/auth-controls";

const links = [
  { href: "/shop", label: "Shop", show: "always" },
  { href: "/weekly", label: "Weekly Plan", show: "sm" },
  { href: "/suggestions", label: "Discover", show: "md" },
  { href: "/search", label: "Search", show: "lg" },
] as const;

function isActive(pathname: string, href: string) {
  return href === "/shop" ? pathname === "/shop" : pathname.startsWith(href);
}

export function Navigation() {
  const pathname = usePathname();
  return (
    <nav className="flex items-center gap-1 text-sm">
      {links.map((link) => (
        <Link
          key={link.href}
          href={link.href}
          aria-current={isActive(pathname, link.href) ? "page" : undefined}
          className={`rounded-lg px-3 py-2 font-medium transition-colors ${
            link.show === "sm" ? "hidden sm:inline-flex" :
            link.show === "md" ? "hidden md:inline-flex" :
            link.show === "lg" ? "hidden lg:inline-flex" : "inline-flex"
          } ${isActive(pathname, link.href) ? "bg-[#fff0c7] text-[#8a5200]" : "text-slate-700 hover:bg-[#fff0c7]"}`}
        >
          {link.label}
        </Link>
      ))}
      <Link href="/recipes/new" className="hidden rounded-lg bg-[#f4a51c] px-3 py-2 font-medium text-[#4a2b00] hover:bg-[#e39a0f] sm:inline-flex">
        Add Recipe
      </Link>
      <Link
        href="/profile"
        aria-label="Profile"
        title="Profile"
        aria-current={isActive(pathname, "/profile") ? "page" : undefined}
        className={`ml-1 inline-flex h-9 w-9 items-center justify-center rounded-full border text-sm font-semibold ${isActive(pathname, "/profile") ? "border-[#f4b942] bg-[#fff0c7] text-[#8a5200]" : "border-[#eadfca] bg-white text-slate-600 hover:bg-[#fff0c7]"}`}
      >
        P
      </Link>
      {AUTH_ENABLED && <AuthControls />}
    </nav>
  );
}
