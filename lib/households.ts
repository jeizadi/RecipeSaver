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
