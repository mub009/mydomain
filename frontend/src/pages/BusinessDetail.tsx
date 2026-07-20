import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { businessesApi, bookingsApi, leadsApi, reviewsApi } from "@/api/endpoints";
import { apiErrorMessage } from "@/api/client";
import { Business } from "@/types";
import { useAuthStore } from "@/store/authStore";
import StarRating from "@/components/StarRating";

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
  if (!business) return <p className="text-gray-500">Loading…</p>;

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
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
      <div className="lg:col-span-2 space-y-8">
        <div>
          <div className="text-sm text-brand-600 font-medium">{business.category?.name}</div>
          <h1 className="text-3xl font-bold">{business.name}</h1>
          <p className="text-gray-500 mt-1">
            {business.addressLine1 ? `${business.addressLine1}, ` : ""}
            {business.city}, {business.state}
          </p>
          <div className="mt-2">
            <StarRating rating={business.avgRating} count={business.reviewCount} />
          </div>
          {business.description && <p className="mt-4 text-gray-700">{business.description}</p>}
          <p className="mt-2 text-gray-700">
            📞 {business.phone} {business.email && <> · ✉️ {business.email}</>}
          </p>
        </div>

        {business.hours && business.hours.length > 0 && (
          <div>
            <h2 className="text-xl font-semibold mb-2">Hours</h2>
            <ul className="text-sm text-gray-700 space-y-1">
              {business.hours.map((h) => (
                <li key={h.dayOfWeek}>
                  {DAY_NAMES[h.dayOfWeek]}: {h.isClosed ? "Closed" : `${h.openTime} – ${h.closeTime}`}
                </li>
              ))}
            </ul>
          </div>
        )}

        {business.services && business.services.length > 0 && (
          <div>
            <h2 className="text-xl font-semibold mb-2">Services & Booking</h2>
            <div className="space-y-2 mb-4">
              {business.services.map((s) => (
                <div key={s.id} className="border rounded-md p-3 flex justify-between items-center">
                  <div>
                    <p className="font-medium">{s.name}</p>
                    <p className="text-sm text-gray-500">{s.durationMins} mins</p>
                  </div>
                  <p className="font-semibold">
                    {s.priceCents > 0 ? `${s.currency} ${(s.priceCents / 100).toFixed(2)}` : "Free"}
                  </p>
                </div>
              ))}
            </div>
            {user ? (
              <form onSubmit={submitBooking} className="border rounded-md p-4 space-y-3 bg-white">
                <h3 className="font-medium">Book a service</h3>
                <select
                  required
                  value={bookingForm.serviceId}
                  onChange={(e) => setBookingForm({ ...bookingForm, serviceId: e.target.value })}
                  className="w-full border rounded-md px-3 py-2"
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
                  className="w-full border rounded-md px-3 py-2"
                />
                <button className="bg-brand-600 text-white rounded-md px-4 py-2">Request booking</button>
              </form>
            ) : (
              <p className="text-sm text-gray-500">Log in to book a service.</p>
            )}
          </div>
        )}

        <div>
          <h2 className="text-xl font-semibold mb-2">Reviews</h2>
          {user && (
            <form onSubmit={submitReview} className="border rounded-md p-4 space-y-3 bg-white mb-4">
              <select
                value={reviewForm.rating}
                onChange={(e) => setReviewForm({ ...reviewForm, rating: Number(e.target.value) })}
                className="border rounded-md px-3 py-2"
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
                className="w-full border rounded-md px-3 py-2"
              />
              <textarea
                placeholder="Share your experience"
                value={reviewForm.comment}
                onChange={(e) => setReviewForm({ ...reviewForm, comment: e.target.value })}
                className="w-full border rounded-md px-3 py-2"
              />
              <button className="bg-brand-600 text-white rounded-md px-4 py-2">Submit review</button>
            </form>
          )}
          <div className="space-y-3">
            {business.reviews?.map((r) => (
              <div key={r.id} className="border rounded-md p-3">
                <div className="flex justify-between">
                  <p className="font-medium">
                    {r.user?.firstName} {r.user?.lastName}
                  </p>
                  <StarRating rating={r.rating} />
                </div>
                {r.title && <p className="font-medium text-sm mt-1">{r.title}</p>}
                {r.comment && <p className="text-sm text-gray-700 mt-1">{r.comment}</p>}
                {r.ownerReply && (
                  <div className="mt-2 bg-gray-50 rounded-md p-2 text-sm">
                    <span className="font-medium">Owner reply: </span>
                    {r.ownerReply}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      <div>
        <form onSubmit={submitLead} className="border rounded-md p-4 space-y-3 bg-white sticky top-20">
          <h3 className="font-semibold">Get in touch</h3>
          {notice && <p className="text-sm text-brand-700">{notice}</p>}
          <input
            required
            placeholder="Your name"
            value={leadForm.name}
            onChange={(e) => setLeadForm({ ...leadForm, name: e.target.value })}
            className="w-full border rounded-md px-3 py-2"
          />
          <input
            required
            placeholder="Phone number"
            value={leadForm.phone}
            onChange={(e) => setLeadForm({ ...leadForm, phone: e.target.value })}
            className="w-full border rounded-md px-3 py-2"
          />
          <input
            placeholder="Email (optional)"
            value={leadForm.email}
            onChange={(e) => setLeadForm({ ...leadForm, email: e.target.value })}
            className="w-full border rounded-md px-3 py-2"
          />
          <textarea
            placeholder="Message"
            value={leadForm.message}
            onChange={(e) => setLeadForm({ ...leadForm, message: e.target.value })}
            className="w-full border rounded-md px-3 py-2"
          />
          <button className="w-full bg-brand-600 text-white rounded-md py-2">Send inquiry</button>
        </form>
      </div>
    </div>
  );
}
