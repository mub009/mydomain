import { Loader2 } from "lucide-react";

// Placeholder rows shaped like list items, shown while a list is fetching so
// pages never flash an empty "no results" state before data arrives.
export function ListSkeleton({ rows = 4, className = "" }: { rows?: number; className?: string }) {
  return (
    <div className={`card divide-y divide-gray-100 ${className}`} aria-busy="true" aria-live="polite">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="p-4 flex items-center gap-3">
          <div className="h-9 w-9 shrink-0 rounded-full bg-gray-200 animate-pulse" />
          <div className="flex-1 space-y-2">
            <div className="h-3.5 w-1/3 rounded bg-gray-200 animate-pulse" />
            <div className="h-3 w-1/2 rounded bg-gray-100 animate-pulse" />
          </div>
          <div className="h-7 w-20 rounded-lg bg-gray-200 animate-pulse" />
        </div>
      ))}
      <span className="sr-only">Loading…</span>
    </div>
  );
}

// Card-grid variant for tiled layouts (listings, search results).
export function CardSkeleton({ count = 4, className = "" }: { count?: number; className?: string }) {
  return (
    <div className={className} aria-busy="true" aria-live="polite">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="card p-4 space-y-3">
          <div className="h-4 w-2/3 rounded bg-gray-200 animate-pulse" />
          <div className="h-3 w-1/2 rounded bg-gray-100 animate-pulse" />
          <div className="h-8 w-full rounded-lg bg-gray-100 animate-pulse" />
        </div>
      ))}
      <span className="sr-only">Loading…</span>
    </div>
  );
}

// Inline spinner for smaller regions and tables.
export function Spinner({ label = "Loading…", className = "" }: { label?: string; className?: string }) {
  return (
    <div className={`flex items-center justify-center gap-2 py-8 text-sm text-ink-500 ${className}`} aria-live="polite">
      <Loader2 size={16} className="animate-spin" />
      {label}
    </div>
  );
}
