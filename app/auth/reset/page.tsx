import { Suspense } from "react";
import ResetPasswordPageClient from "./reset-password-client";

export default function ResetPasswordPage() {
  return (
    <Suspense
      fallback={
        <div className="mx-auto max-w-md rounded-lg bg-white p-6 shadow-sm">
          <p className="text-sm text-[#7f8c8d]">Loading…</p>
        </div>
      }
    >
      <ResetPasswordPageClient />
    </Suspense>
  );
}
