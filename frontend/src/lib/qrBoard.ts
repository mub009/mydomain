import QRCode from "qrcode";
import { CHANNEL_LABELS, ReviewChannel } from "@/types";

// A printed board encodes this short URL. The server resolves it to the
// shop's own link for the board's platform and records the scan.
export function boardUrl(code: string): string {
  return `${window.location.origin}/r/q/${code}`;
}

// High error correction so a scuffed or partly covered board still scans.
export function renderQrDataUrl(text: string, width = 512): Promise<string> {
  return QRCode.toDataURL(text, {
    errorCorrectionLevel: "H",
    margin: 1,
    width,
    color: { dark: "#0f172a", light: "#ffffff" },
  });
}

// Board wording follows its purpose, so a customer knows what they'll get.
export function boardHeadline(channel?: ReviewChannel | null): string {
  if (!channel || channel === "GOOGLE") return "Scan to review us";
  if (channel === "WEBSITE") return "Scan to visit our website";
  if (channel === "DIRECTIONS") return "Scan for directions to our shop";
  return `Scan to find us on ${CHANNEL_LABELS[channel]}`;
}

export function downloadDataUrl(dataUrl: string, filename: string): void {
  const link = document.createElement("a");
  link.href = dataUrl;
  link.download = filename;
  link.click();
}
