import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import {
  ChevronRight,
  Flame,
  ImageIcon,
  MapPin,
  MessageSquare,
  Phone,
  Search,
  ShieldCheck,
  SlidersHorizontal,
  Star,
  TrendingUp,
  X,
} from "lucide-react";
import { searchApi, categoriesApi, leadsApi } from "@/api/endpoints";
import { apiErrorMessage } from "@/api/client";
import { Business, Category } from "@/types";
import { useLocationStore } from "@/store/locationStore";
import { CardSkeleton } from "@/components/Loading";
import LocationInput from "@/components/LocationInput";
import Pagination from "@/components/Pagination";
import Modal from "@/components/Modal";

type SortKey = "relevance" | "rating" | "distance" | "newest";

const SORT_OPTIONS: { value: SortKey; label: string }[] = [
  { value: "relevance", label: "Relevance" },
  { value: "rating", label: "Top rated" },
  { value: "distance", label: "Nearest" },
  { value: "newest", label: "Newest" },
];

const RATING_OPTIONS = [
  { value: "", label: "Any rating" },
  { value: "4", label: "4★ & above" },
  { value: "3", label: "3★ & above" },
];

// A light "signal" badge derived from the listing's own numbers, so the row
// carries the same at-a-glance context as the reference layout.
function signalBadge(b: Business, index: number): { label: string; icon: typeof Flame; tint: string } | null {
  if (b.avgRating >= 4.5 && b.reviewCount >= 3) {
    return { label: "Top Rated", icon: Star, tint: "bg-amber-50 text-amber-700" };
  }
  if ((b.viewCount ?? 0) > 50 || index === 0) {
    return { label: "Top Search", icon: TrendingUp, tint: "bg-sky-50 text-sky-700" };
  }
  if (b.reviewCount >= 5) {
    return { label: "Popular", icon: Flame, tint: "bg-orange-50 text-orange-700" };
  }
  return null;
}

function ratingTint(rating: number): string {
  if (rating >= 4) return "bg-emerald-600";
  if (rating >= 3) return "bg-lime-600";
  if (rating > 0) return "bg-amber-500";
  return "bg-gray-400";
}

function ResultPhoto({ business }: { business: Business }) {
  const [failed, setFailed] = useState(false);
  const url = business.photoUrl ?? business.logoUrl;

  if (!url || failed) {
    return (
      <div className="flex h-full w-full items-center justify-center bg-brand-50 text-brand-300">
        <ImageIcon size={26} />
      </div>
    );
  }
  return (
    <img
      src={url}
      alt={business.name}
      loading="lazy"
      onError={() => setFailed(true)}
      className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
    />
  );
}

// Enquiry form shown from a listing row, so users can send a lead without
// leaving the results page.
function EnquiryModal({ business, onClose }: { business: Business; onClose: () => void }) {
  const [form, setForm] = useState({ name: "", phone: "", email: "", message: "" });
  const [state, setState] = useState<{ kind: "idle" | "sent" | "error"; text?: string }>({ kind: "idle" });
  const [saving, setSaving] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await leadsApi.create(business.id, { ...form, source: "SEARCH" });
      setState({ kind: "sent" });
    } catch (err) {
      setState({ kind: "error", text: apiErrorMessage(err) });
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal title={`Send enquiry to ${business.name}`} onClose={onClose}>
      {state.kind === "sent" ? (
        <div className="space-y-3">
          <p className="text-sm text-emerald-800 bg-emerald-50 rounded-md px-3 py-2">
            Enquiry sent. {business.name} will get in touch with you shortly.
          </p>
          <button onClick={onClose} className="btn-primary w-full py-2.5">
            Done
          </button>
        </div>
      ) : (
        <form onSubmit={submit} className="space-y-3">
          {state.kind === "error" && (
            <p className="text-sm text-red-700 bg-red-50 rounded-md px-3 py-2">{state.text}</p>
          )}
          <input required className="input" placeholder="Your name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          <input required minLength={7} maxLength={20} className="input" placeholder="Your phone" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
          <input type="email" className="input" placeholder="Email (optional)" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          <textarea className="input min-h-[90px]" placeholder="What do you need?" value={form.message} onChange={(e) => setForm({ ...form, message: e.target.value })} />
          <button disabled={saving} className="btn-primary w-full py-2.5">
            {saving ? "Sending…" : "Send enquiry"}
          </button>
        </form>
      )}
    </Modal>
  );
}

function ResultRow({ business, index }: { business: Business; index: number }) {
  const [numberShown, setNumberShown] = useState(false);
  const [enquiry, setEnquiry] = useState(false);
  const signal = signalBadge(business, index);
  const SignalIcon = signal?.icon;
  const area = business.addressLine1 ? business.addressLine1.split(",")[0] : business.city;
  const whatsappUrl = `https://wa.me/${(business.phone ?? "").replace(/[^0-9]/g, "")}`;

  return (
    <div className="card group overflow-hidden">
      <div className="flex flex-col sm:flex-row">
        <Link
          to={`/business/${business.slug}`}
          className="relative h-44 w-full shrink-0 overflow-hidden sm:h-auto sm:w-44 md:w-52"
        >
          <ResultPhoto business={business} />
        </Link>

        <div className="min-w-0 flex-1 p-4">
          <div className="flex items-start justify-between gap-3">
            <Link to={`/business/${business.slug}`} className="min-w-0">
              <h3 className="truncate text-lg font-bold text-ink-900 transition-colors group-hover:text-brand-600">
                {business.name}
              </h3>
            </Link>
            {business.isVerified && (
              <span className="badge shrink-0 bg-emerald-50 text-emerald-700">
                <ShieldCheck size={11} /> Verified
              </span>
            )}
          </div>

          <div className="mt-1.5 flex flex-wrap items-center gap-2">
            <span
              className={`inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-xs font-bold text-white ${ratingTint(business.avgRating)}`}
            >
              {business.avgRating > 0 ? business.avgRating.toFixed(1) : "New"}
              <Star size={10} className="fill-current" />
            </span>
            <span className="text-xs text-ink-500">
              {business.reviewCount} {business.reviewCount === 1 ? "Rating" : "Ratings"}
            </span>
            {signal && SignalIcon && (
              <span className={`badge ${signal.tint}`}>
                <SignalIcon size={10} /> {signal.label}
              </span>
            )}
          </div>

          <p className="mt-1.5 flex items-center gap-1 text-sm text-ink-600">
            <MapPin size={13} className="shrink-0 text-ink-400" />
            <span className="truncate">
              {area}, {business.city}
            </span>
            {business.distanceKm !== undefined && business.distanceKm !== null && (
              <span className="shrink-0 text-ink-400">· {business.distanceKm.toFixed(1)} km</span>
            )}
          </p>

          <div className="mt-2 flex flex-wrap gap-1.5">
            <span className="badge bg-gray-100 text-gray-600">{business.categoryName ?? business.category?.name}</span>
            {business.city && <span className="badge bg-gray-100 text-gray-600">{business.city}</span>}
          </div>

          <div className="mt-3 flex flex-wrap gap-2">
            <button
              onClick={() => setNumberShown(true)}
              className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-2 text-sm font-semibold text-white transition-colors hover:bg-emerald-700"
            >
              <Phone size={14} />
              {numberShown ? business.phone : "Show Number"}
            </button>
            <a
              href={whatsappUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-200 bg-white px-3 py-2 text-sm font-semibold text-emerald-700 transition-colors hover:bg-emerald-50"
            >
              <MessageSquare size={14} /> WhatsApp
            </a>
            <button
              onClick={() => setEnquiry(true)}
              className="inline-flex items-center gap-1.5 rounded-lg bg-sky-600 px-3 py-2 text-sm font-semibold text-white transition-colors hover:bg-sky-700"
            >
              <MessageSquare size={14} /> Send Enquiry
            </button>
          </div>
        </div>
      </div>

      {enquiry && <EnquiryModal business={business} onClose={() => setEnquiry(false)} />}
    </div>
  );
}

export default function SearchResults() {
  const [params, setParams] = useSearchParams();
  const { city, geo, setCity, setGeo } = useLocationStore();

  const categorySlug = params.get("category") ?? "";
  const q = params.get("q") ?? "";
  const sort = (params.get("sort") as SortKey) ?? "relevance";
  const minRating = params.get("minRating") ?? "";
  // A 10km default silently hid everything when the visitor's captured
  // location was far from any listing; a directory should reach wider.
  const radiusKm = params.get("radiusKm") ?? "50";
  const page = Number(params.get("page") ?? 1);

  const [categories, setCategories] = useState<Category[]>([]);
  const [results, setResults] = useState<Business[]>([]);
  const [meta, setMeta] = useState({ total: 0, totalPages: 1 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showFilters, setShowFilters] = useState(false);

  useEffect(() => {
    categoriesApi.list().then(setCategories).catch(() => undefined);
  }, []);

  const category = useMemo(
    () => categories.find((c) => c.slug === categorySlug),
    [categories, categorySlug],
  );

  // The heading mirrors what was actually searched: category and/or term,
  // narrowed to the chosen location.
  const locationLabel = geo ? "Near you" : city || "All locations";
  const subject = category?.name ?? (q ? `“${q}”` : "Businesses");
  const heading = `Popular ${subject}${geo || city ? ` in ${locationLabel}` : ""}`;

  function updateParams(patch: Record<string, string | number | null>) {
    const next = new URLSearchParams(params);
    Object.entries(patch).forEach(([key, value]) => {
      if (value === null || value === "") next.delete(key);
      else next.set(key, String(value));
    });
    // Any filter change restarts from the first page.
    if (!("page" in patch)) next.delete("page");
    setParams(next);
  }

  useEffect(() => {
    setLoading(true);
    setError("");
    searchApi
      .search({
        q: q || undefined,
        categorySlug: categorySlug || undefined,
        city: geo ? undefined : city || undefined,
        lat: geo?.lat,
        lng: geo?.lng,
        radiusKm: geo ? Number(radiusKm) : undefined,
        minRating: minRating || undefined,
        sort: geo && sort === "relevance" ? "distance" : sort,
        page,
      })
      .then((res) => {
        setResults(res.data);
        setMeta({ total: res.meta.total, totalPages: res.meta.totalPages });
      })
      .catch((err) => setError(apiErrorMessage(err)))
      .finally(() => setLoading(false));
  }, [q, categorySlug, city, geo, minRating, sort, radiusKm, page]);

  return (
    <div>
      {/* Breadcrumbs */}
      <nav className="mb-2 flex flex-wrap items-center gap-1 text-xs text-ink-500">
        <Link to="/" className="hover:text-brand-600">
          Home
        </Link>
        {(city || geo) && (
          <>
            <ChevronRight size={12} className="text-ink-300" />
            <span>{locationLabel}</span>
          </>
        )}
        {category && (
          <>
            <ChevronRight size={12} className="text-ink-300" />
            <span className="text-ink-700">
              {category.name}
              {city ? ` in ${city}` : ""}
            </span>
          </>
        )}
        {meta.total > 0 && (
          <>
            <ChevronRight size={12} className="text-ink-300" />
            <span className="font-semibold text-brand-700">{meta.total}+ Listings</span>
          </>
        )}
      </nav>

      <h1 className="text-xl font-extrabold text-ink-900 sm:text-2xl">{heading}</h1>

      {/* Active filters — the location narrowing results must never be invisible */}
      {(geo || city || minRating) && (
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <span className="text-xs text-ink-500">Filtered by:</span>
          {geo && (
            <button
              onClick={() => setGeo(null)}
              className="badge bg-brand-50 text-brand-700 hover:bg-brand-100"
              title="Show results everywhere"
            >
              <MapPin size={11} /> Within {radiusKm} km of you <X size={11} />
            </button>
          )}
          {city && (
            <button
              onClick={() => setCity("")}
              className="badge bg-brand-50 text-brand-700 hover:bg-brand-100"
              title="Show results everywhere"
            >
              <MapPin size={11} /> {city} <X size={11} />
            </button>
          )}
          {minRating && (
            <button
              onClick={() => updateParams({ minRating: null })}
              className="badge bg-brand-50 text-brand-700 hover:bg-brand-100"
            >
              {minRating}★ &amp; above <X size={11} />
            </button>
          )}
        </div>
      )}

      {/* Filter bar */}
      <div className="mt-3 flex flex-wrap items-center gap-2">
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
          value={minRating}
          onChange={(e) => updateParams({ minRating: e.target.value })}
          className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-semibold text-ink-700 focus:border-brand-500 focus:outline-none"
        >
          {RATING_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>

        <select
          value={categorySlug}
          onChange={(e) => updateParams({ category: e.target.value })}
          className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-semibold text-ink-700 focus:border-brand-500 focus:outline-none"
        >
          <option value="">All categories</option>
          {categories.map((c) => (
            <option key={c.id} value={c.slug}>
              {c.name}
            </option>
          ))}
        </select>

        {geo && (
          <select
            value={radiusKm}
            onChange={(e) => updateParams({ radiusKm: e.target.value })}
            className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-semibold text-ink-700 focus:border-brand-500 focus:outline-none"
          >
            {["5", "10", "25", "50", "100"].map((km) => (
              <option key={km} value={km}>
                Within {km} km
              </option>
            ))}
          </select>
        )}

        <button
          onClick={() => setShowFilters((v) => !v)}
          className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-sm font-semibold transition-colors ${
            showFilters ? "border-brand-500 bg-brand-50 text-brand-700" : "border-gray-300 bg-white text-ink-700 hover:bg-gray-50"
          }`}
        >
          <SlidersHorizontal size={14} /> Change location
        </button>
      </div>

      {showFilters && (
        <div className="card mt-3 p-4">
          <label className="mb-1.5 block text-xs font-semibold text-ink-700">Search in</label>
          <LocationInput
            value={city}
            onChange={(next) => {
              setCity(next);
              updateParams({ page: null });
            }}
            onDetect={(lat, lng) => {
              setGeo({ lat, lng });
              updateParams({ page: null });
            }}
          />
          {geo && (
            <button
              onClick={() => setGeo(null)}
              className="mt-2 text-xs font-semibold text-brand-600 hover:underline"
            >
              Clear “near me” and search by city instead
            </button>
          )}
        </div>
      )}

      {/* Results */}
      <div className="mt-5">
        {error && <p className="mb-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

        {loading && <CardSkeleton count={4} className="space-y-3" />}

        {!loading && (
          <div className="space-y-3">
            {results.map((b, i) => (
              <ResultRow key={b.id} business={b} index={i} />
            ))}
            {results.length === 0 && (
              <div className="card py-14 text-center text-ink-500">
                <Search size={30} className="mx-auto mb-3 text-gray-300" />
                <p className="font-semibold text-ink-700">
                  No {category?.name.toLowerCase() ?? "businesses"} found
                  {geo ? ` within ${radiusKm} km of you` : city ? ` in ${city}` : ""}
                </p>

                {/* The location filter is the usual reason, so lead with clearing it. */}
                {(geo || city) && (
                  <>
                    <p className="mx-auto mt-1 max-w-md text-sm">
                      {geo
                        ? "Your saved location is limiting these results."
                        : `Only listings in ${city} are being shown.`}
                    </p>
                    <div className="mt-4 flex flex-wrap justify-center gap-2">
                      <button
                        onClick={() => {
                          setGeo(null);
                          setCity("");
                        }}
                        className="btn-primary px-4 py-2.5 text-sm"
                      >
                        Search everywhere
                      </button>
                      {geo && Number(radiusKm) < 100 && (
                        <button onClick={() => updateParams({ radiusKm: 100 })} className="btn-secondary px-4 py-2.5 text-sm">
                          Widen to 100 km
                        </button>
                      )}
                    </div>
                  </>
                )}

                {!geo && !city && (
                  <p className="mt-1 text-sm">
                    Try a different category{q ? ` or search term` : ""}.
                    {q && (
                      <button onClick={() => updateParams({ q: null })} className="ml-1 font-semibold text-brand-600 hover:underline">
                        Clear “{q}”
                      </button>
                    )}
                  </p>
                )}
              </div>
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
    </div>
  );
}
