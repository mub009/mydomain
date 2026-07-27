import * as PrismaModule from "@prisma/client";
import { prisma } from "./database";

/**
 * The Prisma client is generated code. `prisma migrate deploy` updates the
 * database but does NOT regenerate it, so pulling a change that adds a model
 * or enum and only running the migration leaves the running server with a
 * client that has no idea the new things exist.
 *
 * That failure is silent and confusing: reading an enum member off a client
 * that never generated it throws "Cannot read properties of undefined", and
 * models show up as "prisma.product is undefined" halfway through a request.
 * Checking at boot turns it into one obvious message with the fix in it.
 */

// Enums the code reads members from, and models it queries. Add to these when
// the schema grows so a stale client is caught rather than discovered.
const REQUIRED_ENUMS = [
  "UserRole",
  "BusinessStatus",
  "LeadStatus",
  "SiteType",
  "OrderStatus",
  "OrderPaymentMethod",
  "ReviewChannel",
] as const;

const REQUIRED_MODELS = [
  "user",
  "business",
  "businessSite",
  "product",
  "order",
  "orderItem",
  "reviewQrCode",
] as const;

export class StalePrismaClientError extends Error {
  constructor(missing: string[]) {
    super(
      `The generated Prisma client is out of date — it is missing: ${missing.join(", ")}.\n` +
        "Run `npm run prisma:generate` in the backend (after `npm run prisma:deploy`) and restart the server.",
    );
    this.name = "StalePrismaClientError";
  }
}

/**
 * Pure form, so the check itself is testable without standing up a client.
 * `runtime` is the @prisma/client module (where enums live); `client` is the
 * PrismaClient instance (where model delegates live).
 */
export function findGaps(runtime: Record<string, unknown>, client: Record<string, unknown>): string[] {
  const missingEnums = REQUIRED_ENUMS.filter((name) => runtime[name] == null).map((name) => `enum ${name}`);
  const missingModels = REQUIRED_MODELS.filter((name) => client[name] == null).map((name) => `model ${name}`);
  return [...missingEnums, ...missingModels];
}

/** Everything the generated client is missing, or an empty list when current. */
export function findStaleClientGaps(): string[] {
  return findGaps(
    PrismaModule as unknown as Record<string, unknown>,
    prisma as unknown as Record<string, unknown>,
  );
}

/** Throws at startup when the generated client is behind the schema. */
export function assertPrismaClientIsCurrent(): void {
  const missing = findStaleClientGaps();
  if (missing.length > 0) throw new StalePrismaClientError(missing);
}
