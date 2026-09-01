import Link from "next/link";
import { MapPin, ShieldCheck } from "lucide-react";
import StarRating from "./StarRating";
import type { Business } from "@/lib/types";

export default function BusinessCard({ b }: { b: Business }) {
  return (
    <Link
      href={`/business/${b.slug}`}
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
      <h3 className="font-bold text-base text-ink-900 group-hover:text-brand-600 transition-colors">{b.name}</h3>
      <p className="text-sm text-ink-500 mb-3 flex items-center gap-1">
        <MapPin size={13} />
        {b.city}, {b.state}
        {b.distanceKm != null && <span className="text-ink-400">· {b.distanceKm.toFixed(1)} km away</span>}
      </p>
      <StarRating rating={b.avgRating} count={b.reviewCount} />
    </Link>
  );
}
