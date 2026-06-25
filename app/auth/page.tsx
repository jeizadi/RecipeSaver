import { Suspense } from "react";
import AuthPageClient from "./auth-page-client";

export default function AuthPage() {
  return (
    <Suspense
      fallback={
        <div className="mx-auto max-w-md rounded-lg bg-white p-6 shadow-sm">
          <p className="text-sm text-[#7f8c8d]">Loading…</p>
        </div>
      }
    >
      <AuthPageClient />
    </Suspense>
  );
}
