import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { PackageSearch, Plus, Search, SlidersHorizontal, Tag, X } from "lucide-react";
import { classifiedCategoriesApi, classifiedsApi } from "@/api/endpoints";
import { apiErrorMessage } from "@/api/client";
import { ClassifiedCategory, ClassifiedListing } from "@/types";
import { useAuthStore } from "@/store/authStore";
import { useLocationStore } from "@/store/locationStore";
import { CardSkeleton } from "@/components/Loading";
import LocationInput from "@/components/LocationInput";
import Pagination from "@/components/Pagination";
import ClassifiedCard from "@/components/ClassifiedCard";
import { getRecentlyViewedClassifieds } from "@/lib/recentlyViewedClassifieds";

type SortKey = "newest" | "price_asc" | "price_desc" | "distance";

const SORT_OPTIONS: { value: SortKey; label: string }[] = [
  { value: "newest", label: "Newest first" },
  { value: "price_asc", label: "Price: low to high" },
  { value: "price_desc", label: "Price: high to low" },
  { value: "distance", label: "Nearest" },
];

export default function ClassifiedsBrowse() {
  const [params, setParams] = useSearchParams();
  const { city, geo, setCity, setGeo } = useLocationStore();
  const user = useAuthStore((s) => s.user);

  const q = params.get("q") ?? "";
  const categoryId = params.get("categoryId") ?? "";
  const condition = params.get("condition") ?? "";
  const minPriceCents = params.get("minPriceCents") ?? "";
  const maxPriceCents = params.get("maxPriceCents") ?? "";
  const sort = (params.get("sort") as SortKey) ?? "newest";
  const page = Number(params.get("page") ?? 1);

  const [categories, setCategories] = useState<ClassifiedCategory[]>([]);
  const [results, setResults] = useState<ClassifiedListing[]>([]);
  const [meta, setMeta] = useState({ total: 0, totalPages: 1 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const [favoriteIds, setFavoriteIds] = useState<Set<string>>(new Set());
  const [recentlyViewed, setRecentlyViewed] = useState<ClassifiedListing[]>([]);
  const [searchInput, setSearchInput] = useState(q);

  useEffect(() => setSearchInput(q), [q]);

  useEffect(() => {
    classifiedCategoriesApi.list().then(setCategories).catch(() => undefined);
  }, []);

  useEffect(() => {
    const ids = getRecentlyViewedClassifieds().slice(0, 8);
    classifiedsApi.batch(ids).then(setRecentlyViewed).catch(() => undefined);
  }, []);

  const isFiltered = Boolean(q || categoryId || condition || minPriceCents || maxPriceCents);

  function updateParams(patch: Record<string, string | number | null>) {
    const next = new URLSearchParams(params);
    Object.entries(patch).forEach(([key, value]) => {
      if (value === null || value === "") next.delete(key);
      else next.set(key, String(value));
    });
    if (!("page" in patch)) next.delete("page");
    setParams(next);
  }

  useEffect(() => {
    setLoading(true);
    setError("");
    classifiedsApi
      .list({
        q: q || undefined,
        categoryId: categoryId || undefined,
        condition: condition || undefined,
        minPriceCents: minPriceCents || undefined,
        maxPriceCents: maxPriceCents || undefined,
        city: geo ? undefined : city || undefined,
        lat: geo?.lat,
        lng: geo?.lng,
        radiusKm: geo ? 50 : undefined,
        sort,
        page,
      })
      .then((res) => {
        setResults(res.data);
        setMeta({ total: res.meta.total, totalPages: res.meta.totalPages });
      })
      .catch((err) => setError(apiErrorMessage(err)))
      .finally(() => setLoading(false));
  }, [q, categoryId, condition, minPriceCents, maxPriceCents, city, geo, sort, page]);

  function toggleFavorite(listing: ClassifiedListing) {
    if (!user) return;
    const isFav = favoriteIds.has(listing.id);
    const next = new Set(favoriteIds);
    if (isFav) {
      next.delete(listing.id);
      classifiedsApi.unfavorite(listing.id).catch(() => undefined);
    } else {
      next.add(listing.id);
      classifiedsApi.favorite(listing.id).catch(() => undefined);
    }
    setFavoriteIds(next);
  }

  const category = categories.find((c) => c.id === categoryId);

  return (
    <div>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-extrabold text-ink-900 sm:text-2xl">
            {category?.name ?? (q ? `“${q}”` : "Buy & sell near you")}
          </h1>
          <p className="mt-1 text-sm text-ink-500">{meta.total} listings{city ? ` in ${city}` : ""}</p>
        </div>
        {user && (
          <Link to="/classifieds/new" className="btn-primary px-4 py-2.5 text-sm shrink-0">
            <Plus size={15} /> Sell an item
          </Link>
        )}
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          updateParams({ q: searchInput || null });
        }}
        className="relative mt-4"
      >
        <Search size={16} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
        <input
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          placeholder="Search for items — e.g. iPhone 15 Pro"
          className="input w-full pl-10"
        />
      </form>

      {/* Category chips */}
      <div className="mt-4 flex flex-wrap gap-2">
        <button
          onClick={() => updateParams({ categoryId: null })}
          className={`badge ${!categoryId ? "bg-brand-600 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}
        >
          All categories
        </button>
        {categories.map((c) => (
          <button
            key={c.id}
            onClick={() => updateParams({ categoryId: c.id })}
            className={`badge ${categoryId === c.id ? "bg-brand-600 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}
          >
            <Tag size={11} /> {c.name}
          </button>
        ))}
      </div>

      {/* Filter bar */}
      <div className="mt-4 flex flex-wrap items-center gap-2">
        <select
          value={sort}
          onChange={(e) => updateParams({ sort: e.target.value })}
          className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-semibold text-ink-700 focus:border-brand-500 focus:outline-none"
        >
          {SORT_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>

        <select
          value={condition}
          onChange={(e) => updateParams({ condition: e.target.value })}
          className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-semibold text-ink-700 focus:border-brand-500 focus:outline-none"
        >
          <option value="">Any condition</option>
          <option value="NEW">New</option>
          <option value="USED">Used</option>
        </select>

        <input
          type="number"
          min={0}
          placeholder="Min ₹"
          value={minPriceCents ? String(Number(minPriceCents) / 100) : ""}
          onChange={(e) => updateParams({ minPriceCents: e.target.value ? String(Math.round(Number(e.target.value) * 100)) : null })}
          className="w-24 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-ink-700 focus:border-brand-500 focus:outline-none"
        />
        <input
          type="number"
          min={0}
          placeholder="Max ₹"
          value={maxPriceCents ? String(Number(maxPriceCents) / 100) : ""}
          onChange={(e) => updateParams({ maxPriceCents: e.target.value ? String(Math.round(Number(e.target.value) * 100)) : null })}
          className="w-24 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-ink-700 focus:border-brand-500 focus:outline-none"
        />

        <button
          onClick={() => setShowFilters((v) => !v)}
          className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-sm font-semibold transition-colors ${
            showFilters ? "border-brand-500 bg-brand-50 text-brand-700" : "border-gray-300 bg-white text-ink-700 hover:bg-gray-50"
          }`}
        >
          <SlidersHorizontal size={14} /> {geo ? "Near you" : city || "Location"}
        </button>
      </div>

      {showFilters && (
        <div className="card mt-3 p-4">
          <label className="mb-1.5 block text-xs font-semibold text-ink-700">Search in</label>
          <LocationInput value={city} onChange={setCity} onDetect={(lat, lng) => setGeo({ lat, lng })} />
          {geo && (
            <button onClick={() => setGeo(null)} className="mt-2 text-xs font-semibold text-brand-600 hover:underline">
              Clear “near me” and search by city instead
            </button>
          )}
        </div>
      )}

      <div className="mt-5">
        {error && <p className="mb-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

        {loading && <CardSkeleton count={8} className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4" />}

        {!loading && (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {results.map((l) => (
              <ClassifiedCard
                key={l.id}
                listing={l}
                favorited={favoriteIds.has(l.id)}
                onToggleFavorite={user ? toggleFavorite : undefined}
              />
            ))}
          </div>
        )}

        {!loading && results.length === 0 && (
          <div className="card py-14 text-center text-ink-500">
            <PackageSearch size={30} className="mx-auto mb-3 text-gray-300" />
            <p className="font-semibold text-ink-700">No listings found</p>
            <p className="mt-1 text-sm">Try a different category, price range, or location.</p>
            {isFiltered && (
              <button
                onClick={() => setParams(new URLSearchParams())}
                className="mt-3 inline-flex items-center gap-1 text-sm font-semibold text-brand-600 hover:underline"
              >
                <X size={13} /> Clear filters
              </button>
            )}
          </div>
        )}

        {!loading && (
          <Pagination
            page={page}
            totalPages={meta.totalPages}
            onChange={(next) => {
              updateParams({ page: next });
              window.scrollTo({ top: 0, behavior: "smooth" });
            }}
          />
        )}
      </div>

      {!isFiltered && page === 1 && recentlyViewed.length > 0 && (
        <div className="mt-8">
          <h2 className="mb-3 font-bold text-ink-900">Recently viewed</h2>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {recentlyViewed.map((l) => (
              <ClassifiedCard key={l.id} listing={l} favorited={favoriteIds.has(l.id)} onToggleFavorite={user ? toggleFavorite : undefined} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
