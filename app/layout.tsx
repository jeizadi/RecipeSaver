import type { Metadata } from "next";
import Link from "next/link";
import { Navigation } from "./navigation";
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
            <Navigation />
          </div>
        </header>
        <main className="mx-auto max-w-5xl px-4 py-6">{children}</main>
      </body>
    </html>
  );
}
