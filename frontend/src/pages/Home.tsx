import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { MapPin, Search, ShieldCheck, TrendingUp } from "lucide-react";
import { searchApi, categoriesApi } from "@/api/endpoints";
import { apiErrorMessage } from "@/api/client";
import { Business, Category } from "@/types";
import StarRating from "@/components/StarRating";
import PromoCarousel from "@/components/PromoCarousel";
import { getCategoryIcon } from "@/lib/categoryIcons";

export default function Home() {
  const [query, setQuery] = useState("");
  const [city, setCity] = useState("");
  const [categorySlug, setCategorySlug] = useState("");
  const [categories, setCategories] = useState<Category[]>([]);
  const [results, setResults] = useState<Business[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    categoriesApi.list().then(setCategories).catch(() => undefined);
    runSearch();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function runSearch(e?: React.FormEvent, overrideCategory?: string) {
    e?.preventDefault();
    setLoading(true);
    setError("");
    try {
      const res = await searchApi.search({
        q: query || undefined,
        city: city || undefined,
        categorySlug: overrideCategory ?? categorySlug ?? undefined,
        sort: "rating",
      });
      setResults(res.data);
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  function selectCategory(slug: string) {
    const next = categorySlug === slug ? "" : slug;
    setCategorySlug(next);
    runSearch(undefined, next);
  }

  return (
    <div>
      {/* Search hero */}
      <section className="mb-7">
        <h1 className="text-2xl sm:text-[28px] font-extrabold text-ink-900 mb-4">
          Search across local <span className="text-brand-600">Products &amp; Services</span>
        </h1>
        <form onSubmit={runSearch} className="flex flex-col sm:flex-row gap-2.5">
          <div className="flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-3.5 py-3 sm:w-64 focus-within:ring-2 focus-within:ring-brand-500/40 focus-within:border-brand-500">
            <MapPin size={18} className="text-brand-600 shrink-0" />
            <input
              value={city}
              onChange={(e) => setCity(e.target.value)}
              placeholder="City / Location"
              className="w-full text-sm text-ink-900 placeholder:text-gray-400 focus:outline-none"
            />
          </div>
          <div className="flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-3.5 py-3 flex-1 focus-within:ring-2 focus-within:ring-brand-500/40 focus-within:border-brand-500">
            <Search size={18} className="text-gray-400 shrink-0" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search for restaurants, plumbers, salons…"
              className="w-full text-sm text-ink-900 placeholder:text-gray-400 focus:outline-none"
            />
            <button type="submit" className="btn-primary px-5 py-2 -my-1 shrink-0">
              <Search size={15} />
              <span className="hidden sm:inline">Search</span>
            </button>
          </div>
        </form>
      </section>

      {/* Promo strip */}
      <PromoCarousel />

      {/* Category icon grid */}
      {categories.length > 0 && (
        <section className="mb-8">
          <div className="grid grid-cols-3 sm:grid-cols-5 lg:grid-cols-8 gap-3">
            {categories.map((c) => {
              const { icon: Icon, tint } = getCategoryIcon(c.name);
              const active = categorySlug === c.slug;
              return (
                <button
                  key={c.id}
                  onClick={() => selectCategory(c.slug)}
                  className="flex flex-col items-center gap-2 group"
                >
                  <span
                    className={`flex h-14 w-14 items-center justify-center rounded-2xl border transition-all ${
                      active ? "border-brand-500 ring-2 ring-brand-500/30" : "border-gray-200 group-hover:border-brand-300"
                    } ${tint}`}
                  >
                    <Icon size={24} />
                  </span>
                  <span className={`text-xs font-medium text-center leading-tight ${active ? "text-brand-700" : "text-ink-700"}`}>
                    {c.name}
                  </span>
                </button>
              );
            })}
          </div>
        </section>
      )}

      {/* Results */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-ink-900 flex items-center gap-1.5">
            <TrendingUp size={18} className="text-brand-600" />
            Top rated businesses
          </h2>
          {results.length > 0 && <span className="text-sm text-ink-500">{results.length} results</span>}
        </div>

        {error && <p className="text-red-600 mb-4">{error}</p>}

        {loading && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="card p-4 animate-pulse h-32" />
            ))}
          </div>
        )}

        {!loading && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {results.map((b) => (
              <Link
                key={b.id}
                to={`/business/${b.slug}`}
                className="card group p-4 hover:shadow-card-hover hover:-translate-y-0.5 transition-all"
              >
                <div className="flex items-start justify-between gap-2 mb-2">
                  <span className="badge bg-brand-50 text-brand-700">{b.categoryName ?? b.category?.name}</span>
                  {b.isVerified && (
                    <span title="Verified" className="text-emerald-600">
                      <ShieldCheck size={16} />
                    </span>
                  )}
                </div>
                <h3 className="font-bold text-base text-ink-900 group-hover:text-brand-600 transition-colors">
                  {b.name}
                </h3>
                <p className="text-sm text-ink-500 mb-3 flex items-center gap-1">
                  <MapPin size={13} />
                  {b.city}, {b.state}
                </p>
                <StarRating rating={b.avgRating} count={b.reviewCount} />
              </Link>
            ))}
            {results.length === 0 && (
              <div className="col-span-full text-center py-16 text-ink-500">
                <Search size={32} className="mx-auto mb-3 text-gray-300" />
                No businesses found. Try a different search.
              </div>
            )}
          </div>
        )}
      </section>
    </div>
  );
}
