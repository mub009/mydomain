import { logger } from "@/config/logger";

/**
 * Posters embed the shop's logo rather than linking to it.
 *
 * Two reasons. A poster is downloaded and re-shared, so a linked image would
 * break the moment the host went away; and the browser refuses to export a
 * canvas that has drawn a cross-origin image, which is exactly how the
 * frontend turns the SVG into a PNG. Inlining makes the file self-contained
 * and the export legal.
 */

const ALLOWED_TYPES = new Set(["image/png", "image/jpeg", "image/webp", "image/gif", "image/svg+xml"]);
const MAX_BYTES = 3 * 1024 * 1024;
const TIMEOUT_MS = 6000;
const CACHE_TTL_MS = 10 * 60 * 1000;

interface CacheEntry {
  href: string | null;
  at: number;
}

// One design rendered for a hundred shops would otherwise refetch the same
// background a hundred times.
const cache = new Map<string, CacheEntry>();

/** Only http(s) — a `data:` or `file:` URL in a listing field must not be
 *  followed, and a relative one has no meaning server-side. */
function isFetchable(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

/**
 * Downloads an image and returns it as a data URI, or null when it cannot be
 * used. Failure is never fatal: the layouts fall back to a monogram or a plain
 * gradient, so a shop with a dead logo URL still gets a poster.
 */
export async function inlineImage(url: string | null | undefined): Promise<string | null> {
  if (!url) return null;

  // Artwork uploaded through the admin panel is stored as a data URI already.
  // It was validated on the way in (see `readUploadedImage`), so it is used
  // as-is rather than being re-parsed here — but only for raster types: an
  // `image/svg+xml` data URI would be a document, not a picture, and it is
  // about to be embedded in a document we serve.
  if (url.startsWith("data:")) {
    return /^data:image\/(png|jpeg|webp|gif);base64,/i.test(url) ? url : null;
  }

  if (!isFetchable(url)) return null;

  const cached = cache.get(url);
  if (cached && Date.now() - cached.at < CACHE_TTL_MS) return cached.href;

  const remember = (href: string | null): string | null => {
    cache.set(url, { href, at: Date.now() });
    return href;
  };

  try {
    const response = await fetch(url, {
      redirect: "follow",
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!response.ok) return remember(null);

    const type = (response.headers.get("content-type") ?? "").split(";")[0].trim().toLowerCase();
    if (!ALLOWED_TYPES.has(type)) return remember(null);

    const declared = Number(response.headers.get("content-length") ?? 0);
    if (declared > MAX_BYTES) return remember(null);

    const buffer = Buffer.from(await response.arrayBuffer());
    // Servers lie about content-length, so check the bytes actually received.
    if (buffer.byteLength === 0 || buffer.byteLength > MAX_BYTES) return remember(null);

    return remember(`data:${type};base64,${buffer.toString("base64")}`);
  } catch (err) {
    logger.debug({ err, url }, "Poster image could not be inlined");
    return remember(null);
  }
}

/** Test seam — the cache would otherwise leak between cases. */
export function clearImageCache(): void {
  cache.clear();
}
