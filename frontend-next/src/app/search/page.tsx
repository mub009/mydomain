import type { Metadata } from "next";
import { Search } from "lucide-react";
import { api, type SearchParams as ApiSearchParams } from "@/lib/api";
import BusinessCard from "@/components/BusinessCard";
import PageLinks from "@/components/PageLinks";
import SearchFilters from "@/components/SearchFilters";

type PageSearchParams = { q?: string; category?: string; city?: string; businessType?: string; sort?: string; page?: string };

function titleFor(params: PageSearchParams): string {
  const parts: string[] = [];
  if (params.q) parts.push(`"${params.q}"`);
  if (params.category) parts.push(params.category.replace(/-/g, " "));
  if (params.businessType === "B2B") parts.push("B2B suppliers");
  if (params.city) parts.push(`in ${params.city}`);
  return parts.length > 0 ? `${parts.join(" ")} — Search results` : "Search local businesses";
}

export async function generateMetadata({ searchParams }: { searchParams: Promise<PageSearchParams> }): Promise<Metadata> {
  const params = await searchParams;
  const title = titleFor(params);
  return {
    title,
    description: `Browse ${params.category ? params.category.replace(/-/g, " ") + " " : ""}businesses${params.city ? ` in ${params.city}` : ""} on Markkito — compare ratings, contact details, and reviews.`,
  };
}

export default async function SearchPage({ searchParams }: { searchParams: Promise<PageSearchParams> }) {
  const params = await searchParams;
  const page = Math.max(1, Number(params.page) || 1);

  const apiParams: ApiSearchParams = {
    q: params.q,
    categorySlug: params.category,
    city: params.city,
    businessType: params.businessType === "B2B" || params.businessType === "B2C" ? params.businessType : undefined,
    sort: params.sort === "rating" || params.sort === "newest" ? params.sort : "relevance",
    page,
  };

  const [categories, results] = await Promise.all([api.categories(), api.search(apiParams)]);

  return (
    <div>
      <h1 className="text-xl font-extrabold text-ink-900 mb-1">{titleFor(params)}</h1>
      <p className="text-sm text-ink-500 mb-5">{results.meta.total} businesses found</p>

      <SearchFilters categories={categories} />

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {results.data.map((b) => (
          <BusinessCard key={b.id} b={b} />
        ))}
        {results.data.length === 0 && (
          <div className="col-span-full text-center py-16 text-ink-500">
            <Search size={32} className="mx-auto mb-3 text-gray-300" />
            No businesses found. Try a different search.
          </div>
        )}
      </div>

      <PageLinks
        page={page}
        totalPages={results.meta.totalPages}
        basePath="/search"
        params={{ q: params.q, category: params.category, city: params.city, businessType: params.businessType, sort: params.sort }}
      />
    </div>
  );
}
