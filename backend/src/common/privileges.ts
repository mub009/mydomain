import { UserRole } from "@prisma/client";

// Dealer privileges — feature grants an admin can toggle per dealer.
// Business owners and admins implicitly have every privilege on the
// resources they own; only DEALER accounts are gated by this list.
export const PRIVILEGES = ["MANAGE_LISTINGS", "MANAGE_LEADS", "MANAGE_BOOKINGS"] as const;
export type Privilege = (typeof PRIVILEGES)[number];

// Sensible default for a freshly created dealer: can add and manage their
// own listings, but leads/bookings must be granted explicitly by an admin.
export const DEFAULT_DEALER_PRIVILEGES: Privilege[] = ["MANAGE_LISTINGS"];

export function isPrivilege(value: unknown): value is Privilege {
  return typeof value === "string" && (PRIVILEGES as readonly string[]).includes(value);
}

export function normalizePrivileges(raw: unknown): Privilege[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter(isPrivilege);
}

// Whether a user (given role + stored privileges) may perform an action.
// Non-dealers are never gated here — their access is controlled by role
// checks and per-resource ownership elsewhere.
export function hasPrivilege(role: UserRole, privileges: unknown, needed: Privilege): boolean {
  if (role !== UserRole.DEALER) return true;
  return normalizePrivileges(privileges).includes(needed);
}
