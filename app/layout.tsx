import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Link from "next/link";
import { AuthControls } from "./auth/auth-controls";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Recipebox – Recipe collection",
  description: "Save and share recipes from any link",
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
        className={`${geistSans.variable} ${geistMono.variable} min-h-screen bg-[#fffdf8] text-[#5b3b2a] antialiased`}
        style={{ backgroundColor: "#fffdf8", color: "#5b3b2a" }}
      >
        <header className="border-b border-[#e0d4c7] bg-[#f6efe9]">
          <div className="mx-auto flex max-w-4xl items-center justify-between px-4 py-3">
            <h1 className="text-lg font-semibold">
              <Link href="/" className="hover:underline">
                Recipebox
              </Link>
            </h1>
            <nav className="flex items-center gap-2">
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
              <AuthControls />
            </nav>
          </div>
        </header>
        <main className="mx-auto max-w-4xl px-4 py-6">{children}</main>
      </body>
    </html>
  );
}
