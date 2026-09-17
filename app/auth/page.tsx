import { Suspense } from "react";
import AuthPageClient from "./auth-page-client";

export default function AuthPage() {
  return (
    <Suspense
      fallback={
        <div className="mx-auto max-w-md rounded-2xl border border-[#eadfca] bg-[#fffdf8] p-6 shadow-none sm:p-8">
          <p className="text-sm text-[#7f8c8d]">Loading…</p>
        </div>
      }
    >
      <AuthPageClient />
    </Suspense>
  );
}
