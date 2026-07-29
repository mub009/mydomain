/**
 * Saving a rendered poster.
 *
 * The server sends an SVG document that references nothing external — the
 * shop's logo is already a data URI. That matters twice over: the file works
 * anywhere it is re-shared, and the browser will let us draw it onto a canvas
 * and export a PNG. A poster that linked to the logo would taint the canvas
 * and `toBlob` would throw a security error instead of producing a file.
 */

function saveBlob(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  // Revoked on the next tick so the click has definitely been handled.
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

export function downloadSvg(svg: string, fileName: string): void {
  saveBlob(new Blob([svg], { type: "image/svg+xml;charset=utf-8" }), fileName);
}

/** Data URI for an `<img src>`, so a preview needs no object-URL bookkeeping. */
export function svgToDataUrl(svg: string): string {
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

export async function downloadPng(svg: string, width: number, height: number, fileName: string): Promise<void> {
  return rasterise(svgToDataUrl(svg), width, height, fileName);
}

/** True for the local engine's output, false for a PNG from an image model. */
export function isSvgDataUrl(dataUri: string): boolean {
  return dataUri.startsWith("data:image/svg+xml");
}

function decodeDataUri(dataUri: string): Blob {
  const [header, body] = dataUri.split(",");
  const type = header.slice(5).split(";")[0] || "application/octet-stream";
  if (!header.includes(";base64")) return new Blob([decodeURIComponent(body)], { type });

  const binary = atob(body);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return new Blob([bytes], { type });
}

/**
 * Saves a generated poster. Which engine made it decides the work: a PNG from
 * an image model is already the file the shop wants and is written straight
 * out, while the local engine's SVG is drawn to a canvas first. Either way the
 * button says PNG and a PNG is what lands in their downloads.
 */
export async function downloadGeneratedPng(
  dataUri: string,
  width: number,
  height: number,
  fileName: string,
): Promise<void> {
  if (!isSvgDataUrl(dataUri)) {
    saveBlob(decodeDataUri(dataUri), fileName.replace(/\.svg$/, ".png"));
    return;
  }
  return rasterise(dataUri, width, height, fileName);
}

/** The vector original, for a printer. Only the local engine produces one. */
export function downloadGeneratedSvg(dataUri: string, fileName: string): void {
  saveBlob(decodeDataUri(dataUri), fileName.replace(/\.png$/, ".svg"));
}

async function rasterise(src: string, width: number, height: number, fileName: string): Promise<void> {
  const image = new Image();
  image.decoding = "sync";

  await new Promise<void>((resolve, reject) => {
    image.onload = () => resolve();
    image.onerror = () => reject(new Error("The poster image could not be rendered"));
    image.src = src;
  });

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("This browser cannot export a PNG");
  context.drawImage(image, 0, 0, width, height);

  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"));
  if (!blob) throw new Error("The poster could not be converted to PNG");
  saveBlob(blob, fileName.replace(/\.svg$/, ".png"));
}
