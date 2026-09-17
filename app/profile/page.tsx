import { requireUser } from "@/lib/require-user";
import { ProfileForm } from "./profile-form";

export const dynamic = "force-dynamic";

export default async function ProfilePage() {
  await requireUser();
  return (
    <div className="rounded-2xl border border-[#eadfca] bg-[#fffdf8] p-6 shadow-none sm:p-8">
      <p className="text-sm font-semibold uppercase tracking-[0.16em] text-[#b66a00]">Personalize</p>
      <h2 className="mt-1 text-3xl font-semibold tracking-tight text-slate-950">Your preferences</h2>
      <p className="mb-6 mt-2 text-sm text-slate-500">
        These settings drive personalized recipe suggestions and ranking.
      </p>
      <ProfileForm />
    </div>
  );
}
