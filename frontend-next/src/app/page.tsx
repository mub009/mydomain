import Link from "next/link";
import { ArrowRight, Search, Tag, TrendingUp } from "lucide-react";
import { api } from "@/lib/api";
import { getCategoryIcon } from "@/lib/categoryIcons";
import SearchHero from "@/components/SearchHero";
import BusinessCard from "@/components/BusinessCard";
import PageLinks from "@/components/PageLinks";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "";

export default async function HomePage({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
  const { page: pageParam } = await searchParams;
  const page = Math.max(1, Number(pageParam) || 1);

  const [categories, results] = await Promise.all([
    api.categories(),
    api.search({ sort: "rating", page }),
  ]);

  return (
    <div>
      {/* Search hero */}
      <section className="mb-7">
        <h1 className="text-2xl sm:text-[28px] font-extrabold text-ink-900 mb-4">
          Search across local <span className="text-brand-600">Products &amp; Services</span>
        </h1>
        <SearchHero />
      </section>

      {/* Classifieds cross-promo */}
      <a
        href={`${APP_URL}/classifieds`}
        className="mb-8 flex items-center justify-between gap-3 rounded-2xl bg-gradient-to-r from-brand-700 to-brand-500 px-5 py-4 text-white transition-opacity hover:opacity-95 sm:px-7 sm:py-5"
      >
        <div className="flex items-center gap-3">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white/15">
            <Tag size={20} />
          </span>
          <div>
            <p className="font-bold sm:text-lg">Buy &amp; sell used or new items nearby</p>
            <p className="text-sm text-white/80">Mobiles, vehicles, furniture, and more — post an item free.</p>
          </div>
        </div>
        <ArrowRight size={20} className="shrink-0" />
      </a>

      {/* Category icon grid */}
      {categories.length > 0 && (
        <section className="mb-8">
          <div className="grid grid-cols-3 sm:grid-cols-5 lg:grid-cols-8 gap-3">
            {categories.map((c) => {
              const { icon: Icon, tint } = getCategoryIcon(c.name);
              return (
                <Link key={c.id} href={`/search?category=${c.slug}`} className="flex flex-col items-center gap-2 group">
                  <span className={`flex h-14 w-14 items-center justify-center rounded-2xl border border-gray-200 group-hover:border-brand-300 transition-all ${tint}`}>
                    <Icon size={24} />
                  </span>
                  <span className="text-xs font-medium text-center leading-tight text-ink-700">{c.name}</span>
                </Link>
              );
            })}
          </div>
        </section>
      )}

      {/* Results */}
      <section id="results">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-ink-900 flex items-center gap-1.5">
            <TrendingUp size={18} className="text-brand-600" />
            Top rated businesses
          </h2>
          {results.meta.total > 0 && <span className="text-sm text-ink-500">{results.meta.total} results</span>}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {results.data.map((b) => (
            <BusinessCard key={b.id} b={b} />
          ))}
          {results.data.length === 0 && (
            <div className="col-span-full text-center py-16 text-ink-500">
              <Search size={32} className="mx-auto mb-3 text-gray-300" />
              No businesses found yet.
            </div>
          )}
        </div>
        <PageLinks page={page} totalPages={results.meta.totalPages} basePath="/" />
      </section>
    </div>
  );
}
