import { useState } from "react";
import { Link } from "react-router-dom";
import { Heart, ImageIcon, MapPin } from "lucide-react";
import { ClassifiedListing } from "@/types";

export function money(cents: number, currency = "INR"): string {
  const symbol = currency === "INR" ? "₹" : "";
  return `${symbol}${(cents / 100).toLocaleString("en-IN")}`;
}

const STATUS_TINT: Record<string, string> = {
  ACTIVE: "bg-emerald-50 text-emerald-700",
  SOLD: "bg-gray-800 text-white",
  PAUSED: "bg-amber-50 text-amber-700",
  EXPIRED: "bg-gray-100 text-gray-500",
  REMOVED: "bg-red-50 text-red-700",
};

export default function ClassifiedCard({
  listing,
  favorited,
  onToggleFavorite,
  showStatus,
}: {
  listing: ClassifiedListing;
  favorited?: boolean;
  onToggleFavorite?: (listing: ClassifiedListing) => void;
  showStatus?: boolean;
}) {
  const [imgFailed, setImgFailed] = useState(false);
  const photo = listing.photos?.[0]?.url;

  return (
    <div className="card group overflow-hidden flex flex-col">
      <Link to={`/classifieds/${listing.id}`} className="relative block aspect-square w-full overflow-hidden bg-gray-100">
        {photo && !imgFailed ? (
          <img
            src={photo}
            alt={listing.title}
            loading="lazy"
            onError={() => setImgFailed(true)}
            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-gray-300">
            <ImageIcon size={28} />
          </div>
        )}
        {listing.status !== "ACTIVE" && listing.status === "SOLD" && (
          <span className="absolute left-2 top-2 rounded bg-gray-900/85 px-2 py-0.5 text-[11px] font-bold text-white">SOLD</span>
        )}
        {showStatus && listing.status !== "ACTIVE" && listing.status !== "SOLD" && (
          <span className={`absolute left-2 top-2 badge ${STATUS_TINT[listing.status] ?? "bg-gray-100 text-gray-600"}`}>
            {listing.status}
          </span>
        )}
        {onToggleFavorite && (
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              onToggleFavorite(listing);
            }}
            aria-label={favorited ? "Remove from favorites" : "Save to favorites"}
            className="absolute right-2 top-2 flex h-8 w-8 items-center justify-center rounded-full bg-white/90 text-ink-500 shadow-sm transition-colors hover:text-red-500"
          >
            <Heart size={15} className={favorited ? "fill-red-500 text-red-500" : ""} />
          </button>
        )}
      </Link>
      <Link to={`/classifieds/${listing.id}`} className="flex flex-1 flex-col p-3">
        <p className="text-base font-extrabold text-ink-900">{money(listing.priceCents, listing.currency)}</p>
        <p className="mt-0.5 line-clamp-2 text-sm text-ink-700">{listing.title}</p>
        <p className="mt-auto flex items-center gap-1 pt-1.5 text-xs text-ink-500">
          <MapPin size={11} className="shrink-0 text-ink-400" />
          <span className="truncate">{listing.city}</span>
          {listing.distanceKm != null && <span className="shrink-0 text-ink-400">· {listing.distanceKm.toFixed(1)} km</span>}
        </p>
        <span className="mt-1 badge w-fit bg-gray-100 text-gray-600">{listing.condition === "NEW" ? "New" : "Used"}</span>
      </Link>
    </div>
  );
}
