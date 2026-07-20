import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { MapPin, Search, ShieldCheck, Sparkles, Store, TrendingUp } from "lucide-react";
import { searchApi, categoriesApi } from "@/api/endpoints";
import { apiErrorMessage } from "@/api/client";
import { Business, Category } from "@/types";
import StarRating from "@/components/StarRating";

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
      {/* Hero */}
      <section className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-brand-700 via-brand-600 to-brand-500 px-6 py-12 sm:px-10 sm:py-16 mb-8 shadow-lg">
        <div className="absolute inset-0 opacity-10 pointer-events-none [background-image:radial-gradient(circle_at_20%_20%,white,transparent_35%),radial-gradient(circle_at_80%_60%,white,transparent_30%)]" />
        <div className="relative max-w-3xl">
          <span className="badge bg-white/15 text-white mb-4">
            <Sparkles size={13} /> Trusted local search &amp; marketplace
          </span>
          <h1 className="text-3xl sm:text-4xl font-extrabold text-white leading-tight mb-3">
            Find local businesses you can trust
          </h1>
          <p className="text-brand-50/90 mb-7 text-sm sm:text-base">
            Search, compare ratings, book services, and get quotes — all in one place.
          </p>

          <form onSubmit={runSearch} className="bg-white rounded-xl shadow-popover p-2 flex flex-col sm:flex-row gap-2">
            <div className="flex items-center gap-2 flex-1 px-3">
              <Search size={18} className="text-gray-400 shrink-0" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Restaurants, plumbers, salons…"
                className="w-full py-2.5 text-sm text-ink-900 placeholder:text-gray-400 focus:outline-none"
              />
            </div>
            <div className="hidden sm:block w-px bg-gray-200 my-1" />
            <div className="flex items-center gap-2 sm:w-48 px-3">
              <MapPin size={18} className="text-gray-400 shrink-0" />
              <input
                value={city}
                onChange={(e) => setCity(e.target.value)}
                placeholder="City"
                className="w-full py-2.5 text-sm text-ink-900 placeholder:text-gray-400 focus:outline-none"
              />
            </div>
            <button type="submit" className="btn-primary justify-center px-6 py-2.5">
              <Search size={16} />
              Search
            </button>
          </form>
        </div>
      </section>

      {/* Category chips */}
      {categories.length > 0 && (
        <section className="mb-8">
          <h2 className="text-sm font-semibold text-ink-700 mb-3 flex items-center gap-1.5">
            <Store size={15} /> Browse by category
          </h2>
          <div className="flex flex-wrap gap-2">
            {categories.map((c) => (
              <button
                key={c.id}
                onClick={() => selectCategory(c.slug)}
                className={`px-3.5 py-1.5 rounded-full text-sm font-medium border transition-colors ${
                  categorySlug === c.slug
                    ? "bg-brand-600 text-white border-brand-600"
                    : "bg-white text-ink-700 border-gray-200 hover:border-brand-300 hover:text-brand-600"
                }`}
              >
                {c.name}
              </button>
            ))}
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
