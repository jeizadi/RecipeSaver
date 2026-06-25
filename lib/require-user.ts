import { redirect } from "next/navigation";
import { AUTH_ENABLED } from "@/lib/auth-config";
import { getCurrentUser } from "@/lib/auth";
import { getSharedWorkspaceUser } from "@/lib/shared-user";

export async function requireUser() {
  if (!AUTH_ENABLED) return getSharedWorkspaceUser();
  const user = await getCurrentUser();
  if (!user) redirect("/auth");
  return user;
}
