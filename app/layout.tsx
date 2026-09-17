import type { Metadata } from "next";
import Link from "next/link";
import { AUTH_ENABLED } from "@/lib/auth-config";
import { AuthControls } from "./auth/auth-controls";
import "./globals.css";

export const metadata: Metadata = {
  title: "Recipebox – Weekly shopping",
  description: "Plan meals, build a shopping list, and save recipes",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <meta name="color-scheme" content="light only" />
        <meta name="supported-color-schemes" content="light" />
        <meta name="darkreader-lock" />
      </head>
      <body className="min-h-screen bg-[#fff7e8] text-slate-950 antialiased">
        <header className="sticky top-0 z-10 border-b border-[#eadfca] bg-[#fff7e8]/95 backdrop-blur">
          <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
            <h1 className="brand-mark text-lg font-semibold tracking-tight">
              <Link href="/shop" className="hover:underline">
                Recipebox
              </Link>
            </h1>
            <nav className="flex items-center gap-1 text-sm">
              <Link
                href="/shop"
                className="rounded-lg bg-[#fff0c7] px-3 py-2 font-medium text-[#8a5200] hover:bg-[#ffe6a3]"
              >
                Shop
              </Link>
              <Link
                href="/weekly"
                className="hidden rounded-lg px-3 py-2 font-medium text-slate-700 hover:bg-slate-100 sm:inline-flex"
              >
                Weekly Plan
              </Link>
              <Link
                href="/suggestions"
                className="hidden rounded-lg px-3 py-2 font-medium text-slate-700 hover:bg-slate-100 md:inline-flex"
              >
                Suggestions
              </Link>
              <Link
                href="/profile"
                className="hidden rounded-lg px-3 py-2 font-medium text-slate-700 hover:bg-slate-100 md:inline-flex"
              >
                Profile
              </Link>
              <Link
                href="/search"
                className="hidden rounded-lg px-3 py-2 font-medium text-slate-700 hover:bg-slate-100 lg:inline-flex"
              >
                Search
              </Link>
              <Link
                href="/recipes/new"
                className="hidden rounded-lg bg-[#f4a51c] px-3 py-2 font-medium text-[#4a2b00] hover:bg-[#e39a0f] sm:inline-flex"
              >
                Add Recipe
              </Link>
              {AUTH_ENABLED && <AuthControls />}
            </nav>
          </div>
        </header>
        <main className="mx-auto max-w-5xl px-4 py-6">{children}</main>
      </body>
    </html>
  );
}
