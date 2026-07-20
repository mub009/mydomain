import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import {
  Building2,
  Calendar,
  Clock,
  Mail,
  MapPin,
  MessageSquare,
  Phone,
  ShieldCheck,
} from "lucide-react";
import { businessesApi, bookingsApi, leadsApi, reviewsApi } from "@/api/endpoints";
import { apiErrorMessage } from "@/api/client";
import { Business } from "@/types";
import { useAuthStore } from "@/store/authStore";
import StarRating, { StarRow } from "@/components/StarRating";

const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

export default function BusinessDetail() {
  const { slug } = useParams<{ slug: string }>();
  const user = useAuthStore((s) => s.user);
  const [business, setBusiness] = useState<Business | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const [leadForm, setLeadForm] = useState({ name: "", phone: "", email: "", message: "" });
  const [reviewForm, setReviewForm] = useState({ rating: 5, title: "", comment: "" });
  const [bookingForm, setBookingForm] = useState({ serviceId: "", scheduledAt: "" });

  useEffect(() => {
    if (!slug) return;
    businessesApi
      .get(slug)
      .then(setBusiness)
      .catch((err) => setError(apiErrorMessage(err)));
  }, [slug]);

  if (error) return <p className="text-red-600">{error}</p>;
  if (!business) {
    return (
      <div className="space-y-4">
        <div className="h-40 rounded-2xl bg-gray-200 animate-pulse" />
        <div className="h-6 w-1/3 rounded bg-gray-200 animate-pulse" />
      </div>
    );
  }

  async function submitLead(e: React.FormEvent) {
    e.preventDefault();
    setNotice("");
    try {
      await leadsApi.create(business!.id, { ...leadForm, source: "BUSINESS_PROFILE" });
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
      await reviewsApi.create(business!.id, reviewForm);
      setNotice("Review submitted. Thank you!");
      const refreshed = await businessesApi.get(slug!);
      setBusiness(refreshed);
    } catch (err) {
      setNotice(apiErrorMessage(err));
    }
  }

  async function submitBooking(e: React.FormEvent) {
    e.preventDefault();
    setNotice("");
    try {
      await bookingsApi.create(business!.id, bookingForm);
      setNotice("Booking request sent!");
    } catch (err) {
      setNotice(apiErrorMessage(err));
    }
  }

  return (
    <div>
      {/* Banner */}
      <div className="h-32 sm:h-40 rounded-2xl bg-gradient-to-r from-brand-700 via-brand-600 to-brand-500 mb-[-3rem] sm:mb-[-3.5rem]" />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 lg:gap-8">
        <div className="lg:col-span-2 space-y-6">
          {/* Header card */}
          <div className="card p-5 relative">
            <div className="flex items-start gap-4">
              <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-600 border border-brand-100 shadow-sm">
                <Building2 size={28} />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="badge bg-brand-50 text-brand-700">{business.category?.name}</span>
                  {business.isVerified && (
                    <span className="badge bg-emerald-50 text-emerald-700">
                      <ShieldCheck size={12} /> Verified
                    </span>
                  )}
                </div>
                <h1 className="text-2xl sm:text-3xl font-extrabold text-ink-900 mt-1 truncate">{business.name}</h1>
                <p className="text-ink-500 mt-1 flex items-center gap-1 text-sm">
                  <MapPin size={14} />
                  {business.addressLine1 ? `${business.addressLine1}, ` : ""}
                  {business.city}, {business.state}
                </p>
                <div className="mt-2">
                  <StarRating rating={business.avgRating} count={business.reviewCount} />
                </div>
              </div>
            </div>

            {business.description && <p className="mt-4 text-sm text-ink-700 leading-relaxed">{business.description}</p>}

            <div className="mt-4 flex flex-wrap gap-4 text-sm text-ink-700 border-t border-gray-100 pt-4">
              <span className="flex items-center gap-1.5">
                <Phone size={15} className="text-brand-600" /> {business.phone}
              </span>
              {business.email && (
                <span className="flex items-center gap-1.5">
                  <Mail size={15} className="text-brand-600" /> {business.email}
                </span>
              )}
            </div>
          </div>

          {business.hours && business.hours.length > 0 && (
            <div className="card p-5">
              <h2 className="text-base font-bold text-ink-900 mb-3 flex items-center gap-1.5">
                <Clock size={16} className="text-brand-600" /> Hours
              </h2>
              <ul className="text-sm text-ink-700 divide-y divide-gray-100">
                {business.hours.map((h) => (
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

          {business.services && business.services.length > 0 && (
            <div className="card p-5">
              <h2 className="text-base font-bold text-ink-900 mb-3 flex items-center gap-1.5">
                <Calendar size={16} className="text-brand-600" /> Services &amp; booking
              </h2>
              <div className="space-y-2 mb-4">
                {business.services.map((s) => (
                  <div key={s.id} className="border border-gray-100 rounded-lg p-3 flex justify-between items-center">
                    <div>
                      <p className="font-medium text-sm text-ink-900">{s.name}</p>
                      <p className="text-xs text-ink-500">{s.durationMins} mins</p>
                    </div>
                    <p className="font-bold text-sm text-brand-700">
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
                    {business.services.map((s) => (
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

          <div className="card p-5">
            <h2 className="text-base font-bold text-ink-900 mb-3 flex items-center gap-1.5">
              <MessageSquare size={16} className="text-brand-600" /> Reviews
            </h2>
            {user && (
              <form onSubmit={submitReview} className="bg-gray-50 rounded-lg p-4 space-y-3 mb-4">
                <select
                  value={reviewForm.rating}
                  onChange={(e) => setReviewForm({ ...reviewForm, rating: Number(e.target.value) })}
                  className="input sm:w-40"
                >
                  {[5, 4, 3, 2, 1].map((r) => (
                    <option key={r} value={r}>
                      {r} stars
                    </option>
                  ))}
                </select>
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
            <div className="space-y-3">
              {business.reviews?.map((r) => (
                <div key={r.id} className="border border-gray-100 rounded-lg p-3">
                  <div className="flex justify-between items-start gap-2">
                    <p className="font-semibold text-sm text-ink-900">
                      {r.user?.firstName} {r.user?.lastName}
                    </p>
                    <StarRow rating={r.rating} size={14} />
                  </div>
                  {r.title && <p className="font-medium text-sm text-ink-800 mt-1">{r.title}</p>}
                  {r.comment && <p className="text-sm text-ink-700 mt-1">{r.comment}</p>}
                  {r.ownerReply && (
                    <div className="mt-2 bg-brand-50 rounded-md p-2.5 text-sm text-ink-700">
                      <span className="font-semibold text-brand-700">Owner reply: </span>
                      {r.ownerReply}
                    </div>
                  )}
                </div>
              ))}
              {(!business.reviews || business.reviews.length === 0) && (
                <p className="text-sm text-ink-500">No reviews yet — be the first to leave one.</p>
              )}
            </div>
          </div>
        </div>

        <div>
          <form onSubmit={submitLead} className="card p-5 space-y-3 sticky top-20">
            <h3 className="font-bold text-ink-900">Get in touch</h3>
            <p className="text-xs text-ink-500 -mt-2">Send an inquiry and the business will contact you directly.</p>
            {notice && <p className="text-sm text-brand-700 bg-brand-50 rounded-md px-3 py-2">{notice}</p>}
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
            <button className="btn-primary w-full py-2.5">Send inquiry</button>
          </form>
        </div>
      </div>
    </div>
  );
}
