import { Business, BusinessHours, BusinessPhoto, Category, Service } from "@prisma/client";

export type BusinessWithDetails = Business & {
  category: Category | null;
  photos: BusinessPhoto[];
  hours: BusinessHours[];
  services: Service[];
};

const DAY_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
export const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

// Everything rendered into a page comes from the owner's account, so escape it
// — a stray quote or angle bracket in a business name must not break (or
// inject into) the generated markup.
export function escapeHtml(value: string | null | undefined): string {
  if (!value) return "";
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function formatPrice(cents: number, currency: string): string {
  if (cents === 0) return "Free";
  const symbol = currency === "INR" ? "₹" : "";
  return `${symbol}${(cents / 100).toLocaleString("en-IN")}`;
}

export function to12Hour(time: string): string {
  const [h, m] = time.split(":").map(Number);
  if (Number.isNaN(h)) return time;
  const period = h >= 12 ? "pm" : "am";
  const hour = h % 12 === 0 ? 12 : h % 12;
  return m ? `${hour}.${String(m).padStart(2, "0")}${period}` : `${hour}${period}`;
}

// "9.30am to 8pm" when every open day shares the same window, otherwise a
// per-day list — matching how shops actually describe their hours.
export function summariseHours(hours: BusinessHours[]): string {
  const open = hours.filter((h) => !h.isClosed);
  if (open.length === 0) return "";
  const windows = new Set(open.map((h) => `${h.openTime}-${h.closeTime}`));
  if (windows.size === 1) {
    const [first] = open;
    const closedDays = hours.filter((h) => h.isClosed).map((h) => DAY_SHORT[h.dayOfWeek]);
    const range = `${to12Hour(first.openTime)} to ${to12Hour(first.closeTime)}`;
    return closedDays.length ? `${range} (closed ${closedDays.join(", ")})` : range;
  }
  return open.map((h) => `${DAY_SHORT[h.dayOfWeek]} ${to12Hour(h.openTime)}–${to12Hour(h.closeTime)}`).join(", ");
}

// Inline icons. Published pages have scripts stripped, so anything interactive
// has to be plain markup + CSS; SVG keeps the buttons crisp at any size.
export const ICON = {
  whatsapp:
    '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M17.47 14.38c-.3-.15-1.76-.87-2.03-.97-.27-.1-.47-.15-.67.15s-.77.96-.94 1.16c-.17.2-.35.22-.64.08-.3-.15-1.25-.46-2.39-1.47-.88-.79-1.48-1.76-1.65-2.06-.17-.3-.02-.46.13-.61.13-.13.3-.35.45-.52.15-.17.2-.3.3-.5.1-.2.05-.37-.03-.52-.07-.15-.67-1.61-.92-2.21-.24-.58-.49-.5-.67-.51h-.57c-.2 0-.52.07-.79.37-.27.3-1.04 1.02-1.04 2.48s1.07 2.88 1.22 3.08c.15.2 2.1 3.2 5.08 4.49.71.3 1.26.49 1.69.63.71.23 1.36.2 1.87.12.57-.09 1.76-.72 2.01-1.41.25-.7.25-1.29.17-1.42-.07-.13-.27-.2-.57-.35M12.04 21.5h-.01a9.5 9.5 0 01-4.84-1.32l-.35-.21-3.6.94.96-3.5-.23-.36a9.42 9.42 0 01-1.45-5.05c0-5.22 4.27-9.47 9.53-9.47a9.47 9.47 0 019.51 9.48c0 5.22-4.27 9.47-9.52 9.47M20.52 3.5A11.44 11.44 0 0012.04 0C5.69 0 .52 5.15.52 11.47c0 2.02.53 3.99 1.54 5.73L.42 24l6.96-1.82a11.5 11.5 0 004.65 1.03h.01c6.35 0 11.52-5.15 11.52-11.47 0-3.06-1.2-5.94-3.37-8.11"/></svg>',
  phone:
    '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M6.62 10.79a15.05 15.05 0 006.59 6.59l2.2-2.2a1 1 0 011.02-.24c1.12.37 2.33.57 3.57.57a1 1 0 011 1V20a1 1 0 01-1 1A17 17 0 013 4a1 1 0 011-1h3.5a1 1 0 011 1c0 1.24.2 2.45.57 3.57a1 1 0 01-.25 1.02l-2.2 2.2z"/></svg>',
  pin: '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 2a7 7 0 00-7 7c0 5.25 7 13 7 13s7-7.75 7-13a7 7 0 00-7-7m0 9.5A2.5 2.5 0 1112 6.5a2.5 2.5 0 010 5"/></svg>',
  clock:
    '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 2a10 10 0 100 20 10 10 0 000-20m4.2 14.2L11 13V7h1.5v5.2l4.5 2.7z"/></svg>',
  mail: '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M20 4H4a2 2 0 00-2 2v12a2 2 0 002 2h16a2 2 0 002-2V6a2 2 0 00-2-2m0 4l-8 5-8-5V6l8 5 8-5z"/></svg>',
  instagram:
    '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 2.16c3.2 0 3.58.01 4.85.07 1.17.05 1.8.25 2.23.41.56.22.96.48 1.38.9.42.42.68.82.9 1.38.16.42.36 1.06.41 2.23.06 1.27.07 1.65.07 4.85s-.01 3.58-.07 4.85c-.05 1.17-.25 1.8-.41 2.23-.22.56-.48.96-.9 1.38-.42.42-.82.68-1.38.9-.42.16-1.06.36-2.23.41-1.27.06-1.65.07-4.85.07s-3.58-.01-4.85-.07c-1.17-.05-1.8-.25-2.23-.41a3.8 3.8 0 01-1.38-.9 3.8 3.8 0 01-.9-1.38c-.16-.42-.36-1.06-.41-2.23C2.17 15.58 2.16 15.2 2.16 12s.01-3.58.07-4.85c.05-1.17.25-1.8.41-2.23.22-.56.48-.96.9-1.38.42-.42.82-.68 1.38-.9.42-.16 1.06-.36 2.23-.41C8.42 2.17 8.8 2.16 12 2.16M12 0C8.74 0 8.33.01 7.05.07c-1.28.06-2.15.26-2.91.56-.79.31-1.46.72-2.13 1.38A5.9 5.9 0 00.63 4.14c-.3.76-.5 1.63-.56 2.91C.01 8.33 0 8.74 0 12s.01 3.67.07 4.95c.06 1.28.26 2.15.56 2.91.31.79.72 1.46 1.38 2.13a5.9 5.9 0 002.13 1.38c.76.3 1.63.5 2.91.56C8.33 23.99 8.74 24 12 24s3.67-.01 4.95-.07c1.28-.06 2.15-.26 2.91-.56a5.9 5.9 0 002.13-1.38 5.9 5.9 0 001.38-2.13c.3-.76.5-1.63.56-2.91.06-1.28.07-1.69.07-4.95s-.01-3.67-.07-4.95c-.06-1.28-.26-2.15-.56-2.91a5.9 5.9 0 00-1.38-2.13A5.9 5.9 0 0019.86.63c-.76-.3-1.63-.5-2.91-.56C15.67.01 15.26 0 12 0m0 5.84a6.16 6.16 0 100 12.32 6.16 6.16 0 000-12.32m0 10.16a4 4 0 110-8 4 4 0 010 8m7.85-10.4a1.44 1.44 0 11-2.88 0 1.44 1.44 0 012.88 0"/></svg>',
  star: '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z"/></svg>',
};

/**
 * Every value a template needs, derived once from the business record so the
 * individual designs only deal with presentation.
 */
export interface TemplateContext {
  name: string;
  category: string;
  city: string;
  description: string;
  address: string;
  phone: string;
  phoneDigits: string;
  email: string;
  logoHtml: string;
  logoSrc: string;
  initial: string;
  workingTime: string;
  instagram: string;
  mapsQuery: string;
  directionsUrl: string;
  mapEmbedUrl: string;
  whatsappUrl: string;
  year: number;
  rating: string;
  reviewCount: number;
  photos: { url: string; caption: string }[];
  slides: { url: string }[];
  services: { name: string; description: string; price: string }[];
  hours: { day: string; value: string; closed: boolean }[];
}

export function buildContext(business: BusinessWithDetails): TemplateContext {
  // Most listings have no dedicated logo, so fall back to their first photo
  // and finally to a lettermark — a header should never look unfinished.
  const logoSrc = escapeHtml(business.logoUrl ?? business.photos[0]?.url ?? "");
  const initial = escapeHtml((business.name.trim()[0] ?? "M").toUpperCase());
  const name = escapeHtml(business.name);

  return {
    name,
    category: escapeHtml(business.category?.name ?? ""),
    city: escapeHtml(business.city),
    description: escapeHtml(
      business.description || `${business.name} — ${business.category?.name ?? "local business"} in ${business.city}.`,
    ),
    address: escapeHtml(
      [business.addressLine1, business.addressLine2, business.city, business.state, business.postalCode]
        .filter(Boolean)
        .join(", "),
    ),
    phone: escapeHtml(business.phone),
    phoneDigits: business.phone.replace(/[^0-9]/g, ""),
    email: escapeHtml(business.email),
    logoSrc,
    initial,
    logoHtml: logoSrc
      ? `<img class="mk-logo" src="${logoSrc}" alt="${name}"/>`
      : `<span class="mk-logo mk-logo-text">${initial}</span>`,
    workingTime: escapeHtml(summariseHours(business.hours)),
    instagram: escapeHtml(business.instagramUsername?.replace(/^@/, "") ?? ""),
    mapsQuery: `${business.latitude},${business.longitude}`,
    directionsUrl: `https://www.google.com/maps/dir/?api=1&destination=${business.latitude},${business.longitude}`,
    mapEmbedUrl: `https://maps.google.com/maps?q=${business.latitude},${business.longitude}&amp;z=16&amp;output=embed`,
    whatsappUrl: `https://wa.me/${business.phone.replace(/[^0-9]/g, "")}`,
    year: new Date().getFullYear(),
    rating: business.avgRating > 0 ? business.avgRating.toFixed(1) : "",
    reviewCount: business.reviewCount,
    photos: business.photos.map((p) => ({
      url: escapeHtml(p.url),
      caption: escapeHtml(p.caption || business.name),
    })),
    slides: business.photos.slice(0, 5).map((p) => ({ url: escapeHtml(p.url) })),
    services: business.services.map((s) => ({
      name: escapeHtml(s.name),
      description: escapeHtml(s.description ?? ""),
      price: formatPrice(s.priceCents, s.currency),
    })),
    hours: business.hours.map((h) => ({
      day: DAY_NAMES[h.dayOfWeek],
      value: h.isClosed ? "Closed" : `${to12Hour(h.openTime)} – ${to12Hour(h.closeTime)}`,
      closed: h.isClosed,
    })),
  };
}

/**
 * Shared pure-CSS hero slideshow. Published pages have scripts stripped, so
 * the slider is a track of N slides stepped along by a keyframe animation,
 * generated to match the number of photos the shop actually has.
 */
export function slideshow(ctx: TemplateContext, opts: { emptyClass?: string } = {}) {
  const count = ctx.slides.length;
  const slidesHtml = count
    ? ctx.slides.map((s) => `<div class="mk-slide"><img src="${s.url}" alt="${ctx.name}"/></div>`).join("")
    : `<div class="mk-slide ${opts.emptyClass ?? "mk-slide-empty"}"><span>${ctx.name}</span></div>`;

  if (count <= 1) {
    return {
      html: slidesHtml,
      css: `.mk-track{display:flex;width:100%;height:100%}.mk-slide{width:100%;height:100%}`,
    };
  }

  const step = 100 / count;
  const stops = ctx.slides
    .map((_, i) => {
      const from = (i * step).toFixed(3);
      const to = (i * step + step - 4).toFixed(3);
      const shift = (-i * step).toFixed(4);
      return `${from}%,${to}%{transform:translateX(${shift}%)}`;
    })
    .join("");

  return {
    html: slidesHtml,
    css: `.mk-track{display:flex;width:${count * 100}%;height:100%;animation:mk-slideshow ${count * 5}s infinite}
.mk-hero:hover .mk-track{animation-play-state:paused}
.mk-slide{width:${step.toFixed(4)}%;height:100%}
@keyframes mk-slideshow{${stops}100%{transform:translateX(0%)}}`,
  };
}

// The floating call/WhatsApp pair every template carries.
export function floatButtons(ctx: TemplateContext, accent: string): { html: string; css: string } {
  return {
    html: `<div class="mk-float">
  <a class="mk-float-btn mk-float-wa" href="${ctx.whatsappUrl}" target="_blank" rel="noreferrer" aria-label="Chat on WhatsApp">${ICON.whatsapp}</a>
  <a class="mk-float-btn mk-float-call" href="tel:${ctx.phone}" aria-label="Call us">${ICON.phone}</a>
</div>`,
    css: `.mk-float{position:fixed;right:20px;bottom:22px;display:flex;flex-direction:column;gap:12px;z-index:60}
.mk-float-btn{width:56px;height:56px;border-radius:50%;display:flex;align-items:center;justify-content:center;color:#fff;text-decoration:none;box-shadow:0 6px 18px rgba(0,0,0,.26);transition:transform .18s}
.mk-float-btn svg{width:28px;height:28px}
.mk-float-btn:hover{transform:scale(1.08)}
.mk-float-wa{background:#25d366}
.mk-float-call{background:${accent}}
.mk-float-call svg{width:25px;height:25px}
@media(max-width:560px){.mk-float-btn{width:50px;height:50px}.mk-float-btn svg{width:25px;height:25px}}`,
  };
}

// The enquiry form. Submissions are picked up by the published page and
// delivered to the business's Leads inbox.
export function enquiryForm(submitLabel = "Submit"): string {
  return `<form class="mk-contact-form" data-mk-form="enquiry">
  <input type="text" name="name" placeholder="Name" required/>
  <input type="tel" name="phone" placeholder="Phone number"/>
  <input type="email" name="email" placeholder="Email address"/>
  <input type="text" name="subject" placeholder="Subject"/>
  <textarea name="message" placeholder="Message..." rows="5"></textarea>
  <button type="submit">${submitLabel}</button>
</form>`;
}

export function mapSection(ctx: TemplateContext, buttonLabel = "Goto Shop"): string {
  return `<section class="mk-map-section">
  <div class="mk-map">
    <iframe src="${ctx.mapEmbedUrl}" loading="lazy" title="Map to ${ctx.name}"></iframe>
  </div>
  <a class="mk-btn-map" href="${ctx.directionsUrl}" target="_blank" rel="noreferrer">${ICON.pin}<span>${buttonLabel}</span></a>
</section>`;
}

export interface SiteTemplate {
  id: string;
  name: string;
  description: string;
  /** Accent colour, surfaced in the picker so the choice is visible. */
  accent: string;
  /** Short hint about the kind of business it suits. */
  bestFor: string;
  build(ctx: TemplateContext): { html: string; css: string };
}
