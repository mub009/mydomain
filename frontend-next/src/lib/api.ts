import type { ApiResponse, Business, Category, PaginatedResponse, PopularCity, Review } from "./types";

// Server Components render before any browser exists, so there's no
// "current origin" to resolve a relative URL against — this needs the real
// Laravel origin. Client components instead call relative "/api/v1/..."
// paths, which next.config.ts rewrites to the same origin server-side, so
// this constant is for SSR fetches only.
const API_ORIGIN = process.env.API_ORIGIN ?? "http://127.0.0.1:8000";

async function apiFetch<T>(path: string, params?: Record<string, string | number | undefined>, revalidate = 60): Promise<T> {
  const url = new URL(`/api/v1${path}`, API_ORIGIN);
  for (const [key, value] of Object.entries(params ?? {})) {
    if (value !== undefined && value !== "") url.searchParams.set(key, String(value));
  }

  const res = await fetch(url, { next: { revalidate } });
  if (!res.ok) {
    throw new Error(`API request failed: ${res.status} ${url.pathname}${url.search}`);
  }
  return res.json() as Promise<T>;
}

export interface SearchParams {
  q?: string;
  categorySlug?: string;
  city?: string;
  lat?: number;
  lng?: number;
  radiusKm?: number;
  sort?: "relevance" | "rating" | "newest" | "distance";
  businessType?: "B2C" | "B2B";
  page?: number;
  pageSize?: number;
}

export const api = {
  categories: () => apiFetch<ApiResponse<Category[]>>("/categories", undefined, 300).then((r) => r.data),
  popularCities: () => apiFetch<ApiResponse<PopularCity[]>>("/search/cities", undefined, 300).then((r) => r.data),
  search: (params: SearchParams) =>
    apiFetch<PaginatedResponse<Business>>("/search", {
      q: params.q,
      categorySlug: params.categorySlug,
      city: params.city,
      lat: params.lat,
      lng: params.lng,
      radiusKm: params.radiusKm,
      sort: params.sort,
      businessType: params.businessType,
      page: params.page,
      pageSize: params.pageSize,
    }),
  // 30s: a business's own hours/reviews change often enough that a full
  // 5-minute-old page would feel stale to someone who just left a review.
  business: (slug: string) => apiFetch<ApiResponse<Business>>(`/businesses/${slug}`, undefined, 30).then((r) => r.data),
  reviews: (businessId: string, page = 1) =>
    apiFetch<PaginatedResponse<Review>>(`/businesses/${businessId}/reviews`, { page }, 30),
  // Every published business — used to build the sitemap. No caching benefit
  // worth the staleness here; sitemaps regenerate on their own schedule.
  allBusinessSlugs: async (): Promise<{ slug: string; city: string }[]> => {
    const slugs: { slug: string; city: string }[] = [];
    let page = 1;
    for (;;) {
      // /search caps pageSize at 50 — anything higher is a 400.
      const res = await apiFetch<PaginatedResponse<Business>>("/search", { page, pageSize: 50 }, 3600);
      slugs.push(...res.data.map((b) => ({ slug: b.slug, city: b.city })));
      if (page >= res.meta.totalPages) break;
      page += 1;
    }
    return slugs;
  },
};
