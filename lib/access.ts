import type { NextRequest } from "next/server";
import type { AppUser } from "@prisma/client";
import { AUTH_ENABLED } from "@/lib/auth-config";
import { getCurrentUser, getCurrentUserFromRequest } from "@/lib/auth";
import { getSharedWorkspaceUser } from "@/lib/shared-user";

export async function getRequestUser(request: NextRequest) {
  if (!AUTH_ENABLED) return getSharedWorkspaceUser();
  return getCurrentUserFromRequest(request);
}

export async function getPageUser() {
  if (!AUTH_ENABLED) return getSharedWorkspaceUser();
  return getCurrentUser();
}

/** Scope reads to the current user when auth is on; shared library when off. */
export function recipeReadFilter(user: AppUser) {
  return AUTH_ENABLED ? { userId: user.id } : {};
}

/** Scope weekly-plan reads the same way. */
export function weeklyPlanReadFilter(user: AppUser) {
  return AUTH_ENABLED ? { userId: user.id } : {};
}

export function recipeOwnerId(user: AppUser): number | null {
  return AUTH_ENABLED ? user.id : null;
}

/** Weekly plans always need a user row; use the shared workspace user when auth is off. */
export function weeklyPlanOwnerId(user: AppUser): number {
  return user.id;
}

export function suggestionsUserId(user: AppUser): number | undefined {
  return AUTH_ENABLED ? user.id : undefined;
}
