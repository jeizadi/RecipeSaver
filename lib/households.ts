import { prisma } from "@/lib/prisma";

export async function getOrCreateHousehold(userId: number) {
  const existing = await prisma.householdMember.findFirst({
    where: { userId },
    include: { household: { include: { members: { include: { user: { select: { id: true, email: true, name: true } } } } } } },
  });
  if (existing) return existing.household;

  return prisma.household.create({
    data: {
      members: { create: { userId, role: "owner" } },
    },
    include: { members: { include: { user: { select: { id: true, email: true, name: true } } } } },
  });
}

export async function getHouseholdUserIds(userId: number): Promise<number[]> {
  try {
    const household = await getOrCreateHousehold(userId);
    return household.members
      .slice()
      .sort((a, b) => (a.role === "owner" ? -1 : b.role === "owner" ? 1 : 0))
      .map((member) => member.user.id);
  } catch (error) {
    // Keep pre-household databases usable while the household migration is
    // being applied. The authenticated user still owns their own data.
    const code = error && typeof error === "object" && "code" in error
      ? (error as { code?: string }).code
      : undefined;
    if (code === "P2021") return [userId];
    throw error;
  }
}
