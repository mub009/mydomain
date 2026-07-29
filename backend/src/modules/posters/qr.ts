import QRCode from "qrcode";
import { logger } from "@/config/logger";
import { markkitoLink } from "@/modules/reviewqr/reviewqr.service";

/**
 * The QR printed on a shop's poster. It points at that shop's own Markkito
 * page, which is the same destination the printed review boards use — so the
 * link lives in one place (`markkitoLink`) rather than being rebuilt here and
 * drifting when the URL shape changes.
 *
 * Rendered to a data URI for the same reason the logo is: the poster has to be
 * self-contained for the browser to export a PNG from it.
 */

const CACHE_TTL_MS = 10 * 60 * 1000;
const cache = new Map<string, { href: string; at: number }>();

/** Bigger than it needs to be on screen, so it survives being printed. */
const PIXELS = 640;

export async function businessQrDataUrl(slug: string | null | undefined): Promise<string | null> {
  const url = markkitoLink({ slug: slug ?? null });
  if (!url) return null;

  const cached = cache.get(url);
  if (cached && Date.now() - cached.at < CACHE_TTL_MS) return cached.href;

  try {
    const href = await QRCode.toDataURL(url, {
      margin: 1,
      width: PIXELS,
      // A poster's QR can end up behind a shop window or printed small, and
      // the code may sit on busy artwork; "M" survives more damage than the
      // default "L" at a modest cost in density.
      errorCorrectionLevel: "M",
      color: { dark: "#000000ff", light: "#ffffffff" },
    });
    cache.set(url, { href, at: Date.now() });
    return href;
  } catch (err) {
    // A poster without its QR is still a poster; a failed render is not.
    logger.warn({ err, url }, "Poster QR could not be generated");
    return null;
  }
}

/** Test seam — the cache would otherwise leak between cases. */
export function clearQrCache(): void {
  cache.clear();
}
