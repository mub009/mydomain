import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { MapPin, Search, ShieldCheck, TrendingUp } from "lucide-react";
import { searchApi, categoriesApi } from "@/api/endpoints";
import { apiErrorMessage } from "@/api/client";
import { Business, Category } from "@/types";
import StarRating from "@/components/StarRating";
import PromoCarousel from "@/components/PromoCarousel";
import CategoryShowcase from "@/components/CategoryShowcase";
import LocationInput from "@/components/LocationInput";
import Pagination from "@/components/Pagination";
import { getCategoryIcon } from "@/lib/categoryIcons";
import { CATEGORY_SHOWCASE } from "@/data/categoryShowcase";

const MAX_PLACEHOLDER_TERMS = 10;
const DEFAULT_SEARCH_PLACEHOLDER = "Search for restaurants, plumbers, salons…";

interface GeoPoint {
  lat: number;
  lng: number;
}

export default function Home() {
  const [query, setQuery] = useState("");
  const [city, setCity] = useState("");
  const [geo, setGeo] = useState<GeoPoint | null>(null);
  const [categorySlug, setCategorySlug] = useState("");
  const [categories, setCategories] = useState<Category[]>([]);
  const [results, setResults] = useState<Business[]>([]);
  const [page, setPage] = useState(1);
  const [resultMeta, setResultMeta] = useState({ total: 0, totalPages: 1 });
  // Starts true: the first search fires on mount, so the skeleton shows
  // immediately instead of flashing "No businesses found".
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [placeholderIndex, setPlaceholderIndex] = useState(0);

  // Rotating placeholder examples for the search box: real category names
  // first (so it reflects what's actually listed), topped up with curated
  // showcase terms, deduplicated and capped so the cycle stays short.
  const placeholderTerms = useMemo(() => {
    const fromCategories = categories.map((c) => c.name);
    const fromShowcase = CATEGORY_SHOWCASE.flatMap((group) => group.items.map((item) => item.label));
    return Array.from(new Set([...fromCategories, ...fromShowcase])).slice(0, MAX_PLACEHOLDER_TERMS);
  }, [categories]);

  const searchPlaceholder =
    placeholderTerms.length > 0 ? `Search for ${placeholderTerms[placeholderIndex % placeholderTerms.length]}…` : DEFAULT_SEARCH_PLACEHOLDER;

  useEffect(() => {
    if (placeholderTerms.length === 0) return;
    const id = setInterval(() => setPlaceholderIndex((i) => i + 1), 2200);
    return () => clearInterval(id);
  }, [placeholderTerms.length]);

  useEffect(() => {
    categoriesApi.list().then(setCategories).catch(() => undefined);
    runSearch();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function runSearch(
    e?: React.FormEvent,
    overrideCategory?: string,
    overrideQuery?: string,
    overrideGeo?: GeoPoint | null,
    pageArg = 1,
  ) {
    e?.preventDefault();
    setLoading(true);
    setError("");
    setPage(pageArg);
    const activeGeo = overrideGeo !== undefined ? overrideGeo : geo;
    try {
      const res = await searchApi.search({
        q: (overrideQuery ?? query) || undefined,
        city: activeGeo ? undefined : city || undefined,
        lat: activeGeo?.lat,
        lng: activeGeo?.lng,
        sort: activeGeo ? "distance" : "rating",
        categorySlug: overrideCategory ?? categorySlug ?? undefined,
        page: pageArg,
      });
      setResults(res.data);
      setResultMeta({ total: res.meta.total, totalPages: res.meta.totalPages });
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  function goToPage(nextPage: number) {
    runSearch(undefined, undefined, undefined, undefined, nextPage);
    document.getElementById("results")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function handleCityChange(next: string) {
    setCity(next);
    if (geo) setGeo(null);
  }

  function handleDetect(lat: number, lng: number) {
    const point = { lat, lng };
    setGeo(point);
    runSearch(undefined, undefined, undefined, point);
  }

  function selectCategory(slug: string) {
    const next = categorySlug === slug ? "" : slug;
    setCategorySlug(next);
    runSearch(undefined, next);
  }

  function selectShowcaseItem(showcaseQuery: string) {
    setQuery(showcaseQuery);
    setCategorySlug("");
    runSearch(undefined, "", showcaseQuery);
    document.getElementById("results")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  return (
    <div>
      {/* Search hero */}
      <section className="mb-7">
        <h1 className="text-2xl sm:text-[28px] font-extrabold text-ink-900 mb-4">
          Search across local <span className="text-brand-600">Products &amp; Services</span>
        </h1>
        <form onSubmit={runSearch} className="flex flex-col sm:flex-row gap-2.5">
          <LocationInput value={city} onChange={handleCityChange} onDetect={handleDetect} className="sm:w-64" />
          <div className="flex items-center gap-2 h-[52px] rounded-lg border border-gray-300 bg-white pl-3.5 pr-1.5 flex-1 focus-within:ring-2 focus-within:ring-brand-500/40 focus-within:border-brand-500">
            <Search size={18} className="text-gray-400 shrink-0" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={searchPlaceholder}
              className="w-full text-sm text-ink-900 placeholder:text-gray-400 focus:outline-none"
            />
            <button type="submit" className="btn-primary h-10 px-5 shrink-0">
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

      {/* Curated subcategory showcase */}
      <CategoryShowcase onSelect={selectShowcaseItem} />

      {/* Results */}
      <section id="results">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-ink-900 flex items-center gap-1.5">
            <TrendingUp size={18} className="text-brand-600" />
            {geo ? "Businesses near you" : "Top rated businesses"}
          </h2>
          {resultMeta.total > 0 && <span className="text-sm text-ink-500">{resultMeta.total} results</span>}
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
                  {b.distanceKm !== undefined && b.distanceKm !== null && (
                    <span className="text-ink-400">· {b.distanceKm.toFixed(1)} km away</span>
                  )}
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
        {!loading && <Pagination page={page} totalPages={resultMeta.totalPages} onChange={goToPage} />}
      </section>
    </div>
  );
}
