import { requireUser } from "@/lib/require-user";
import { SuggestionsPanel } from "./suggestions-panel";

export const dynamic = "force-dynamic";

export default async function SuggestionsPage() {
  await requireUser();
  return (
    <div className="rounded-lg bg-white p-6 shadow-sm">
      <h2 className="mb-2 text-xl font-semibold">Recipe suggestions</h2>
      <p className="mb-4 text-sm text-[#7f8c8d]">
        Generate ranked suggestions from your profile preferences and feedback.
      </p>
      <SuggestionsPanel />
    </div>
  );
}
