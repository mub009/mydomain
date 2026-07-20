import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { randomUUID } from "crypto";
import { UserRole, UserStatus } from "@prisma/client";
import { prisma } from "@/config/database";
import { env } from "@/config/env";
import { AppError } from "@/common/errors";
import { LoginInput, RegisterInput } from "./auth.validation";

const ACCESS_TOKEN_EXPIRY_SECONDS = ttlToSeconds(env.JWT_ACCESS_TTL);
const REFRESH_TOKEN_EXPIRY_SECONDS = ttlToSeconds(env.JWT_REFRESH_TTL);

function ttlToSeconds(ttl: string): number {
  const match = /^(\d+)([smhd])$/.exec(ttl);
  if (!match) return 900;
  const value = Number(match[1]);
  const unit = match[2];
  const multipliers: Record<string, number> = { s: 1, m: 60, h: 3600, d: 86400 };
  return value * multipliers[unit];
}

function signAccessToken(userId: string, role: UserRole): string {
  return jwt.sign({ sub: userId, role }, env.JWT_ACCESS_SECRET, { expiresIn: ACCESS_TOKEN_EXPIRY_SECONDS });
}

export interface AuthResult {
  user: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    role: UserRole;
    status: UserStatus;
  };
  accessToken: string;
  refreshToken: string;
}

async function issueTokens(userId: string, role: UserRole): Promise<{ accessToken: string; refreshToken: string }> {
  const accessToken = signAccessToken(userId, role);
  const refreshToken = randomUUID() + randomUUID();

  await prisma.refreshToken.create({
    data: {
      token: refreshToken,
      userId,
      expiresAt: new Date(Date.now() + REFRESH_TOKEN_EXPIRY_SECONDS * 1000),
    },
  });

  return { accessToken, refreshToken };
}

export async function register(input: RegisterInput): Promise<AuthResult> {
  const existing = await prisma.user.findUnique({ where: { email: input.email } });
  if (existing) throw AppError.conflict("An account with this email already exists");

  const passwordHash = await bcrypt.hash(input.password, 12);
  const user = await prisma.user.create({
    data: {
      email: input.email,
      phone: input.phone,
      passwordHash,
      firstName: input.firstName,
      lastName: input.lastName,
      role: input.role,
      status: UserStatus.ACTIVE,
    },
  });

  const tokens = await issueTokens(user.id, user.role);
  return {
    user: { id: user.id, email: user.email, firstName: user.firstName, lastName: user.lastName, role: user.role, status: user.status },
    ...tokens,
  };
}

export async function login(input: LoginInput): Promise<AuthResult> {
  const user = await prisma.user.findUnique({ where: { email: input.email } });
  if (!user) throw AppError.unauthorized("Invalid email or password");

  const valid = await bcrypt.compare(input.password, user.passwordHash);
  if (!valid) throw AppError.unauthorized("Invalid email or password");

  if (user.status === UserStatus.SUSPENDED) throw AppError.forbidden("Account suspended");

  const tokens = await issueTokens(user.id, user.role);
  return {
    user: { id: user.id, email: user.email, firstName: user.firstName, lastName: user.lastName, role: user.role, status: user.status },
    ...tokens,
  };
}

export async function refresh(token: string): Promise<{ accessToken: string; refreshToken: string }> {
  const stored = await prisma.refreshToken.findUnique({ where: { token }, include: { user: true } });
  if (!stored || stored.revokedAt || stored.expiresAt < new Date()) {
    throw AppError.unauthorized("Invalid refresh token");
  }

  await prisma.refreshToken.update({ where: { id: stored.id }, data: { revokedAt: new Date() } });
  return issueTokens(stored.userId, stored.user.role);
}

export async function logout(token: string): Promise<void> {
  await prisma.refreshToken.updateMany({
    where: { token, revokedAt: null },
    data: { revokedAt: new Date() },
  });
}

export async function getProfile(userId: string) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw AppError.notFound("User not found");
  return {
    id: user.id,
    email: user.email,
    phone: user.phone,
    firstName: user.firstName,
    lastName: user.lastName,
    role: user.role,
    status: user.status,
    avatarUrl: user.avatarUrl,
    createdAt: user.createdAt,
  };
}
