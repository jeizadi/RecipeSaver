import { randomBytes } from "crypto";
import { prisma } from "@/lib/prisma";

const RESET_HOURS = 1;

export async function createPasswordResetToken(userId: number): Promise<string> {
  const token = randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + RESET_HOURS * 60 * 60 * 1000);
  await prisma.passwordResetToken.deleteMany({ where: { userId } });
  await prisma.passwordResetToken.create({
    data: { userId, token, expiresAt },
  });
  return token;
}

export async function findValidPasswordResetToken(token: string) {
  const row = await prisma.passwordResetToken.findUnique({
    where: { token },
    include: { user: true },
  });
  if (!row || row.expiresAt.getTime() < Date.now()) return null;
  return row;
}

export async function clearPasswordResetTokens(userId: number) {
  await prisma.passwordResetToken.deleteMany({ where: { userId } });
}
