import { z } from "zod";
import { UserRole } from "@prisma/client";

export const registerSchema = z.object({
  email: z.string().email(),
  phone: z.string().min(7).max(20).optional(),
  password: z.string().min(8).max(72),
  firstName: z.string().min(1).max(80),
  lastName: z.string().min(1).max(80),
  role: z.enum([UserRole.CUSTOMER, UserRole.BUSINESS_OWNER]).default(UserRole.CUSTOMER),
});

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export const refreshSchema = z.object({
  refreshToken: z.string().min(10),
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
