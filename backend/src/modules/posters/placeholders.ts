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
  /** The shop's own page on the platform — what its QR points at. */
  pageUrl: string;
}

/**
 * `@business_name` in a prompt, and `{{business_name}}` in poster wording.
 *
 * The `@` form needs the lookbehind: without it the address in
 * `hi@spiceroute.example` reads as a token called `spiceroute`, and an admin
 * who pastes an email into a prompt gets it mangled.
 */
const AT_TOKEN = /(?<![\w@])@([a-z_][a-z0-9_]*)/gi;
const BRACE_TOKEN = /\{\{\s*([a-zA-Z_][a-zA-Z0-9_]*)\s*\}\}/g;

export interface PlaceholderInfo {
  token: string;
  label: string;
  example: string;
}

/** What the admin can drop into a headline, and what it turns into. Shown as
 *  clickable chips in the poster editor. */
export const PLACEHOLDERS: PlaceholderInfo[] = [
  { token: "business_name", label: "Business name", example: "Spice Route Kitchen" },
  { token: "phone", label: "Phone number", example: "+91 98765 43210" },
  { token: "city", label: "City", example: "Kozhikode" },
  { token: "state", label: "State", example: "Kerala" },
  { token: "category", label: "Category", example: "Restaurants" },
  { token: "address", label: "Street address", example: "12 Beach Road" },
  { token: "website", label: "Website", example: "spiceroute.example" },
  { token: "email", label: "Email", example: "hi@spiceroute.example" },
  { token: "rating", label: "Average rating", example: "4.6" },
  { token: "reviews", label: "Review count", example: "128" },
  {
    token: "qr",
    label: "QR to the shop's page",
    example: "prints a scannable code",
  },
];

/**
 * Whether this prompt asks for the QR.
 *
 * The prompt is the single description of what the poster carries, so the QR
 * is switched on by naming it there rather than by a separate checkbox that
 * could disagree with the words next to it.
 */
export function promptWantsQr(prompt: string | null | undefined): boolean {
  if (!prompt) return false;
  for (const pattern of [BRACE_TOKEN, AT_TOKEN]) {
    for (const match of prompt.matchAll(pattern)) {
      if (canonical(match[1]) === "qr") return true;
    }
  }
  return false;
}

/**
 * Older spellings kept working. `{{business}}` predates `@business_name`, and
 * a design saved with it must not start printing the token instead of the
 * shop's name.
 */
const ALIASES: Record<string, string> = {
  business: "business_name",
  name: "business_name",
  businessname: "business_name",
  mobile: "phone",
  contact: "phone",
};

function canonical(token: string): string {
  const key = token.toLowerCase();
  return ALIASES[key] ?? key;
}

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
    business_name: subject.name,
    phone: displayPhone(subject.phone),
    city: subject.city,
    state: subject.state,
    category: subject.category,
    address: subject.address,
    website: (subject.website ?? "").replace(/^https?:\/\//, "").replace(/\/$/, ""),
    email: subject.email ?? "",
    rating: subject.avgRating > 0 ? subject.avgRating.toFixed(1) : "",
    reviews: subject.reviewCount > 0 ? String(subject.reviewCount) : "",
    // As text this is the address the code points at, which is what an image
    // generator needs to be told; the renderer draws the code itself.
    qr: subject.pageUrl,
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
  const fill = (match: string, token: string) => {
    const key = canonical(token);
    return key in table ? table[key] : match;
  };

  return template
    .replace(BRACE_TOKEN, fill)
    .replace(AT_TOKEN, fill)
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
    for (const pattern of [BRACE_TOKEN, AT_TOKEN]) {
      for (const match of (text ?? "").matchAll(pattern)) {
        if (!known.has(canonical(match[1]))) found.add(match[1]);
      }
    }
  }
  return [...found];
}
