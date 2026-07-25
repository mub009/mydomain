import { z } from "zod";
import { UserRole, UserStatus } from "@prisma/client";

export const listUsersQuerySchema = z.object({
  page: z.coerce.number().int().min(1).optional(),
  pageSize: z.coerce.number().int().min(1).max(50).optional(),
  role: z.nativeEnum(UserRole).optional(),
  search: z.string().max(150).optional(),
});

export const createUserSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8).max(72),
  firstName: z.string().min(1).max(80),
  lastName: z.string().min(1).max(80),
  phone: z.string().min(7).max(20).optional(),
  role: z.nativeEnum(UserRole).default(UserRole.DEALER),
});

export const updateUserSchema = z.object({
  firstName: z.string().min(1).max(80).optional(),
  lastName: z.string().min(1).max(80).optional(),
  email: z.string().email().optional(),
  phone: z.string().min(7).max(20).optional(),
  role: z.nativeEnum(UserRole).optional(),
  status: z.nativeEnum(UserStatus).optional(),
});

export const listBusinessesQuerySchema = z.object({
  page: z.coerce.number().int().min(1).optional(),
  pageSize: z.coerce.number().int().min(1).max(50).optional(),
  status: z.string().max(30).optional(),
  search: z.string().max(150).optional(),
});

export const updateBusinessSchema = z
  .object({
    name: z.string().min(2).max(150),
    description: z.string().max(2000),
    categoryId: z.string().uuid(),
    email: z.string().email(),
    phone: z.string().min(7).max(20),
    website: z.string().url(),
    addressLine1: z.string().min(1).max(200),
    addressLine2: z.string().max(200),
    city: z.string().min(1).max(100),
    state: z.string().min(1).max(50),
    postalCode: z.string().min(1).max(20),
    latitude: z.number().min(-90).max(90),
    longitude: z.number().min(-180).max(180),
    isVerified: z.boolean(),
    status: z.enum(["DRAFT", "PENDING_APPROVAL", "PUBLISHED", "SUSPENDED"]),
  })
  .partial();

export const reassignBusinessSchema = z.object({
  ownerId: z.string().uuid(),
});
