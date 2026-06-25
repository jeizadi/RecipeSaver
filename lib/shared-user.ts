import { randomUUID } from "crypto";
import { hashPassword } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const SHARED_EMAIL = "__shared__@recipebox.local";

let cachedSharedUserId: number | null = null;

export async function getSharedWorkspaceUser() {
  if (cachedSharedUserId != null) {
    const user = await prisma.appUser.findUnique({ where: { id: cachedSharedUserId } });
    if (user) return user;
  }

  let user = await prisma.appUser.findUnique({ where: { email: SHARED_EMAIL } });
  if (!user) {
    user = await prisma.appUser.create({
      data: {
        email: SHARED_EMAIL,
        name: "Shared",
        passwordHash: hashPassword(randomUUID()),
      },
    });
    await prisma.userProfile.create({
      data: { name: `user-${user.id}`, userId: user.id },
    });
  }

  cachedSharedUserId = user.id;
  return user;
}
