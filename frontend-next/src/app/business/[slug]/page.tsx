import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Building2, Calendar, ChevronRight, Clock, Globe, Mail, MapPin, Navigation, ShieldCheck, Briefcase } from "lucide-react";
import { api } from "@/lib/api";
import { to12Hour, DAY_NAMES, getOpenStatus } from "@/lib/time";
import StarRating, { StarRow } from "@/components/StarRating";
import PageLinks from "@/components/PageLinks";
import { PhoneReveal, WhatsappLink, ShareButton, CopyAddress } from "@/components/business/BusinessActions";
import LeadForm from "@/components/business/LeadForm";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "";

function fullAddress(b: { addressLine1?: string; addressLine2?: string | null; city: string; state: string; postalCode?: string; country?: string }): string {
  return [b.addressLine1, b.addressLine2, b.city, b.state, b.postalCode, b.country].filter(Boolean).join(", ");
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString(undefined, { day: "2-digit", month: "short", year: "numeric" });
  } catch {
    return "";
  }
}

async function loadBusiness(slug: string) {
  try {
    return await api.business(slug);
  } catch {
    return null;
  }
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const biz = await loadBusiness(slug);
  if (!biz) return { title: "Business not found" };

  const title = `${biz.name} — ${biz.category?.name ?? "Business"} in ${biz.city}`;
  const description =
    biz.description?.slice(0, 155) ??
    `${biz.name} in ${biz.city}, ${biz.state}. ${biz.avgRating > 0 ? `Rated ${biz.avgRating.toFixed(1)}/5 from ${biz.reviewCount} reviews. ` : ""}View contact details, hours, and reviews on Markkito.`;
  const image = biz.photos?.[0]?.url;

  return {
    title,
    description,
    alternates: { canonical: `/business/${biz.slug}` },
    openGraph: { title, description, type: "website", images: image ? [image] : undefined },
  };
}

export default async function BusinessDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ reviewPage?: string }>;
}) {
  const { slug } = await params;
  const { reviewPage: reviewPageParam } = await searchParams;
  const biz = await loadBusiness(slug);
  if (!biz) notFound();

  const reviewPage = Math.max(1, Number(reviewPageParam) || 1);
  const reviewsRes = await api.reviews(biz.id, reviewPage).catch(() => null);
  const reviews = reviewsRes?.data ?? biz.reviews ?? [];

  const photos = biz.photos ?? [];
  const services = biz.services ?? [];
  const directionsUrl = `https://www.google.com/maps/dir/?api=1&destination=${biz.latitude},${biz.longitude}`;
  const openStatus = getOpenStatus(biz.hours);

  // https://schema.org/LocalBusiness — the concrete fix for "Google isn't
  // indexing this": real server-rendered HTML plus structured data is what
  // lets a business show up in local search / the knowledge panel, not just
  // a plain <title> tag.
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "LocalBusiness",
    name: biz.name,
    description: biz.description ?? undefined,
    image: photos.map((p) => p.url),
    address: {
      "@type": "PostalAddress",
      streetAddress: biz.addressLine1,
      addressLocality: biz.city,
      addressRegion: biz.state,
      postalCode: biz.postalCode,
      addressCountry: biz.country ?? "IN",
    },
    geo: { "@type": "GeoCoordinates", latitude: biz.latitude, longitude: biz.longitude },
    telephone: biz.phone,
    ...(biz.website ? { url: biz.website } : {}),
    ...(biz.avgRating > 0
      ? { aggregateRating: { "@type": "AggregateRating", ratingValue: biz.avgRating, reviewCount: biz.reviewCount } }
      : {}),
  };

  return (
    <div className="space-y-4">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      {/* Breadcrumbs */}
      <nav className="flex items-center gap-1.5 text-xs text-ink-500 flex-wrap">
        <Link href="/" className="hover:text-brand-600">
          {biz.city}
        </Link>
        {biz.category && (
          <>
            <ChevronRight size={12} />
            <Link href={`/search?category=${biz.category.slug}`} className="hover:text-brand-600">
              {biz.category.name} in {biz.city}
            </Link>
          </>
        )}
        <ChevronRight size={12} />
        <span className="text-ink-700 font-medium">{biz.name}</span>
      </nav>

      {/* Photo mosaic */}
      {photos.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 rounded-2xl overflow-hidden h-64 sm:h-80">
          <div className="relative h-full bg-gray-100">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={photos[0].url} alt={photos[0].caption ?? biz.name} className="h-full w-full object-cover" />
          </div>
          {photos.length > 1 && (
            <div className="hidden sm:grid grid-cols-2 grid-rows-2 gap-2">
              {photos.slice(1, 5).map((p, i) => (
                <div key={p.id} className="relative bg-gray-100 overflow-hidden">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={p.url} alt={p.caption ?? biz.name} className="h-full w-full object-cover" />
                  {i === Math.min(photos.length, 5) - 2 && photos.length > 5 && (
                    <span className="absolute inset-0 flex items-center justify-center bg-black/45 text-white text-sm font-semibold">
                      +{photos.length - 5} more
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Header card */}
      <div className="card p-5">
        <div className="flex flex-col sm:flex-row sm:items-start gap-4 justify-between">
          <div className="flex items-start gap-4 min-w-0">
            <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-600 border border-brand-100 shadow-sm overflow-hidden">
              {biz.logoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
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
                  <span className={`badge ${openStatus.open ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-600"}`}>
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
          {biz.category && <span className="badge bg-gray-100 text-ink-700 shrink-0">{biz.category.name}</span>}
        </div>

        <div className="flex flex-wrap items-center gap-2 mt-4">
          <PhoneReveal phone={biz.phone} />
          <WhatsappLink phone={biz.phone} />
          <ShareButton name={biz.name} />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 lg:gap-8">
        {/* Main column */}
        <div className="lg:col-span-2 space-y-6">
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
                      {h.isClosed ? "Closed" : `${to12Hour(h.openTime)} – ${to12Hour(h.closeTime)}`}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {services.length > 0 && (
            <div className="card p-5">
              <h2 className="text-base font-bold text-ink-900 mb-3 flex items-center gap-1.5">
                <Calendar size={16} className="text-brand-600" /> Services
              </h2>
              <div className="space-y-2">
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
              <a href={`${APP_URL}/business/${biz.slug}`} className="btn-secondary w-full mt-4 py-2.5 text-sm justify-center">
                Book a service
              </a>
            </div>
          )}

          {/* Reviews */}
          <div className="card p-5">
            <h2 className="text-base font-bold text-ink-900 mb-4">Reviews &amp; Ratings</h2>

            <div className="flex items-center gap-4 mb-5">
              <div className="flex h-16 w-16 flex-col items-center justify-center rounded-xl bg-brand-600 text-white">
                <span className="text-xl font-extrabold leading-none">{biz.avgRating.toFixed(1)}</span>
              </div>
              <div>
                <p className="font-bold text-ink-900">{biz.reviewCount} Ratings</p>
                <p className="text-xs text-ink-500">Rating based on verified customer reviews</p>
              </div>
              <a href={`${APP_URL}/business/${biz.slug}?review=1`} className="btn-secondary ml-auto px-4 py-2 text-sm shrink-0">
                Write a review
              </a>
            </div>

            <div className="space-y-3">
              {reviews.map((r) => (
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
                  {r.title && <p className="font-medium text-sm text-ink-800 mt-1">&ldquo;{r.title}&rdquo;</p>}
                  {r.comment && <p className="text-sm text-ink-700 mt-1">{r.comment}</p>}
                  {r.ownerReply && (
                    <div className="mt-2 bg-brand-50 rounded-md p-2.5 text-sm text-ink-700">
                      <span className="font-semibold text-brand-700">Owner reply: </span>
                      {r.ownerReply}
                    </div>
                  )}
                </div>
              ))}
              {reviews.length === 0 && <p className="text-sm text-ink-500">No reviews yet — be the first to leave one.</p>}
            </div>
            {reviewsRes && (
              <PageLinks page={reviewPage} totalPages={reviewsRes.meta.totalPages} basePath={`/business/${biz.slug}`} />
            )}
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          <div className="card p-5 space-y-4">
            <div>
              <h3 className="font-bold text-ink-900 mb-1.5">Contact</h3>
              <PhoneReveal phone={biz.phone} variant="link" />
            </div>

            <div className="border-t border-gray-100 pt-4">
              <h3 className="font-bold text-ink-900 mb-1.5">Address</h3>
              <p className="text-sm text-ink-600 leading-relaxed">{fullAddress(biz)}</p>
              <div className="flex items-center gap-4 mt-2 text-sm">
                <a href={directionsUrl} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-brand-600 font-medium hover:underline">
                  <Navigation size={14} /> Get Directions
                </a>
                <CopyAddress address={fullAddress(biz)} />
              </div>
            </div>

            <div className="border-t border-gray-100 pt-4 space-y-3 text-sm">
              {biz.email && (
                <a href={`mailto:${biz.email}`} className="flex items-center gap-2 text-ink-700 hover:text-brand-600">
                  <Mail size={15} className="text-brand-600" /> Send Enquiry by Email
                </a>
              )}
              {biz.website && (
                <a href={biz.website} target="_blank" rel="noreferrer" className="flex items-center gap-2 text-ink-700 hover:text-brand-600">
                  <Globe size={15} className="text-brand-600" /> Visit our Website
                </a>
              )}
            </div>
          </div>

          {biz.category && (
            <div className="card p-5">
              <h3 className="font-bold text-ink-900 mb-3">Also listed in</h3>
              <Link href={`/search?category=${biz.category.slug}`} className="badge bg-gray-100 text-ink-700 hover:bg-gray-200">
                {biz.category.name}
              </Link>
            </div>
          )}

          <LeadForm businessId={biz.id} />
        </div>
      </div>
    </div>
  );
}
