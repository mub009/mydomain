import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  AlertTriangle,
  Calendar,
  CheckCircle2,
  Clock,
  Eye,
  Flag,
  Heart,
  ImageIcon,
  MapPin,
  MessageCircle,
  MessageSquare,
  PauseCircle,
  Phone,
  Send,
  Settings2,
  ShieldOff,
  User as UserIcon,
  X,
} from "lucide-react";
import { classifiedMessagesApi, classifiedReportsApi, classifiedsApi } from "@/api/endpoints";
import { apiErrorMessage } from "@/api/client";
import { ClassifiedListing, ClassifiedReportReason, ClassifiedStatus } from "@/types";
import { useAuthStore } from "@/store/authStore";
import { Spinner } from "@/components/Loading";
import { money } from "@/components/ClassifiedCard";
import { rememberRecentlyViewedClassified } from "@/lib/recentlyViewedClassifieds";

const REPORT_REASONS: { value: ClassifiedReportReason; label: string }[] = [
  { value: "PROHIBITED_ITEM", label: "Prohibited item" },
  { value: "SCAM_FRAUD", label: "Scam or fraud" },
  { value: "INAPPROPRIATE", label: "Inappropriate content" },
  { value: "SPAM", label: "Spam or duplicate" },
  { value: "OTHER", label: "Other" },
];

function ReportModal({ listingId, onClose }: { listingId: string; onClose: () => void }) {
  const [reason, setReason] = useState<ClassifiedReportReason>("PROHIBITED_ITEM");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      await classifiedReportsApi.create(listingId, { reason, message: message.trim() || undefined });
      setDone(true);
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="card w-full max-w-sm p-5" onClick={(e) => e.stopPropagation()}>
        <div className="mb-3 flex items-center justify-between">
          <h3 className="font-bold text-ink-900">Report this listing</h3>
          <button onClick={onClose} className="text-ink-400 hover:text-ink-700" aria-label="Close">
            <X size={18} />
          </button>
        </div>

        {done ? (
          <div className="py-4 text-center">
            <CheckCircle2 size={28} className="mx-auto text-emerald-600" />
            <p className="mt-2 text-sm text-ink-700">Thanks — our team will review this listing.</p>
            <button onClick={onClose} className="btn-secondary mt-4 w-full py-2 text-sm">
              Close
            </button>
          </div>
        ) : (
          <form onSubmit={submit} className="space-y-3">
            <div>
              <label className="mb-1 block text-xs font-semibold text-ink-600">Reason</label>
              <select value={reason} onChange={(e) => setReason(e.target.value as ClassifiedReportReason)} className="input">
                {REPORT_REASONS.map((r) => (
                  <option key={r.value} value={r.value}>
                    {r.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-ink-600">Details (optional)</label>
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                rows={3}
                maxLength={1000}
                className="input"
                placeholder="Anything that helps us review this faster…"
              />
            </div>
            {error && <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
            <button disabled={busy} className="btn-primary w-full py-2.5 text-sm">
              Submit report
            </button>
          </form>
        )}
      </div>
    </div>
  );
}

// What a buyer sees when a listing isn't ACTIVE — SOLD gets its own clear
// message rather than being lumped in with paused/expired/removed.
const UNAVAILABLE_INFO: Record<Exclude<ClassifiedStatus, "ACTIVE">, { icon: typeof AlertTriangle; title: string; detail: string; tint: string }> = {
  SOLD: {
    icon: CheckCircle2,
    title: "This item has been sold",
    detail: "The seller has marked this item as sold. It's no longer available.",
    tint: "bg-gray-900 text-white",
  },
  PAUSED: {
    icon: PauseCircle,
    title: "Listing paused",
    detail: "The seller has temporarily paused this listing.",
    tint: "bg-amber-50 text-amber-700",
  },
  EXPIRED: {
    icon: Clock,
    title: "Listing expired",
    detail: "This listing is no longer active.",
    tint: "bg-gray-100 text-gray-600",
  },
  REMOVED: {
    icon: ShieldOff,
    title: "Listing unavailable",
    detail: "This listing is no longer available.",
    tint: "bg-red-50 text-red-700",
  },
};

export default function ClassifiedDetail() {
  const { id = "" } = useParams();
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);

  const [listing, setListing] = useState<ClassifiedListing | null>(null);
  const [activePhoto, setActivePhoto] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [phoneShown, setPhoneShown] = useState(false);
  const [favorited, setFavorited] = useState(false);
  const [busy, setBusy] = useState(false);
  const [showMessageBox, setShowMessageBox] = useState(false);
  const [messageDraft, setMessageDraft] = useState("");
  const [messageSending, setMessageSending] = useState(false);
  const [messageError, setMessageError] = useState("");
  const [showReportModal, setShowReportModal] = useState(false);

  useEffect(() => {
    setLoading(true);
    setActivePhoto(0);
    classifiedsApi
      .get(id)
      .then((l) => {
        setListing(l);
        rememberRecentlyViewedClassified(l.id);
      })
      .catch((err) => setError(apiErrorMessage(err)))
      .finally(() => setLoading(false));
  }, [id]);

  function toggleFavorite() {
    if (!user || !listing) return;
    setBusy(true);
    const action = favorited ? classifiedsApi.unfavorite(listing.id) : classifiedsApi.favorite(listing.id);
    action.then(() => setFavorited((v) => !v)).finally(() => setBusy(false));
  }

  async function sendMessage(e: React.FormEvent) {
    e.preventDefault();
    if (!listing || !messageDraft.trim() || messageSending) return;
    setMessageSending(true);
    setMessageError("");
    try {
      const conversation = await classifiedMessagesApi.start(listing.id, messageDraft.trim());
      navigate(`/messages/${conversation.id}`);
    } catch (err) {
      setMessageError(apiErrorMessage(err));
    } finally {
      setMessageSending(false);
    }
  }

  if (loading) return <Spinner label="Loading listing…" />;
  if (error || !listing) {
    return <div className="card p-8 text-center text-sm text-red-700">{error || "Listing not found"}</div>;
  }

  const isOwner = user?.id === listing.sellerId;
  const photos = listing.photos ?? [];
  const whatsappUrl = listing.whatsappEnabled && listing.whatsappNumber
    ? `https://wa.me/${listing.whatsappNumber.replace(/[^0-9]/g, "")}?text=${encodeURIComponent(`Hi, is "${listing.title}" still available?`)}`
    : null;

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
      <div className="lg:col-span-2">
        <div className="card overflow-hidden">
          <div className="relative aspect-square w-full bg-gray-100">
            {photos.length > 0 ? (
              <img
                src={photos[activePhoto]?.url}
                alt={listing.title}
                className={`h-full w-full object-cover ${listing.status === "SOLD" ? "opacity-60 grayscale" : ""}`}
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-gray-300">
                <ImageIcon size={40} />
              </div>
            )}
            {listing.status === "SOLD" && (
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="-rotate-6 rounded-md border-4 border-white bg-gray-900/90 px-6 py-2 text-xl font-extrabold uppercase tracking-widest text-white shadow-lg">
                  Sold
                </span>
              </div>
            )}
          </div>
          {photos.length > 1 && (
            <div className="flex gap-2 overflow-x-auto p-3">
              {photos.map((p, i) => (
                <button
                  key={p.id}
                  onClick={() => setActivePhoto(i)}
                  className={`h-16 w-16 shrink-0 overflow-hidden rounded-lg border-2 ${
                    i === activePhoto ? "border-brand-500" : "border-transparent"
                  }`}
                >
                  <img src={p.url} alt="" className="h-full w-full object-cover" />
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="card mt-4 p-5">
          <h2 className="font-bold text-ink-900 mb-2">Description</h2>
          <p className="whitespace-pre-line text-sm text-ink-700">{listing.description || "No description provided."}</p>
        </div>
      </div>

      <div>
        <div className="card p-5">
          {isOwner && listing.status !== "ACTIVE" && (
            <span className={`badge mb-3 ${UNAVAILABLE_INFO[listing.status].tint}`}>
              {listing.status === "SOLD" && <CheckCircle2 size={11} />} {listing.status}
            </span>
          )}
          <p className="text-2xl font-extrabold text-ink-900">{money(listing.priceCents, listing.currency)}</p>
          <h1 className="mt-1 text-lg font-bold text-ink-900">{listing.title}</h1>

          <div className="mt-2 flex flex-wrap gap-1.5">
            <span className="badge bg-gray-100 text-gray-600">{listing.condition === "NEW" ? "New" : "Used"}</span>
            {listing.category && <span className="badge bg-gray-100 text-gray-600">{listing.category.name}</span>}
          </div>

          <div className="mt-3 space-y-1.5 text-sm text-ink-600">
            <p className="flex items-center gap-1.5">
              <MapPin size={13} className="text-ink-400" /> {listing.city}
              {listing.state ? `, ${listing.state}` : ""}
            </p>
            <p className="flex items-center gap-1.5">
              <Calendar size={13} className="text-ink-400" /> Posted {new Date(listing.createdAt).toLocaleDateString()}
            </p>
            <p className="flex items-center gap-1.5">
              <Eye size={13} className="text-ink-400" /> {listing.viewCount} views · {listing.favoriteCount} saved
            </p>
          </div>

          {!isOwner && listing.status === "ACTIVE" && (
            <div className="mt-4 flex flex-col gap-2">
              <button
                onClick={() => setPhoneShown(true)}
                className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-emerald-700"
              >
                <Phone size={15} /> {phoneShown ? listing.contactPhone : "Show phone number"}
              </button>
              {whatsappUrl && (
                <a
                  href={whatsappUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-emerald-200 bg-white px-4 py-2.5 text-sm font-semibold text-emerald-700 transition-colors hover:bg-emerald-50"
                >
                  <MessageSquare size={15} /> Chat on WhatsApp
                </a>
              )}
              {user && !showMessageBox && (
                <button
                  onClick={() => setShowMessageBox(true)}
                  className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-brand-200 bg-white px-4 py-2.5 text-sm font-semibold text-brand-700 transition-colors hover:bg-brand-50"
                >
                  <MessageCircle size={15} /> Message seller
                </button>
              )}
              {user && showMessageBox && (
                <form onSubmit={sendMessage} className="flex flex-col gap-2 rounded-lg border border-gray-200 p-3">
                  <textarea
                    autoFocus
                    value={messageDraft}
                    onChange={(e) => setMessageDraft(e.target.value)}
                    placeholder={`Hi, is "${listing.title}" still available?`}
                    rows={2}
                    maxLength={2000}
                    className="input text-sm"
                  />
                  {messageError && <p className="text-xs text-red-600">{messageError}</p>}
                  <div className="flex gap-2">
                    <button
                      type="submit"
                      disabled={messageSending || !messageDraft.trim()}
                      className="btn-primary flex-1 py-2 text-sm"
                    >
                      <Send size={14} /> Send
                    </button>
                    <button type="button" onClick={() => setShowMessageBox(false)} className="btn-secondary px-3 py-2 text-sm">
                      Cancel
                    </button>
                  </div>
                </form>
              )}
              {!user && (
                <Link
                  to={`/login?next=/classifieds/${listing.id}`}
                  className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-brand-200 bg-white px-4 py-2.5 text-sm font-semibold text-brand-700 transition-colors hover:bg-brand-50"
                >
                  <MessageCircle size={15} /> Message seller
                </Link>
              )}
              {user && (
                <button
                  onClick={toggleFavorite}
                  disabled={busy}
                  className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm font-semibold text-ink-700 transition-colors hover:bg-gray-50"
                >
                  <Heart size={15} className={favorited ? "fill-red-500 text-red-500" : ""} />
                  {favorited ? "Saved" : "Save"}
                </button>
              )}
              {!user && (
                <Link to={`/login?next=/classifieds/${listing.id}`} className="text-center text-xs text-ink-500 hover:underline">
                  Log in to save this listing
                </Link>
              )}
            </div>
          )}

          {isOwner && (
            <div className="mt-4 flex flex-col gap-2">
              <Link to={`/classifieds/${listing.id}/edit`} className="btn-secondary w-full py-2.5 text-sm">
                <Settings2 size={15} /> Edit listing
              </Link>
              <p className="text-center text-xs text-ink-500">Manage status from your listings dashboard.</p>
              <Link to="/my-listings" className="text-center text-xs font-semibold text-brand-600 hover:underline">
                Go to My Listings
              </Link>
            </div>
          )}

          {!isOwner && listing.status !== "ACTIVE" && (
            <div className={`mt-4 rounded-lg px-3 py-3 text-sm ${UNAVAILABLE_INFO[listing.status].tint}`}>
              <p className="flex items-center gap-1.5 font-semibold">
                {(() => {
                  const Icon = UNAVAILABLE_INFO[listing.status].icon;
                  return <Icon size={16} />;
                })()}
                {UNAVAILABLE_INFO[listing.status].title}
              </p>
              <p className="mt-1 opacity-90">{UNAVAILABLE_INFO[listing.status].detail}</p>
              <Link to="/classifieds" className="mt-2 inline-block font-semibold underline underline-offset-2">
                Browse similar items
              </Link>
            </div>
          )}
        </div>

        {listing.seller && (
          <div className="card mt-4 p-5">
            <h3 className="mb-2 text-sm font-bold text-ink-900">Seller</h3>
            <Link
              to={`/classifieds/sellers/${listing.sellerId}`}
              className="flex items-center gap-2.5 text-sm text-ink-800 hover:text-brand-600"
            >
              <span className="flex h-9 w-9 items-center justify-center rounded-full bg-brand-100 text-brand-700">
                <UserIcon size={16} />
              </span>
              <span>
                <span className="block font-semibold">{listing.seller.firstName} {listing.seller.lastName}</span>
                <span className="block text-xs text-ink-500">
                  Member since {new Date(listing.seller.createdAt).getFullYear()}
                </span>
              </span>
            </Link>
            <Link to={`/classifieds/sellers/${listing.sellerId}`} className="mt-3 block text-center text-xs font-semibold text-brand-600 hover:underline">
              View seller's other listings
            </Link>
          </div>
        )}

        {!isOwner && (
          <button
            onClick={() => (user ? setShowReportModal(true) : navigate(`/login?next=/classifieds/${listing.id}`))}
            className="mt-3 flex w-full items-center justify-center gap-1.5 text-xs text-ink-400 hover:text-red-600"
          >
            <Flag size={12} /> Report this listing
          </button>
        )}
      </div>

      {showReportModal && <ReportModal listingId={listing.id} onClose={() => setShowReportModal(false)} />}
    </div>
  );
}
