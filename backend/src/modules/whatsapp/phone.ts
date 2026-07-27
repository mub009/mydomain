/**
 * Phone handling for WhatsApp. Numbers arrive from spreadsheets typed by hand,
 * so they show up as "+91 98765 43210", "098765 43210", "9876543210" or with
 * a stray apostrophe Excel added. All of those are the same person.
 */

// The platform is India-first, so a bare 10-digit number means +91.
const DEFAULT_COUNTRY_CODE = "91";

export interface NormalizedPhone {
  /** Digits only, including country code: "919876543210". */
  phone: string;
  ok: boolean;
  reason?: string;
}

export function normalizePhone(raw: string, countryCode = DEFAULT_COUNTRY_CODE): NormalizedPhone {
  const trimmed = String(raw ?? "").trim();
  if (!trimmed) return { phone: "", ok: false, reason: "No phone number" };

  // Keep a leading + so we can tell "already international" from "local".
  const hadPlus = trimmed.startsWith("+") || trimmed.startsWith("00");
  let digits = trimmed.replace(/[^0-9]/g, "");
  if (trimmed.startsWith("00")) digits = digits.slice(2);

  if (!digits) return { phone: "", ok: false, reason: "No digits in the phone number" };

  // A single leading zero is the domestic trunk prefix, not part of the number.
  if (!hadPlus && digits.startsWith("0")) digits = digits.replace(/^0+/, "");

  if (!hadPlus && digits.length === 10) digits = `${countryCode}${digits}`;

  if (digits.length < 10) return { phone: digits, ok: false, reason: "Too short to be a phone number" };
  if (digits.length > 15) return { phone: digits, ok: false, reason: "Too long to be a phone number" };

  return { phone: digits, ok: true };
}

/** Display form for the dashboard: "+91 98765 43210". */
export function formatPhone(phone: string): string {
  if (phone.length === 12 && phone.startsWith("91")) {
    return `+91 ${phone.slice(2, 7)} ${phone.slice(7)}`;
  }
  return `+${phone}`;
}

/** The address whatsapp-web.js expects for an individual chat. */
export function toWhatsappId(phone: string): string {
  return `${phone}@c.us`;
}
