import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";

// Real <a href> pagination (not client-side state) so Google can crawl from
// page to page — the whole point of the SEO-facing pages in this app.
export default function PageLinks({
  page,
  totalPages,
  basePath,
  params = {},
}: {
  page: number;
  totalPages: number;
  basePath: string;
  params?: Record<string, string | undefined>;
}) {
  if (totalPages <= 1) return null;

  function hrefFor(p: number): string {
    const usp = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) {
      if (v) usp.set(k, v);
    }
    usp.set("page", String(p));
    return `${basePath}?${usp.toString()}`;
  }

  const pages: (number | "…")[] = [];
  for (let p = 1; p <= totalPages; p++) {
    if (p === 1 || p === totalPages || Math.abs(p - page) <= 1) {
      pages.push(p);
    } else if (pages[pages.length - 1] !== "…") {
      pages.push("…");
    }
  }

  return (
    <nav className="flex items-center justify-center gap-1 mt-4" aria-label="Pagination">
      {page > 1 ? (
        <Link href={hrefFor(page - 1)} className="btn-secondary px-2.5 py-1.5 text-sm" aria-label="Previous page">
          <ChevronLeft size={15} />
        </Link>
      ) : (
        <span className="btn-secondary px-2.5 py-1.5 text-sm opacity-40 cursor-not-allowed">
          <ChevronLeft size={15} />
        </span>
      )}
      {pages.map((p, i) =>
        p === "…" ? (
          <span key={`gap-${i}`} className="px-1.5 text-sm text-ink-400">
            …
          </span>
        ) : (
          <Link
            key={p}
            href={hrefFor(p)}
            className={`min-w-[34px] text-center rounded-lg px-2.5 py-1.5 text-sm font-semibold transition-colors ${
              p === page ? "bg-brand-600 text-white" : "text-ink-600 hover:bg-brand-50 hover:text-brand-700"
            }`}
          >
            {p}
          </Link>
        ),
      )}
      {page < totalPages ? (
        <Link href={hrefFor(page + 1)} className="btn-secondary px-2.5 py-1.5 text-sm" aria-label="Next page">
          <ChevronRight size={15} />
        </Link>
      ) : (
        <span className="btn-secondary px-2.5 py-1.5 text-sm opacity-40 cursor-not-allowed">
          <ChevronRight size={15} />
        </span>
      )}
    </nav>
  );
}
