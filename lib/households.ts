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
  const household = await getOrCreateHousehold(userId);
  return household.members
    .slice()
    .sort((a, b) => (a.role === "owner" ? -1 : b.role === "owner" ? 1 : 0))
    .map((member) => member.user.id);
}
