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
      <body
        className="min-h-screen bg-[#fffdf8] text-[#5b3b2a] antialiased"
        style={{ backgroundColor: "#fffdf8", color: "#5b3b2a" }}
      >
        <header className="border-b border-[#e0d4c7] bg-[#f6efe9]">
          <div className="mx-auto flex max-w-4xl items-center justify-between px-4 py-3">
            <h1 className="text-lg font-semibold">
              <Link href="/shop" className="hover:underline">
                Recipebox
              </Link>
            </h1>
            <nav className="flex items-center gap-2">
              <Link
                href="/shop"
                aria-label="Home"
                title="Home"
                className="rounded border border-[#d2c2af] bg-white px-2 py-1.5 text-base font-medium text-[#5b3b2a] hover:bg-[#f6efe9]"
              >
                🏠
              </Link>
              <Link
                href="/shop"
                className="rounded border border-[#d2c2af] bg-white px-3 py-1.5 text-sm font-medium text-[#5b3b2a] hover:bg-[#f6efe9]"
              >
                Shop
              </Link>
              <Link
                href="/weekly"
                className="rounded border border-[#d2c2af] bg-white px-3 py-1.5 text-sm font-medium text-[#5b3b2a] hover:bg-[#f6efe9]"
              >
                Weekly Plan
              </Link>
              <Link
                href="/suggestions"
                className="rounded border border-[#d2c2af] bg-white px-3 py-1.5 text-sm font-medium text-[#5b3b2a] hover:bg-[#f6efe9]"
              >
                Suggestions
              </Link>
              <Link
                href="/profile"
                className="rounded border border-[#d2c2af] bg-white px-3 py-1.5 text-sm font-medium text-[#5b3b2a] hover:bg-[#f6efe9]"
              >
                Profile
              </Link>
              <Link
                href="/search"
                className="rounded border border-[#d2c2af] bg-white px-3 py-1.5 text-sm font-medium text-[#5b3b2a] hover:bg-[#f6efe9]"
              >
                Search
              </Link>
              <Link
                href="/recipes/new"
                className="rounded border border-[#d2c2af] bg-white px-3 py-1.5 text-sm font-medium text-[#5b3b2a] hover:bg-[#f6efe9]"
              >
                Add Recipe
              </Link>
              {AUTH_ENABLED && <AuthControls />}
            </nav>
          </div>
        </header>
        <main className="mx-auto max-w-4xl px-4 py-6">{children}</main>
      </body>
    </html>
  );
}
