import { Prisma } from "@prisma/client";
import { prisma } from "@/config/database";
import { SearchQuery } from "./search.validation";

export interface SearchResultItem {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  city: string;
  state: string;
  latitude: number;
  longitude: number;
  avgRating: number;
  reviewCount: number;
  logoUrl: string | null;
  categoryName: string;
  categorySlug: string;
  distanceKm: number | null;
}

// Earth-radius Haversine distance search. For very large catalogs this would
// move to PostGIS (ST_DWithin) or a dedicated search index (Elasticsearch/
// Meilisearch); the SQL shape here is written to make that swap contained.
export async function searchBusinesses(query: SearchQuery): Promise<{ items: SearchResultItem[]; total: number; page: number; pageSize: number }> {
  const { q, categorySlug, city, lat, lng, radiusKm, minRating, sort, page, pageSize } = query;
  const offset = (page - 1) * pageSize;
  const hasGeo = lat !== undefined && lng !== undefined;

  const conditions: Prisma.Sql[] = [Prisma.sql`b.status = 'PUBLISHED'`];

  if (q) {
    conditions.push(Prisma.sql`(b.name ILIKE ${"%" + q + "%"} OR b.description ILIKE ${"%" + q + "%"})`);
  }
  if (categorySlug) {
    conditions.push(Prisma.sql`c.slug = ${categorySlug}`);
  }
  if (city) {
    conditions.push(Prisma.sql`b.city ILIKE ${city}`);
  }
  if (minRating !== undefined) {
    conditions.push(Prisma.sql`b."avgRating" >= ${minRating}`);
  }

  const distanceExpr = hasGeo
    ? Prisma.sql`(6371 * acos(least(1, greatest(-1,
        cos(radians(${lat})) * cos(radians(b.latitude)) * cos(radians(b.longitude) - radians(${lng})) +
        sin(radians(${lat})) * sin(radians(b.latitude))
      ))))`
    : Prisma.sql`NULL`;

  if (hasGeo) {
    conditions.push(Prisma.sql`${distanceExpr} <= ${radiusKm}`);
  }

  const whereClause = Prisma.join(conditions, " AND ");

  const orderBy =
    sort === "distance" && hasGeo
      ? Prisma.sql`distance_km ASC NULLS LAST`
      : sort === "rating"
        ? Prisma.sql`b."avgRating" DESC, b."reviewCount" DESC`
        : sort === "newest"
          ? Prisma.sql`b."createdAt" DESC`
          : Prisma.sql`b."avgRating" DESC, b."reviewCount" DESC`;

  const rows = await prisma.$queryRaw<Array<SearchResultItem & { distance_km: number | null }>>(Prisma.sql`
    SELECT
      b.id, b.name, b.slug, b.description, b.city, b.state, b.latitude, b.longitude,
      b."avgRating" AS "avgRating", b."reviewCount" AS "reviewCount", b."logoUrl" AS "logoUrl",
      c.name AS "categoryName", c.slug AS "categorySlug",
      ${distanceExpr} AS distance_km
    FROM businesses b
    JOIN categories c ON c.id = b."categoryId"
    WHERE ${whereClause}
    ORDER BY ${orderBy}
    LIMIT ${pageSize} OFFSET ${offset}
  `);

  const countRows = await prisma.$queryRaw<Array<{ count: bigint }>>(Prisma.sql`
    SELECT COUNT(*)::bigint AS count
    FROM businesses b
    JOIN categories c ON c.id = b."categoryId"
    WHERE ${whereClause}
  `);

  const items: SearchResultItem[] = rows.map((r) => ({
    ...r,
    distanceKm: r.distance_km !== null && r.distance_km !== undefined ? Number(r.distance_km) : null,
  }));

  return { items, total: Number(countRows[0]?.count ?? 0), page, pageSize };
}
