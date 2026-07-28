/**
 * Reading a poster's own colours out of the uploaded file.
 *
 * The header and footer strips have to belong to the artwork, not to a palette
 * the admin happened to pick beside it — a red bar across a gold-and-red
 * design reads as something pasted on afterwards. So the editor samples the
 * image's top and bottom edges and uses what it finds.
 *
 * This runs in the browser, where the file already is: the server has no image
 * decoder, and shipping one to average a few thousand pixels would be a poor
 * trade.
 */

export interface BandColors {
  /** Fill for the strips, sampled from the edge they sit on. */
  band: string;
  /** Black or white, whichever stays readable on `band`. */
  text: string;
}

function toHex(r: number, g: number, b: number): string {
  return `#${[r, g, b].map((v) => Math.round(v).toString(16).padStart(2, "0")).join("")}`;
}

/**
 * Perceived brightness, weighted the way the eye actually responds — green
 * carries most of it, blue almost none. Deciding black-or-white from a plain
 * RGB average puts white text on yellow.
 */
export function luminance(r: number, g: number, b: number): number {
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255;
}

export function readableInkFor(hex: string): string {
  const value = hex.replace("#", "");
  const full = value.length === 3 ? value.split("").map((c) => c + c).join("") : value;
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(full.slice(i, i + 2), 16));
  return luminance(r, g, b) > 0.6 ? "#111111" : "#ffffff";
}

/**
 * Averages the bottom strip of the image — the band sits there, so that is the
 * colour it has to agree with. Darkened slightly, because type on a band
 * needs a little more contrast than the artwork behind it happens to have.
 */
export async function sampleBandColors(dataUrl: string): Promise<BandColors> {
  const image = new Image();
  await new Promise<void>((resolve, reject) => {
    image.onload = () => resolve();
    image.onerror = () => reject(new Error("That image could not be read"));
    image.src = dataUrl;
  });

  // A small canvas is plenty for an average and keeps a 4MB poster cheap.
  const width = 64;
  const height = Math.max(1, Math.round((image.height / image.width) * width));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;

  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) throw new Error("This browser cannot sample the image");
  context.drawImage(image, 0, 0, width, height);

  const strip = Math.max(1, Math.round(height * 0.12));
  const { data } = context.getImageData(0, height - strip, width, strip);

  let r = 0;
  let g = 0;
  let b = 0;
  const pixels = data.length / 4;
  for (let i = 0; i < data.length; i += 4) {
    r += data[i];
    g += data[i + 1];
    b += data[i + 2];
  }
  r /= pixels;
  g /= pixels;
  b /= pixels;

  // Push away from mid-grey so the strip reads as a deliberate panel rather
  // than a smudge of the artwork.
  const shift = luminance(r, g, b) > 0.5 ? 1.12 : 0.72;
  const band = toHex(
    Math.min(255, Math.max(0, r * shift)),
    Math.min(255, Math.max(0, g * shift)),
    Math.min(255, Math.max(0, b * shift)),
  );

  return { band, text: readableInkFor(band) };
}
