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
  "PosterSize",
] as const;

const REQUIRED_MODELS = [
  "user",
  "business",
  "businessSite",
  "product",
  "order",
  "orderItem",
  "reviewQrCode",
  "posterDesign",
] as const;

/**
 * Fields the code selects by name. A migration that only adds columns leaves
 * every model and enum present, so the checks above pass and the server starts
 * happily — then a query naming a column the client has never generated fails
 * mid-request with "Unknown field `bandStyle` for select statement".
 *
 * Only fields worth naming go here: ones added after a model existed, which
 * are exactly the ones a half-finished pull leaves behind.
 */
const REQUIRED_FIELDS: Record<string, string[]> = {
  BusinessSite: ["siteType", "templateId"],
  Business: ["preferredReviewChannel"],
  WhatsappSession: ["dailyLimit", "sendDelayMs", "windowStartHour", "autoOptOut"],
  PosterDesign: ["artworkUrl", "headerText", "footerText", "logoPosition", "bandStyle", "bandColor", "aiPrompt", "qrPosition"],
};

export class StalePrismaClientError extends Error {
  constructor(missing: string[]) {
    super(
      `The generated Prisma client is out of date — it is missing: ${missing.join(", ")}.\n` +
        "Run `npm run db:update` in the backend (migrate + generate), then restart the server.",
    );
    this.name = "StalePrismaClientError";
  }
}

/** What the generated client says model X has, as `{ ModelName: [field, …] }`. */
export type DatamodelFields = Record<string, string[]>;

/**
 * Pure form, so the check itself is testable without standing up a client.
 * `runtime` is the @prisma/client module (where enums live); `client` is the
 * PrismaClient instance (where model delegates live); `fields` is what the
 * client's datamodel reports each model contains.
 */
export function findGaps(
  runtime: Record<string, unknown>,
  client: Record<string, unknown>,
  fields: DatamodelFields = {},
): string[] {
  const missingEnums = REQUIRED_ENUMS.filter((name) => runtime[name] == null).map((name) => `enum ${name}`);
  const missingModels = REQUIRED_MODELS.filter((name) => client[name] == null).map((name) => `model ${name}`);

  const missingFields: string[] = [];
  for (const [model, required] of Object.entries(REQUIRED_FIELDS)) {
    // A model absent from the datamodel is already reported above, and an
    // empty map means the caller could not read one — neither is a reason to
    // claim every field is missing.
    const present = fields[model];
    if (!present) continue;
    for (const field of required) {
      if (!present.includes(field)) missingFields.push(`field ${model}.${field}`);
    }
  }

  return [...missingEnums, ...missingModels, ...missingFields];
}

/** Field names per model, read from the client's own datamodel. */
function datamodelFields(): DatamodelFields {
  // Read defensively: a client old enough to be missing models may also be old
  // enough to shape its dmmf differently, and this check must not be the thing
  // that crashes.
  type Loose = { Prisma?: { dmmf?: { datamodel?: { models?: readonly { name: string; fields: readonly { name: string }[] }[] } } } };
  const models = (PrismaModule as unknown as Loose).Prisma?.dmmf?.datamodel?.models;
  if (!models) return {};
  return Object.fromEntries(models.map((model) => [model.name, model.fields.map((f) => f.name)]));
}

/** Everything the generated client is missing, or an empty list when current. */
export function findStaleClientGaps(): string[] {
  return findGaps(
    PrismaModule as unknown as Record<string, unknown>,
    prisma as unknown as Record<string, unknown>,
    datamodelFields(),
  );
}

/** Throws at startup when the generated client is behind the schema. */
export function assertPrismaClientIsCurrent(): void {
  const missing = findStaleClientGaps();
  if (missing.length > 0) throw new StalePrismaClientError(missing);
}
