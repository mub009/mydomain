import QRCode from "qrcode";

// Review/contact destinations a QR board can send a scan to.

// The two Markkito destinations are built from the listing's slug, so they
// work the moment a business exists — nothing for the shop to set up first.
export const MARKKITO_CHANNELS = ["MARKKITO_REVIEW", "MARKKITO"];

// Destination options offered in the QR "purpose" dropdowns.
export const REVIEW_CHANNELS = [
  { value: "GOOGLE", label: "Google review" },
  { value: "INSTAGRAM", label: "Instagram" },
  { value: "FACEBOOK", label: "Facebook" },
  { value: "YOUTUBE", label: "YouTube" },
  { value: "WEBSITE", label: "Website" },
  { value: "DIRECTIONS", label: "Directions to shop" },
  { value: "MARKKITO_REVIEW", label: "Markkito review" },
  { value: "MARKKITO", label: "Markkito business page" },
];

export const CHANNEL_LABELS = Object.fromEntries(REVIEW_CHANNELS.map((c) => [c.value, c.label]));

// A printed board encodes this short URL. The server resolves it to the
// shop's own link for the board's platform and records the scan.
export function boardUrl(code) {
  return `${window.location.origin}/r/q/${code}`;
}

// High error correction so a scuffed or partly covered board still scans.
export function renderQrDataUrl(text, width = 512) {
  return QRCode.toDataURL(text, {
    errorCorrectionLevel: "H",
    margin: 1,
    width,
    color: { dark: "#0f172a", light: "#ffffff" },
  });
}

// Board wording follows its purpose, so a customer knows what they'll get.
export function boardHeadline(channel) {
  if (!channel || channel === "GOOGLE") return "Scan to review us";
  if (channel === "WEBSITE") return "Scan to visit our website";
  if (channel === "DIRECTIONS") return "Scan for directions to our shop";
  return `Scan to find us on ${CHANNEL_LABELS[channel]}`;
}

export function downloadDataUrl(dataUrl, filename) {
  const link = document.createElement("a");
  link.href = dataUrl;
  link.download = filename;
  link.click();
}

export function channelOptions(selected = "", { emptyLabel = "My default channel" } = {}) {
  return `<option value="">${emptyLabel}</option>${REVIEW_CHANNELS.map(
    (c) => `<option value="${c.value}" ${c.value === selected ? "selected" : ""}>${c.label}</option>`,
  ).join("")}`;
}
