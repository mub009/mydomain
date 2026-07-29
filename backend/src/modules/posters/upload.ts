import { AppError } from "@/common/errors";
import { sanitizeSvg, svgDimensions, svgSlots, svgToDataUri } from "./svgTemplate";
import { imageDimensions } from "./imageSize";

/**
 * Artwork uploaded through the admin panel.
 *
 * This project has no object storage, so the file is kept inline as a data
 * URI on the design row. That is also what the renderer wants: the poster it
 * produces has to be self-contained for the browser to export a PNG from it.
 */

export const MAX_ARTWORK_BYTES = 4 * 1024 * 1024;

/**
 * The first bytes of the formats we accept. The declared mimetype comes from
 * the browser and is trivially wrong or forged, so the bytes are what decide.
 *
 * SVG has no signature to match — it is XML, not a container with a magic
 * number — so it is handled separately, and only after being parsed and
 * stripped of everything executable. It is worth the trouble because an SVG
 * template's slots can be filled exactly; see `svgTemplate.ts`.
 */
const SIGNATURES: { type: string; matches(buffer: Buffer): boolean }[] = [
  { type: "image/png", matches: (b) => b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) },
  { type: "image/jpeg", matches: (b) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff },
  { type: "image/gif", matches: (b) => b.subarray(0, 6).toString("ascii") === "GIF87a" || b.subarray(0, 6).toString("ascii") === "GIF89a" },
  {
    type: "image/webp",
    matches: (b) => b.subarray(0, 4).toString("ascii") === "RIFF" && b.subarray(8, 12).toString("ascii") === "WEBP",
  },
];

export interface UploadedArtwork {
  dataUrl: string;
  type: string;
  bytes: number;
  /** The drawing's own size, which becomes the poster's shape. */
  dimensions: { width: number; height: number } | null;
  /** For an SVG template: the slots found, and what was stripped out of it. */
  slots?: string[];
  /** Slots nothing will fill. Blanked on the poster, so this is the only
   *  chance to notice a misspelled one. */
  unknownSlots?: string[];
  removed?: string[];
}

/** Validates an uploaded file and returns it as a data URI. */
export function readUploadedImage(file: { buffer: Buffer; originalname?: string } | undefined): UploadedArtwork {
  if (!file || file.buffer.byteLength === 0) throw AppError.badRequest("No file was uploaded");
  if (file.buffer.byteLength > MAX_ARTWORK_BYTES) {
    throw AppError.badRequest(`That file is larger than ${Math.round(MAX_ARTWORK_BYTES / 1024 / 1024)}MB`);
  }

  const signature = SIGNATURES.find((candidate) => candidate.matches(file.buffer));
  if (signature) {
    return {
      dataUrl: `data:${signature.type};base64,${file.buffer.toString("base64")}`,
      type: signature.type,
      bytes: file.buffer.byteLength,
      dimensions: imageDimensions(file.buffer),
    };
  }

  if (looksLikeSvg(file.buffer)) return readUploadedSvg(file.buffer);

  throw AppError.badRequest("That file is not an SVG, PNG, JPEG, WebP or GIF image");
}

/**
 * XML has no magic number, so this is a sniff, not a signature — but it only
 * decides which validator runs. An impostor gets as far as the SVG parser and
 * no further, and the parser is the thing that actually judges the file.
 */
function looksLikeSvg(buffer: Buffer): boolean {
  const head = buffer.subarray(0, 1024).toString("utf8").trimStart();
  return head.startsWith("<") && /<svg[\s>]/i.test(buffer.subarray(0, 4096).toString("utf8"));
}

function readUploadedSvg(buffer: Buffer): UploadedArtwork {
  const { svg, removed } = sanitizeSvg(buffer.toString("utf8"));
  const slots = svgSlots(svg);
  return {
    dataUrl: svgToDataUri(svg),
    type: "image/svg+xml",
    bytes: Buffer.byteLength(svg, "utf8"),
    dimensions: svgDimensions(svg),
    slots: slots.known,
    unknownSlots: slots.unknown,
    // Named rather than dropped quietly: an admin whose file lost something
    // should hear it from us, not find out from the poster.
    removed,
  };
}
