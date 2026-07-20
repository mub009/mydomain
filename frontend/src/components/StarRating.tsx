export default function StarRating({ rating, count }: { rating: number; count?: number }) {
  return (
    <span className="inline-flex items-center gap-1 text-sm">
      <span className="text-amber-500">{"★".repeat(Math.round(rating)) + "☆".repeat(5 - Math.round(rating))}</span>
      <span className="text-gray-500">
        {rating.toFixed(1)}
        {count !== undefined ? ` (${count})` : ""}
      </span>
    </span>
  );
}
