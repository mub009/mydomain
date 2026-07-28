/**
 * A design is written once and rendered for hundreds of shops, so every piece
 * of wording is a template. `{{business}}` becomes the shop's own name,
 * `{{phone}}` its own number, and so on.
 */

export interface PosterSubject {
  name: string;
  phone: string;
  city: string;
  state: string;
  category: string;
  address: string;
  website: string | null;
  email: string | null;
  logoUrl: string | null;
  avgRating: number;
  reviewCount: number;
  slug: string;
}

export interface PlaceholderInfo {
  token: string;
  label: string;
  example: string;
}

/** What the admin can drop into a headline, and what it turns into. Shown as
 *  clickable chips in the poster editor. */
export const PLACEHOLDERS: PlaceholderInfo[] = [
  { token: "business", label: "Business name", example: "Spice Route Kitchen" },
  { token: "phone", label: "Phone number", example: "+91 98765 43210" },
  { token: "city", label: "City", example: "Kozhikode" },
  { token: "category", label: "Category", example: "Restaurants" },
  { token: "address", label: "Street address", example: "12 Beach Road" },
  { token: "website", label: "Website", example: "spiceroute.example" },
  { token: "rating", label: "Average rating", example: "4.6" },
  { token: "reviews", label: "Review count", example: "128" },
];

/** Formats a stored number the way it is printed on a board: +91 98765 43210. */
export function displayPhone(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  if (digits.length === 12 && digits.startsWith("91")) {
    return `+91 ${digits.slice(2, 7)} ${digits.slice(7)}`;
  }
  if (digits.length === 10) return `${digits.slice(0, 5)} ${digits.slice(5)}`;
  return raw.trim();
}

function values(subject: PosterSubject): Record<string, string> {
  return {
    business: subject.name,
    phone: displayPhone(subject.phone),
    city: subject.city,
    category: subject.category,
    address: subject.address,
    website: (subject.website ?? "").replace(/^https?:\/\//, "").replace(/\/$/, ""),
    rating: subject.avgRating > 0 ? subject.avgRating.toFixed(1) : "",
    reviews: subject.reviewCount > 0 ? String(subject.reviewCount) : "",
  };
}

/**
 * Fills `{{token}}` placeholders. Spacing and case inside the braces are
 * forgiven; an unknown token is left visible rather than blanked, so a typo
 * shows up in the preview instead of quietly deleting words.
 *
 * A known-but-empty value (a shop with no website) removes the placeholder and
 * tidies the leftover punctuation — a poster reading "Visit  today" is worse
 * than one reading "Visit today".
 */
export function fillPlaceholders(template: string | null | undefined, subject: PosterSubject): string {
  if (!template) return "";
  const table = values(subject);

  return template
    .replace(/\{\{\s*([a-zA-Z]+)\s*\}\}/g, (match, token: string) => {
      const key = token.toLowerCase();
      return key in table ? table[key] : match;
    })
    .replace(/[ \t]{2,}/g, " ")
    .replace(/\s+([,.!?])/g, "$1")
    .replace(/([·|—–-])\s*$/g, "")
    .trim();
}

/** Placeholders in the text that nothing will fill — surfaced in the editor
 *  before the design is published to hundreds of shops. */
export function unknownPlaceholders(...texts: (string | null | undefined)[]): string[] {
  const known = new Set(PLACEHOLDERS.map((p) => p.token));
  const found = new Set<string>();
  for (const text of texts) {
    for (const match of (text ?? "").matchAll(/\{\{\s*([a-zA-Z]+)\s*\}\}/g)) {
      const token = match[1].toLowerCase();
      if (!known.has(token)) found.add(match[1]);
    }
  }
  return [...found];
}
