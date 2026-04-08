import { requireUser } from "@/lib/require-user";
import { ProfileForm } from "./profile-form";

export const dynamic = "force-dynamic";

export default async function ProfilePage() {
  await requireUser();
  return (
    <div className="rounded-lg bg-white p-6 shadow-sm">
      <h2 className="mb-2 text-xl font-semibold">Your profile preferences</h2>
      <p className="mb-4 text-sm text-[#7f8c8d]">
        These settings drive personalized recipe suggestions and ranking.
      </p>
      <ProfileForm />
    </div>
  );
}
