import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import {
  Bookmark,
  Briefcase,
  Building2,
  Calendar,
  ChevronRight,
  Clock,
  Copy,
  Globe,
  Mail,
  MapPin,
  MessageSquare,
  Navigation,
  Phone,
  Share2,
  ShieldCheck,
  Star,
  ThumbsUp,
  TrendingUp,
} from "lucide-react";
import { businessesApi, bookingsApi, leadsApi, reviewsApi } from "@/api/endpoints";
import { apiErrorMessage } from "@/api/client";
import { Business, Review } from "@/types";
import { useAuthStore } from "@/store/authStore";
import StarRating, { StarRow } from "@/components/StarRating";
import { Spinner } from "@/components/Loading";
import Pagination from "@/components/Pagination";

const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const TABS = ["Overview", "Photos", "Services", "Reviews"] as const;
type Tab = (typeof TABS)[number];
type ReviewSort = "relevant" | "latest" | "high";

// Photo with graceful fallback: user-uploaded URLs may 404, so swap in a
// neutral placeholder rather than showing the browser's broken-image icon.
function PhotoImage({ src, alt, className }: { src: string; alt: string; className?: string }) {
  const [failed, setFailed] = useState(false);
  if (failed) {
    return (
      <div className={`flex items-center justify-center bg-gray-100 text-gray-300 ${className ?? ""}`}>
        <Building2 size={32} />
      </div>
    );
  }
  return <img src={src} alt={alt} onError={() => setFailed(true)} className={className} />;
}

// Magazine-style photo mosaic: one large lead image + a 2x2 grid, with a
// "See all photos" overlay. Falls back gracefully when there are few photos.
function PhotoHero({
  photos,
  name,
  onSeeAll,
}: {
  photos: NonNullable<Business["photos"]>;
  name: string;
  onSeeAll: () => void;
}) {
  if (photos.length === 0) return null;
  const lead = photos[0];
  const rest = photos.slice(1, 5);

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 rounded-2xl overflow-hidden h-64 sm:h-80">
      <button onClick={onSeeAll} className="relative group h-full bg-gray-100">
        <PhotoImage src={lead.url} alt={lead.caption ?? name} className="h-full w-full object-cover" />
        <span className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors" />
      </button>
      {rest.length > 0 && (
        <div className="hidden sm:grid grid-cols-2 grid-rows-2 gap-2">
          {rest.map((p, i) => (
            <button key={p.id} onClick={onSeeAll} className="relative group bg-gray-100 overflow-hidden">
              <PhotoImage src={p.url} alt={p.caption ?? name} className="h-full w-full object-cover" />
              <span className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors" />
              {i === rest.length - 1 && photos.length > 5 && (
                <span className="absolute inset-0 flex items-center justify-center bg-black/45 text-white text-sm font-semibold">
                  +{photos.length - 5} more
                </span>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString(undefined, { day: "2-digit", month: "short", year: "numeric" });
  } catch {
    return "";
  }
}

function fullAddress(b: Business): string {
  return [b.addressLine1, b.addressLine2, b.city, b.state, b.postalCode, b.country]
    .filter(Boolean)
    .join(", ");
}

interface OpenStatus {
  open: boolean;
  label: string;
  detail: string;
}

// Derive an "Open now / Closed" status from today's business hours.
function getOpenStatus(hours: Business["hours"]): OpenStatus | null {
  if (!hours || hours.length === 0) return null;
  const now = new Date();
  const today = hours.find((h) => h.dayOfWeek === now.getDay());
  if (!today) return null;
  if (today.isClosed) return { open: false, label: "Closed today", detail: "Opens as per weekly hours" };

  const toMin = (t: string) => {
    const [h, m] = t.split(":").map(Number);
    return h * 60 + m;
  };
  const nowMin = now.getHours() * 60 + now.getMinutes();
  const open = toMin(today.openTime);
  const close = toMin(today.closeTime);

  if (nowMin >= open && nowMin < close) {
    return { open: true, label: "Open now", detail: `Closes at ${today.closeTime}` };
  }
  if (nowMin < open) {
    return { open: false, label: "Closed", detail: `Opens at ${today.openTime}` };
  }
  return { open: false, label: "Closed", detail: `Opens tomorrow` };
}

export default function BusinessDetail() {
  const { slug } = useParams<{ slug: string }>();
  const [searchParams] = useSearchParams();
  const user = useAuthStore((s) => s.user);
  // A "Markkito review" QR board lands here with ?review=1, so open straight
  // on the review composer rather than the overview.
  const wantsReview = searchParams.get("review") === "1";
  const [business, setBusiness] = useState<Business | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [tab, setTab] = useState<Tab>(wantsReview ? "Reviews" : "Overview");
  const [numberShown, setNumberShown] = useState(false);
  const [bookmarked, setBookmarked] = useState(false);
  const [copied, setCopied] = useState(false);
  const [reviewSort, setReviewSort] = useState<ReviewSort>("relevant");
  const [reviews, setReviews] = useState<Review[]>([]);
  const [reviewPage, setReviewPage] = useState(1);
  const [reviewTotalPages, setReviewTotalPages] = useState(1);
  const [reviewTotal, setReviewTotal] = useState(0);
  const [reviewsLoading, setReviewsLoading] = useState(false);

  const [leadForm, setLeadForm] = useState({ name: "", phone: "", email: "", message: "" });
  const [reviewForm, setReviewForm] = useState({ rating: 5, title: "", comment: "" });
  const [bookingForm, setBookingForm] = useState({ serviceId: "", scheduledAt: "" });

  const reviewFormRef = useRef<HTMLDivElement | null>(null);

  // Scroll the composer into view once the listing has rendered, so a customer
  // who scanned the board sees the star rating without hunting for it.
  useEffect(() => {
    if (!wantsReview || !business) return;
    const timer = window.setTimeout(
      () => reviewFormRef.current?.scrollIntoView({ behavior: "smooth", block: "center" }),
      250,
    );
    return () => window.clearTimeout(timer);
  }, [wantsReview, business]);

  useEffect(() => {
    if (!slug) return;
    setBusiness(null);
    businessesApi
      .get(slug)
      .then(setBusiness)
      .catch((err) => setError(apiErrorMessage(err)));
  }, [slug]);

  // Reviews are paginated separately — the business payload only embeds the
  // first few for the summary strip.
  useEffect(() => {
    if (!business || tab !== "Reviews") return;
    setReviewsLoading(true);
    reviewsApi
      .list(business.id, { page: reviewPage })
      .then((r) => {
        setReviews(r.data);
        setReviewTotalPages(r.meta.totalPages);
        setReviewTotal(r.meta.total);
      })
      .catch(() => undefined)
      .finally(() => setReviewsLoading(false));
  }, [business, tab, reviewPage]);

  const sortedReviews = useMemo<Review[]>(() => {
    const list = [...(reviews.length > 0 ? reviews : business?.reviews ?? [])];
    if (reviewSort === "latest") return list.sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt));
    if (reviewSort === "high") return list.sort((a, b) => b.rating - a.rating);
    return list;
  }, [reviews, business?.reviews, reviewSort]);

  if (error) return <p className="text-red-600">{error}</p>;
  if (!business) {
    return (
      <div className="space-y-4">
        <div className="h-6 w-1/3 rounded bg-gray-200 animate-pulse" />
        <div className="h-40 rounded-2xl bg-gray-200 animate-pulse" />
      </div>
    );
  }

  const biz = business;
  const photos = biz.photos ?? [];
  const services = biz.services ?? [];
  const directionsUrl = `https://www.google.com/maps/dir/?api=1&destination=${biz.latitude},${biz.longitude}`;
  const whatsappUrl = `https://wa.me/${biz.phone.replace(/[^0-9]/g, "")}`;
  const openStatus = getOpenStatus(biz.hours);

  async function submitLead(e: React.FormEvent) {
    e.preventDefault();
    setNotice("");
    try {
      await leadsApi.create(biz.id, { ...leadForm, source: "BUSINESS_PROFILE" });
      setNotice("Thanks! The business will contact you shortly.");
      setLeadForm({ name: "", phone: "", email: "", message: "" });
    } catch (err) {
      setNotice(apiErrorMessage(err));
    }
  }

  async function submitReview(e: React.FormEvent) {
    e.preventDefault();
    setNotice("");
    try {
      await reviewsApi.create(biz.id, reviewForm);
      setNotice("Review submitted. Thank you!");
      setReviewForm({ rating: 5, title: "", comment: "" });
      const refreshed = await businessesApi.get(slug!);
      setBusiness(refreshed);
      setReviewPage(1); // jump back to the first page so the new review is visible
    } catch (err) {
      setNotice(apiErrorMessage(err));
    }
  }

  async function submitBooking(e: React.FormEvent) {
    e.preventDefault();
    setNotice("");
    try {
      await bookingsApi.create(biz.id, bookingForm);
      setNotice("Booking request sent!");
      setBookingForm({ serviceId: "", scheduledAt: "" });
    } catch (err) {
      setNotice(apiErrorMessage(err));
    }
  }

  async function copyAddress() {
    try {
      await navigator.clipboard.writeText(fullAddress(biz));
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      // clipboard blocked — no-op
    }
  }

  async function shareBusiness() {
    const url = window.location.href;
    if (navigator.share) {
      try {
        await navigator.share({ title: biz.name, url });
        return;
      } catch {
        // user cancelled or unsupported — fall through to clipboard
      }
    }
    try {
      await navigator.clipboard.writeText(url);
      setNotice("Link copied to clipboard.");
    } catch {
      // no-op
    }
  }

  // Recent rating trend: newest first, capped at 9 (matches the reference strip)
  const ratingTrend = (biz.reviews ?? []).slice(0, 9).map((r) => r.rating);

  return (
    <div className="space-y-4">
      {/* Breadcrumbs */}
      <nav className="flex items-center gap-1.5 text-xs text-ink-500 flex-wrap">
        <Link to="/" className="hover:text-brand-600">
          {biz.city}
        </Link>
        <ChevronRight size={12} />
        {biz.category && (
          <>
            <Link to={`/?category=${biz.category.slug}`} className="hover:text-brand-600">
              {biz.category.name} in {biz.city}
            </Link>
            <ChevronRight size={12} />
          </>
        )}
        <span className="text-ink-700 font-medium">{biz.name}</span>
      </nav>

      {/* Photo hero */}
      {photos.length > 0 && <PhotoHero photos={photos} name={biz.name} onSeeAll={() => setTab("Photos")} />}

      {/* Header card */}
      <div className="card p-5">
        <div className="flex flex-col sm:flex-row sm:items-start gap-4 justify-between">
          <div className="flex items-start gap-4 min-w-0">
            <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-600 border border-brand-100 shadow-sm overflow-hidden">
              {biz.logoUrl ? (
                <img src={biz.logoUrl} alt={biz.name} className="h-full w-full object-cover" />
              ) : (
                <Building2 size={28} />
              )}
            </div>
            <div className="min-w-0">
              <h1 className="text-2xl sm:text-3xl font-extrabold text-ink-900">{biz.name}</h1>
              <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                <StarRating rating={biz.avgRating} count={biz.reviewCount} />
                {biz.businessType === "B2B" && (
                  <span className="badge bg-violet-50 text-violet-700">
                    <Briefcase size={12} /> B2B Supplier
                  </span>
                )}
                {biz.isVerified && (
                  <span className="badge bg-emerald-50 text-emerald-700">
                    <ShieldCheck size={12} /> Verified
                  </span>
                )}
                {openStatus && (
                  <span
                    className={`badge ${openStatus.open ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-600"}`}
                  >
                    <span className={`h-1.5 w-1.5 rounded-full ${openStatus.open ? "bg-emerald-500" : "bg-red-500"}`} />
                    {openStatus.label}
                  </span>
                )}
              </div>
              <p className="text-ink-500 mt-1.5 flex items-center gap-1 text-sm">
                <MapPin size={14} /> {biz.addressLine1 ? `${biz.addressLine1}, ` : ""}
                {biz.city}, {biz.state}
              </p>
              {openStatus && (
                <p className="text-xs mt-1 flex items-center gap-1 text-ink-500">
                  <Clock size={12} /> {openStatus.detail}
                </p>
              )}
            </div>
          </div>

          {/* Category pills + bookmark */}
          <div className="flex items-start gap-2 shrink-0">
            {biz.category && <span className="badge bg-gray-100 text-ink-700">{biz.category.name}</span>}
            <button
              onClick={() => setBookmarked((v) => !v)}
              title={bookmarked ? "Saved" : "Save"}
              className={`flex h-8 w-8 items-center justify-center rounded-lg border transition-colors ${
                bookmarked ? "bg-brand-50 border-brand-200 text-brand-600" : "border-gray-300 text-ink-500 hover:bg-gray-50"
              }`}
            >
              <Bookmark size={16} fill={bookmarked ? "currentColor" : "none"} />
            </button>
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex flex-wrap items-center gap-2 mt-4">
          <button onClick={() => setNumberShown(true)} className="btn-primary px-4 py-2.5">
            <Phone size={16} /> {numberShown ? biz.phone : "Show Number"}
          </button>
          <a href={whatsappUrl} target="_blank" rel="noreferrer" className="btn-secondary px-4 py-2.5 !text-emerald-700 !border-emerald-300">
            <MessageSquare size={16} /> WhatsApp
          </a>
          <button onClick={shareBusiness} className="btn-secondary px-3 py-2.5" title="Share">
            <Share2 size={16} />
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200 flex gap-1 sticky top-16 bg-gray-50 z-10">
        {TABS.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-3 text-sm font-semibold border-b-2 -mb-px transition-colors ${
              tab === t ? "border-brand-600 text-brand-600" : "border-transparent text-ink-500 hover:text-ink-900"
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 lg:gap-8">
        {/* Main column */}
        <div className="lg:col-span-2 space-y-6">
          {notice && <p className="text-sm text-brand-700 bg-brand-50 rounded-md px-3 py-2">{notice}</p>}

          {/* Photos (Photos tab — full grid) */}
          {tab === "Photos" && (
            <div className="card p-5">
              <h2 className="text-base font-bold text-ink-900 mb-3">Photos</h2>
              {photos.length > 0 ? (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {photos.map((p) => (
                    <div key={p.id} className="aspect-[4/3] rounded-lg overflow-hidden bg-gray-100">
                      <PhotoImage src={p.url} alt={p.caption ?? biz.name} className="h-full w-full object-cover" />
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-ink-500">No photos uploaded yet.</p>
              )}
            </div>
          )}

          {/* About + hours (Overview) */}
          {tab === "Overview" && (
            <>
              {biz.description && (
                <div className="card p-5">
                  <h2 className="text-base font-bold text-ink-900 mb-2">About</h2>
                  <p className="text-sm text-ink-700 leading-relaxed">{biz.description}</p>
                </div>
              )}

              {biz.hours && biz.hours.length > 0 && (
                <div className="card p-5">
                  <h2 className="text-base font-bold text-ink-900 mb-3 flex items-center gap-1.5">
                    <Clock size={16} className="text-brand-600" /> Hours
                  </h2>
                  <ul className="text-sm text-ink-700 divide-y divide-gray-100">
                    {biz.hours.map((h) => (
                      <li key={h.dayOfWeek} className="flex justify-between py-1.5">
                        <span>{DAY_NAMES[h.dayOfWeek]}</span>
                        <span className={h.isClosed ? "text-ink-500" : "font-medium"}>
                          {h.isClosed ? "Closed" : `${h.openTime} – ${h.closeTime}`}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </>
          )}

          {/* Services + booking */}
          {(tab === "Overview" || tab === "Services") && services.length > 0 && (
            <div className="card p-5">
              <h2 className="text-base font-bold text-ink-900 mb-3 flex items-center gap-1.5">
                <Calendar size={16} className="text-brand-600" /> Services &amp; booking
              </h2>
              <div className="space-y-2 mb-4">
                {services.map((s) => (
                  <div key={s.id} className="border border-gray-100 rounded-lg p-3 flex justify-between items-center">
                    <div>
                      <p className="font-medium text-sm text-ink-900">{s.name}</p>
                      {s.description && <p className="text-xs text-ink-500 mt-0.5">{s.description}</p>}
                      <p className="text-xs text-ink-500">{s.durationMins} mins</p>
                    </div>
                    <p className="font-bold text-sm text-brand-700 shrink-0 ml-3">
                      {s.priceCents > 0 ? `${s.currency} ${(s.priceCents / 100).toFixed(2)}` : "Free"}
                    </p>
                  </div>
                ))}
              </div>
              {user ? (
                <form onSubmit={submitBooking} className="bg-gray-50 rounded-lg p-4 space-y-3">
                  <h3 className="text-sm font-semibold text-ink-900">Book a service</h3>
                  <select
                    required
                    value={bookingForm.serviceId}
                    onChange={(e) => setBookingForm({ ...bookingForm, serviceId: e.target.value })}
                    className="input"
                  >
                    <option value="">Select a service</option>
                    {services.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                  <input
                    required
                    type="datetime-local"
                    value={bookingForm.scheduledAt}
                    onChange={(e) => setBookingForm({ ...bookingForm, scheduledAt: e.target.value })}
                    className="input"
                  />
                  <button className="btn-primary w-full py-2.5">Request booking</button>
                </form>
              ) : (
                <p className="text-sm text-ink-500">Log in to book a service.</p>
              )}
            </div>
          )}

          {/* Reviews */}
          {(tab === "Overview" || tab === "Reviews") && (
            <div className="card p-5">
              <h2 className="text-base font-bold text-ink-900 mb-4 flex items-center gap-1.5">
                <MessageSquare size={16} className="text-brand-600" /> Reviews &amp; Ratings
              </h2>

              {/* Rating summary */}
              <div className="flex items-center gap-4 mb-4">
                <div className="flex h-16 w-16 flex-col items-center justify-center rounded-xl bg-brand-600 text-white">
                  <span className="text-xl font-extrabold leading-none">{biz.avgRating.toFixed(1)}</span>
                  <Star size={12} fill="currentColor" strokeWidth={0} className="mt-0.5" />
                </div>
                <div>
                  <p className="font-bold text-ink-900">{biz.reviewCount} Ratings</p>
                  <p className="text-xs text-ink-500">Rating based on verified customer reviews</p>
                </div>
              </div>

              {/* Recent rating trend */}
              {ratingTrend.length > 0 && (
                <div className="mb-5">
                  <p className="text-xs font-semibold text-ink-700 mb-2 flex items-center gap-1">
                    <TrendingUp size={13} /> Recent rating trend
                  </p>
                  <div className="flex gap-2 flex-wrap">
                    {ratingTrend.map((r, i) => (
                      <span
                        key={i}
                        className="inline-flex items-center gap-1 rounded-full border border-gray-200 px-2.5 py-1 text-xs font-medium text-ink-700"
                      >
                        {r.toFixed(1)} <Star size={11} className="text-gold-400" fill="currentColor" strokeWidth={0} />
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Write a review */}
              <div ref={reviewFormRef}>
              {!user && wantsReview && (
                <div className="mb-5 rounded-lg bg-brand-50 px-4 py-3">
                  <p className="text-sm font-semibold text-brand-800">Sign in to leave your review</p>
                  <p className="mt-0.5 text-xs text-brand-700/90">
                    It takes a moment, and {biz.name} will see your rating straight away.
                  </p>
                  <Link
                    to={`/login?next=${encodeURIComponent(`/business/${biz.slug}?review=1`)}`}
                    className="btn-primary mt-3 inline-flex px-4 py-2 text-sm"
                  >
                    Log in to review
                  </Link>
                </div>
              )}
              {user && (
                <form onSubmit={submitReview} className="bg-gray-50 rounded-lg p-4 space-y-3 mb-5">
                  <h3 className="text-sm font-semibold text-ink-900">Write a review</h3>
                  <div className="flex items-center gap-1">
                    {[1, 2, 3, 4, 5].map((n) => (
                      <button
                        key={n}
                        type="button"
                        onClick={() => setReviewForm({ ...reviewForm, rating: n })}
                        className="p-0.5"
                        aria-label={`${n} star`}
                      >
                        <Star
                          size={22}
                          className={n <= reviewForm.rating ? "text-gold-400" : "text-gray-300"}
                          fill={n <= reviewForm.rating ? "currentColor" : "none"}
                          strokeWidth={n <= reviewForm.rating ? 0 : 1.5}
                        />
                      </button>
                    ))}
                  </div>
                  <input
                    placeholder="Title (optional)"
                    value={reviewForm.title}
                    onChange={(e) => setReviewForm({ ...reviewForm, title: e.target.value })}
                    className="input"
                  />
                  <textarea
                    placeholder="Share your experience"
                    value={reviewForm.comment}
                    onChange={(e) => setReviewForm({ ...reviewForm, comment: e.target.value })}
                    className="input min-h-20"
                  />
                  <button className="btn-primary px-5 py-2">Submit review</button>
                </form>
              )}
              </div>

              {/* Sort tabs */}
              {sortedReviews.length > 0 && (
                <div className="flex items-center gap-2 mb-3">
                  {([
                    ["relevant", "Relevant"],
                    ["latest", "Latest"],
                    ["high", "High to Low"],
                  ] as [ReviewSort, string][]).map(([key, label]) => (
                    <button
                      key={key}
                      onClick={() => setReviewSort(key)}
                      className={`text-xs font-medium rounded-md px-3 py-1.5 border transition-colors ${
                        reviewSort === key
                          ? "bg-brand-50 border-brand-200 text-brand-700"
                          : "border-gray-200 text-ink-600 hover:bg-gray-50"
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              )}

              {reviewsLoading && <Spinner label="Loading reviews…" />}

              {!reviewsLoading && (
              <div className="space-y-3">
                {sortedReviews.map((r) => (
                  <div key={r.id} className="border-b border-gray-100 pb-3 last:border-0">
                    <div className="flex justify-between items-start gap-2">
                      <div className="flex items-center gap-2">
                        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-100 text-brand-700 text-xs font-bold">
                          {(r.user?.firstName?.[0] ?? "U").toUpperCase()}
                        </span>
                        <p className="font-semibold text-sm text-ink-900">
                          {r.user?.firstName} {r.user?.lastName}
                        </p>
                      </div>
                      <span className="text-xs text-ink-400">{formatDate(r.createdAt)}</span>
                    </div>
                    <div className="mt-1.5">
                      <StarRow rating={r.rating} size={14} />
                    </div>
                    {r.title && <p className="font-medium text-sm text-ink-800 mt-1">“{r.title}”</p>}
                    {r.comment && <p className="text-sm text-ink-700 mt-1">{r.comment}</p>}
                    {r.ownerReply && (
                      <div className="mt-2 bg-brand-50 rounded-md p-2.5 text-sm text-ink-700">
                        <span className="font-semibold text-brand-700">Owner reply: </span>
                        {r.ownerReply}
                      </div>
                    )}
                    <div className="flex items-center gap-4 mt-2 text-xs text-ink-500">
                      <span className="flex items-center gap-1">
                        <ThumbsUp size={13} /> Helpful
                      </span>
                      <button onClick={shareBusiness} className="flex items-center gap-1 hover:text-brand-600">
                        <Share2 size={13} /> Share
                      </button>
                    </div>
                  </div>
                ))}
                {sortedReviews.length === 0 && (
                  <p className="text-sm text-ink-500">No reviews yet — be the first to leave one.</p>
                )}
              </div>
              )}
              {!reviewsLoading && reviewTotal > 0 && (
                <Pagination page={reviewPage} totalPages={reviewTotalPages} onChange={setReviewPage} />
              )}
            </div>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          {/* Contact card */}
          <div className="card p-5 space-y-4">
            <div>
              <h3 className="font-bold text-ink-900 mb-1.5">Contact</h3>
              <button
                onClick={() => setNumberShown(true)}
                className="flex items-center gap-2 text-sm text-brand-600 font-medium hover:underline"
              >
                <Phone size={15} /> {numberShown ? biz.phone : "Show Number"}
              </button>
            </div>

            <div className="border-t border-gray-100 pt-4">
              <h3 className="font-bold text-ink-900 mb-1.5">Address</h3>
              <p className="text-sm text-ink-600 leading-relaxed">{fullAddress(biz)}</p>
              <div className="flex items-center gap-4 mt-2 text-sm">
                <a
                  href={directionsUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-1 text-brand-600 font-medium hover:underline"
                >
                  <Navigation size={14} /> Get Directions
                </a>
                <button onClick={copyAddress} className="flex items-center gap-1 text-brand-600 font-medium hover:underline">
                  <Copy size={14} /> {copied ? "Copied!" : "Copy"}
                </button>
              </div>
            </div>

            <div className="border-t border-gray-100 pt-4 space-y-3 text-sm">
              {biz.email && (
                <a href={`mailto:${biz.email}`} className="flex items-center gap-2 text-ink-700 hover:text-brand-600">
                  <Mail size={15} className="text-brand-600" /> Send Enquiry by Email
                </a>
              )}
              <button onClick={shareBusiness} className="flex items-center gap-2 text-ink-700 hover:text-brand-600">
                <Share2 size={15} className="text-brand-600" /> Share
              </button>
              {biz.website && (
                <a
                  href={biz.website}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-2 text-ink-700 hover:text-brand-600"
                >
                  <Globe size={15} className="text-brand-600" /> Visit our Website
                </a>
              )}
            </div>
          </div>

          {/* Also listed in */}
          {biz.category && (
            <div className="card p-5">
              <h3 className="font-bold text-ink-900 mb-3">Also listed in</h3>
              <div className="flex flex-wrap gap-2">
                <Link to={`/?category=${biz.category.slug}`} className="badge bg-gray-100 text-ink-700 hover:bg-gray-200">
                  {biz.category.name}
                </Link>
              </div>
            </div>
          )}

          {/* Send enquiry form */}
          <form onSubmit={submitLead} className="card p-5 space-y-3">
            <h3 className="font-bold text-ink-900">Send an enquiry</h3>
            <p className="text-xs text-ink-500 -mt-2">The business will contact you directly.</p>
            <input
              required
              placeholder="Your name"
              value={leadForm.name}
              onChange={(e) => setLeadForm({ ...leadForm, name: e.target.value })}
              className="input"
            />
            <input
              required
              placeholder="Phone number"
              value={leadForm.phone}
              onChange={(e) => setLeadForm({ ...leadForm, phone: e.target.value })}
              className="input"
            />
            <input
              placeholder="Email (optional)"
              value={leadForm.email}
              onChange={(e) => setLeadForm({ ...leadForm, email: e.target.value })}
              className="input"
            />
            <textarea
              placeholder="Message"
              value={leadForm.message}
              onChange={(e) => setLeadForm({ ...leadForm, message: e.target.value })}
              className="input min-h-20"
            />
            <button className="btn-primary w-full py-2.5">Send enquiry</button>
          </form>
        </div>
      </div>
    </div>
  );
}
