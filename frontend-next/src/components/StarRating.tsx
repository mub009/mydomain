import { Star } from "lucide-react";

function ratingColor(rating: number): string {
  if (rating >= 4) return "bg-emerald-600";
  if (rating >= 3) return "bg-amber-500";
  if (rating > 0) return "bg-red-500";
  return "bg-gray-400";
}

export default function StarRating({
  rating,
  count,
  size = "md",
}: {
  rating: number;
  count?: number;
  size?: "sm" | "md";
}) {
  const badgePad = size === "sm" ? "px-1.5 py-0.5 text-[11px]" : "px-2 py-1 text-xs";
  const iconSize = size === "sm" ? 11 : 13;

  return (
    <span className="inline-flex items-center gap-1.5">
      <span className={`badge text-white ${badgePad} ${ratingColor(rating)}`}>
        {rating.toFixed(1)}
        <Star size={iconSize} fill="currentColor" strokeWidth={0} />
      </span>
      {count !== undefined && <span className="text-xs text-ink-500">({count})</span>}
    </span>
  );
}

export function StarRow({ rating, size = 16 }: { rating: number; size?: number }) {
  return (
    <span className="inline-flex items-center gap-0.5 text-gold-400">
      {Array.from({ length: 5 }).map((_, i) => (
        <Star
          key={i}
          size={size}
          fill={i < Math.round(rating) ? "currentColor" : "none"}
          strokeWidth={i < Math.round(rating) ? 0 : 1.5}
          className={i < Math.round(rating) ? "text-gold-400" : "text-gray-300"}
        />
      ))}
    </span>
  );
}
