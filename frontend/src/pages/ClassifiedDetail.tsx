import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
  AlertTriangle,
  Calendar,
  Eye,
  Heart,
  ImageIcon,
  MapPin,
  MessageSquare,
  Phone,
  Settings2,
  User as UserIcon,
} from "lucide-react";
import { classifiedsApi } from "@/api/endpoints";
import { apiErrorMessage } from "@/api/client";
import { ClassifiedListing } from "@/types";
import { useAuthStore } from "@/store/authStore";
import { Spinner } from "@/components/Loading";
import { money } from "@/components/ClassifiedCard";
import { rememberRecentlyViewedClassified } from "@/lib/recentlyViewedClassifieds";

export default function ClassifiedDetail() {
  const { id = "" } = useParams();
  const user = useAuthStore((s) => s.user);

  const [listing, setListing] = useState<ClassifiedListing | null>(null);
  const [activePhoto, setActivePhoto] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [phoneShown, setPhoneShown] = useState(false);
  const [favorited, setFavorited] = useState(false);
  const [busy, setBusy] = useState(false);

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
          <div className="aspect-square w-full bg-gray-100">
            {photos.length > 0 ? (
              <img src={photos[activePhoto]?.url} alt={listing.title} className="h-full w-full object-cover" />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-gray-300">
                <ImageIcon size={40} />
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
            <span className="badge mb-3 bg-amber-50 text-amber-700">{listing.status}</span>
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
            <p className="mt-4 flex items-center gap-1.5 rounded-md bg-gray-50 px-3 py-2 text-sm text-ink-500">
              <AlertTriangle size={14} /> This listing is no longer available.
            </p>
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
      </div>
    </div>
  );
}
