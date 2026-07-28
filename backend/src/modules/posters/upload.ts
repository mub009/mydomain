import { AppError } from "@/common/errors";

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
 * SVG is deliberately absent. An SVG is a document — it can carry scripts and
 * external references — and this file is about to be embedded in a document
 * the platform serves from its own origin.
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
}

/** Validates an uploaded file and returns it as a data URI. */
export function readUploadedImage(file: { buffer: Buffer; originalname?: string } | undefined): UploadedArtwork {
  if (!file || file.buffer.byteLength === 0) throw AppError.badRequest("No file was uploaded");
  if (file.buffer.byteLength > MAX_ARTWORK_BYTES) {
    throw AppError.badRequest(`That file is larger than ${Math.round(MAX_ARTWORK_BYTES / 1024 / 1024)}MB`);
  }

  const signature = SIGNATURES.find((candidate) => candidate.matches(file.buffer));
  if (!signature) {
    throw AppError.badRequest("That file is not a PNG, JPEG, WebP or GIF image");
  }

  return {
    dataUrl: `data:${signature.type};base64,${file.buffer.toString("base64")}`,
    type: signature.type,
    bytes: file.buffer.byteLength,
  };
}
