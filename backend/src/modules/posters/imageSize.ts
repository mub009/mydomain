/**
 * The pixel dimensions of an uploaded image, read from its header.
 *
 * A poster is built around a designer's finished artwork, so the *artwork*
 * decides the shape of the page. Forcing it into one of three fixed frames
 * crops whatever does not fit — and what a designer puts at the edges is
 * exactly the part a shop notices missing.
 *
 * Only the header is needed, so there is no decoding and no image library:
 * each format states its own size within the first few dozen bytes (JPEG is
 * the exception and needs its segments walked).
 */

export interface ImageDimensions {
  width: number;
  height: number;
}

function png(buffer: Buffer): ImageDimensions | null {
  // 8-byte signature, then an IHDR chunk whose width and height are the first
  // two big-endian 32-bit fields of its payload.
  if (buffer.length < 24) return null;
  if (buffer.toString("ascii", 12, 16) !== "IHDR") return null;
  return { width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20) };
}

function gif(buffer: Buffer): ImageDimensions | null {
  if (buffer.length < 10) return null;
  return { width: buffer.readUInt16LE(6), height: buffer.readUInt16LE(8) };
}

function webp(buffer: Buffer): ImageDimensions | null {
  if (buffer.length < 30) return null;
  const format = buffer.toString("ascii", 12, 16);

  // Lossy: a 14-bit width and height after the VP8 start code.
  if (format === "VP8 ") {
    return { width: buffer.readUInt16LE(26) & 0x3fff, height: buffer.readUInt16LE(28) & 0x3fff };
  }
  // Lossless: 14 bits each, packed across four bytes, both minus one.
  if (format === "VP8L") {
    const bits = buffer.readUInt32LE(21);
    return { width: (bits & 0x3fff) + 1, height: ((bits >> 14) & 0x3fff) + 1 };
  }
  // Extended: 24-bit dimensions, both minus one.
  if (format === "VP8X") {
    const at = (offset: number) => buffer[offset] | (buffer[offset + 1] << 8) | (buffer[offset + 2] << 16);
    return { width: at(24) + 1, height: at(27) + 1 };
  }
  return null;
}

/**
 * JPEG keeps its size in a start-of-frame segment, which sits after however
 * many metadata segments the exporting program felt like writing — so the
 * segment chain has to be walked rather than indexed into.
 */
function jpeg(buffer: Buffer): ImageDimensions | null {
  let offset = 2;
  while (offset + 9 < buffer.length) {
    if (buffer[offset] !== 0xff) {
      offset += 1; // Resync past padding rather than giving up.
      continue;
    }
    const marker = buffer[offset + 1];
    // Every SOFn carries the dimensions except the four that are not frames.
    const isFrame = marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc, 0xd8].includes(marker);
    if (isFrame) return { width: buffer.readUInt16BE(offset + 7), height: buffer.readUInt16BE(offset + 5) };
    if (marker === 0xd9 || marker === 0xda) return null; // End of image, or entropy-coded data.
    const length = buffer.readUInt16BE(offset + 2);
    if (length < 2) return null;
    offset += 2 + length;
  }
  return null;
}

/** Dimensions, or null when the bytes are not an image this can measure. */
export function imageDimensions(buffer: Buffer): ImageDimensions | null {
  if (buffer.length < 10) return null;

  let found: ImageDimensions | null = null;
  if (buffer.toString("hex", 0, 8) === "89504e470d0a1a0a") found = png(buffer);
  else if (buffer[0] === 0xff && buffer[1] === 0xd8) found = jpeg(buffer);
  else if (buffer.toString("ascii", 0, 3) === "GIF") found = gif(buffer);
  else if (buffer.toString("ascii", 0, 4) === "RIFF" && buffer.toString("ascii", 8, 12) === "WEBP")
    found = webp(buffer);

  // A header can be truncated or lying; a zero or absurd size would produce an
  // unusable canvas, so it is treated as unknown and the caller falls back.
  if (!found || found.width < 1 || found.height < 1) return null;
  if (found.width > 20000 || found.height > 20000) return null;
  return found;
}

/** The same, for the data URIs designs are stored as. */
export function dataUriDimensions(dataUri: string | null): ImageDimensions | null {
  if (!dataUri?.startsWith("data:image/")) return null;
  const comma = dataUri.indexOf(",");
  if (comma < 0 || !dataUri.slice(0, comma).includes(";base64")) return null;
  // The header is at the front, so a slice of the payload is enough — decoding
  // several megabytes of base64 to read eight bytes would be wasteful. Base64
  // is 4 characters per 3 bytes, and the slice is trimmed to a whole group so
  // the decode does not end mid-character.
  const head = dataUri.slice(comma + 1, comma + 1 + 96_000);
  return imageDimensions(Buffer.from(head.slice(0, head.length - (head.length % 4)), "base64"));
}
