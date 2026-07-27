import { Business, BusinessHours, BusinessPhoto, Category, Service } from "@prisma/client";

type BusinessWithDetails = Business & {
  category: Category | null;
  photos: BusinessPhoto[];
  hours: BusinessHours[];
  services: Service[];
};

const DAY_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

// Everything rendered into the page comes from the owner's account, so escape
// it — a stray quote or angle bracket in a business name must not break (or
// inject into) the generated markup.
function escapeHtml(value: string | null | undefined): string {
  if (!value) return "";
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function formatPrice(cents: number, currency: string): string {
  if (cents === 0) return "Free";
  const symbol = currency === "INR" ? "₹" : "";
  return `${symbol}${(cents / 100).toLocaleString("en-IN")}`;
}

function to12Hour(time: string): string {
  const [h, m] = time.split(":").map(Number);
  if (Number.isNaN(h)) return time;
  const period = h >= 12 ? "pm" : "am";
  const hour = h % 12 === 0 ? 12 : h % 12;
  return m ? `${hour}.${String(m).padStart(2, "0")}${period}` : `${hour}${period}`;
}

// "9.30am to 8pm" when every open day shares the same window, otherwise a
// per-day list — matching how shops actually describe their hours.
function summariseHours(hours: BusinessHours[]): string {
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
const ICON_WHATSAPP =
  '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M17.47 14.38c-.3-.15-1.76-.87-2.03-.97-.27-.1-.47-.15-.67.15s-.77.96-.94 1.16c-.17.2-.35.22-.64.08-.3-.15-1.25-.46-2.39-1.47-.88-.79-1.48-1.76-1.65-2.06-.17-.3-.02-.46.13-.61.13-.13.3-.35.45-.52.15-.17.2-.3.3-.5.1-.2.05-.37-.03-.52-.07-.15-.67-1.61-.92-2.21-.24-.58-.49-.5-.67-.51h-.57c-.2 0-.52.07-.79.37-.27.3-1.04 1.02-1.04 2.48s1.07 2.88 1.22 3.08c.15.2 2.1 3.2 5.08 4.49.71.3 1.26.49 1.69.63.71.23 1.36.2 1.87.12.57-.09 1.76-.72 2.01-1.41.25-.7.25-1.29.17-1.42-.07-.13-.27-.2-.57-.35M12.04 21.5h-.01a9.5 9.5 0 01-4.84-1.32l-.35-.21-3.6.94.96-3.5-.23-.36a9.42 9.42 0 01-1.45-5.05c0-5.22 4.27-9.47 9.53-9.47a9.47 9.47 0 019.51 9.48c0 5.22-4.27 9.47-9.52 9.47M20.52 3.5A11.44 11.44 0 0012.04 0C5.69 0 .52 5.15.52 11.47c0 2.02.53 3.99 1.54 5.73L.42 24l6.96-1.82a11.5 11.5 0 004.65 1.03h.01c6.35 0 11.52-5.15 11.52-11.47 0-3.06-1.2-5.94-3.37-8.11"/></svg>';
const ICON_PHONE =
  '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M6.62 10.79a15.05 15.05 0 006.59 6.59l2.2-2.2a1 1 0 011.02-.24c1.12.37 2.33.57 3.57.57a1 1 0 011 1V20a1 1 0 01-1 1A17 17 0 013 4a1 1 0 011-1h3.5a1 1 0 011 1c0 1.24.2 2.45.57 3.57a1 1 0 01-.25 1.02l-2.2 2.2z"/></svg>';
const ICON_PIN =
  '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 2a7 7 0 00-7 7c0 5.25 7 13 7 13s7-7.75 7-13a7 7 0 00-7-7m0 9.5A2.5 2.5 0 1112 6.5a2.5 2.5 0 010 5"/></svg>';
const ICON_CLOCK =
  '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 2a10 10 0 100 20 10 10 0 000-20m4.2 14.2L11 13V7h1.5v5.2l4.5 2.7z"/></svg>';
const ICON_INSTAGRAM =
  '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 2.16c3.2 0 3.58.01 4.85.07 1.17.05 1.8.25 2.23.41.56.22.96.48 1.38.9.42.42.68.82.9 1.38.16.42.36 1.06.41 2.23.06 1.27.07 1.65.07 4.85s-.01 3.58-.07 4.85c-.05 1.17-.25 1.8-.41 2.23-.22.56-.48.96-.9 1.38-.42.42-.82.68-1.38.9-.42.16-1.06.36-2.23.41-1.27.06-1.65.07-4.85.07s-3.58-.01-4.85-.07c-1.17-.05-1.8-.25-2.23-.41a3.8 3.8 0 01-1.38-.9 3.8 3.8 0 01-.9-1.38c-.16-.42-.36-1.06-.41-2.23C2.17 15.58 2.16 15.2 2.16 12s.01-3.58.07-4.85c.05-1.17.25-1.8.41-2.23.22-.56.48-.96.9-1.38.42-.42.82-.68 1.38-.9.42-.16 1.06-.36 2.23-.41C8.42 2.17 8.8 2.16 12 2.16M12 0C8.74 0 8.33.01 7.05.07c-1.28.06-2.15.26-2.91.56-.79.31-1.46.72-2.13 1.38A5.9 5.9 0 00.63 4.14c-.3.76-.5 1.63-.56 2.91C.01 8.33 0 8.74 0 12s.01 3.67.07 4.95c.06 1.28.26 2.15.56 2.91.31.79.72 1.46 1.38 2.13a5.9 5.9 0 002.13 1.38c.76.3 1.63.5 2.91.56C8.33 23.99 8.74 24 12 24s3.67-.01 4.95-.07c1.28-.06 2.15-.26 2.91-.56a5.9 5.9 0 002.13-1.38 5.9 5.9 0 001.38-2.13c.3-.76.5-1.63.56-2.91.06-1.28.07-1.69.07-4.95s-.01-3.67-.07-4.95c-.06-1.28-.26-2.15-.56-2.91a5.9 5.9 0 00-1.38-2.13A5.9 5.9 0 0019.86.63c-.76-.3-1.63-.5-2.91-.56C15.67.01 15.26 0 12 0m0 5.84a6.16 6.16 0 100 12.32 6.16 6.16 0 000-12.32m0 10.16a4 4 0 110-8 4 4 0 010 8m7.85-10.4a1.44 1.44 0 11-2.88 0 1.44 1.44 0 012.88 0"/></svg>';

/**
 * Builds the first draft of a business's website from the data they already
 * entered in their listing. The owner edits this in the builder afterwards;
 * it is only a starting point, never overwritten once they save.
 */
export function buildStarterTemplate(business: BusinessWithDetails) {
  const name = escapeHtml(business.name);
  const category = escapeHtml(business.category?.name ?? "");
  const city = escapeHtml(business.city);
  const description = escapeHtml(
    business.description || `${business.name} — ${business.category?.name ?? "local business"} in ${business.city}.`,
  );
  const address = escapeHtml(
    [business.addressLine1, business.addressLine2, business.city, business.state, business.postalCode]
      .filter(Boolean)
      .join(", "),
  );
  const phone = escapeHtml(business.phone);
  const phoneDigits = business.phone.replace(/[^0-9]/g, "");
  const email = escapeHtml(business.email);

  // Most listings have no dedicated logo, so fall back to their first photo
  // and finally to a lettermark — the header should never look unfinished.
  const logoSrc = escapeHtml(business.logoUrl ?? business.photos[0]?.url ?? "");
  const initial = escapeHtml((business.name.trim()[0] ?? "M").toUpperCase());
  const logoHtml = logoSrc
    ? `<img class="mk-logo" src="${logoSrc}" alt="${name}"/>`
    : `<span class="mk-logo mk-logo-text">${initial}</span>`;

  const workingTime = escapeHtml(summariseHours(business.hours));
  const instagram = business.instagramUsername?.replace(/^@/, "");
  const mapsQuery = `${business.latitude},${business.longitude}`;
  const directionsUrl = `https://www.google.com/maps/dir/?api=1&destination=${mapsQuery}`;

  // --- Hero slider -----------------------------------------------------
  // Published pages have scripts stripped, so the slider is pure CSS: a track
  // of N slides stepped along by a keyframe animation, generated to match the
  // number of photos the shop actually has.
  const slidePhotos = business.photos.slice(0, 5);
  const slideCount = slidePhotos.length;
  const heroSlides = slideCount
    ? slidePhotos
        .map((photo) => `<div class="mk-slide"><img src="${escapeHtml(photo.url)}" alt="${name}"/></div>`)
        .join("")
    : `<div class="mk-slide mk-slide-empty"><span>${name}</span></div>`;

  // One keyframe stop per slide: hold, then slide to the next.
  const slideKeyframes =
    slideCount > 1
      ? (() => {
          const step = 100 / slideCount;
          const stops = slidePhotos
            .map((_, i) => {
              const from = (i * step).toFixed(3);
              const to = (i * step + step - 4).toFixed(3);
              const shift = (-i * (100 / slideCount)).toFixed(4);
              return `${from}%,${to}%{transform:translateX(${shift}%)}`;
            })
            .join("");
          return `@keyframes mk-slideshow{${stops}100%{transform:translateX(0%)}}`;
        })()
      : "";

  const heroHeight = `.mk-hero{position:relative;overflow:hidden;height:min(78vh,620px)}`;
  const trackCss =
    slideCount > 1
      ? `.mk-track{display:flex;width:${slideCount * 100}%;height:100%;animation:mk-slideshow ${slideCount * 5}s infinite}
.mk-hero:hover .mk-track{animation-play-state:paused}
.mk-slide{width:${(100 / slideCount).toFixed(4)}%;height:100%}`
      : `.mk-track{display:flex;width:100%;height:100%}
.mk-slide{width:100%;height:100%}`;

  // --- Content sections -------------------------------------------------
  const galleryHtml = business.photos
    .map(
      (photo) => `
        <figure class="mk-card">
          <div class="mk-card-img"><img src="${escapeHtml(photo.url)}" alt="${escapeHtml(photo.caption || business.name)}" loading="lazy"/></div>
          <figcaption>${escapeHtml(photo.caption || business.name)}</figcaption>
        </figure>`,
    )
    .join("");

  const servicesHtml = business.services
    .map(
      (service) => `
      <div class="mk-service">
        <div>
          <h3>${escapeHtml(service.name)}</h3>
          ${service.description ? `<p>${escapeHtml(service.description)}</p>` : ""}
        </div>
        <span class="mk-price">${formatPrice(service.priceCents, service.currency)}</span>
      </div>`,
    )
    .join("");

  const html = `
<header class="mk-header">
  <div class="mk-header-inner">
    <a class="mk-brand" href="#home">
      ${logoHtml}
      <span class="mk-brand-text">
        <strong>${name}</strong>
        ${category ? `<small>${category}${city ? ` · ${city}` : ""}</small>` : ""}
      </span>
    </a>
    <nav class="mk-nav">
      <a href="#home">Home</a>
      <a href="#about">About Us</a>
      ${business.photos.length ? '<a href="#gallery">Gallery</a>' : ""}
      ${business.services.length ? '<a href="#services">Services</a>' : ""}
      <a href="#contact">Contact Us</a>
    </nav>
    <a class="mk-header-cta" href="tel:${phone}">${ICON_PHONE}<span>Call Now</span></a>
  </div>
</header>

<section class="mk-hero" id="home">
  <div class="mk-track">${heroSlides}</div>
  <div class="mk-hero-overlay">
    <div class="mk-hero-inner">
      ${category ? `<span class="mk-eyebrow">${category}${city ? ` in ${city}` : ""}</span>` : ""}
      <h1>${name}</h1>
      ${workingTime ? `<p class="mk-hero-hours">${ICON_CLOCK}<span>Open ${workingTime}</span></p>` : ""}
      <div class="mk-hero-actions">
        <a class="mk-btn mk-btn-primary" href="tel:${phone}">${ICON_PHONE}<span>Call Now</span></a>
        <a class="mk-btn mk-btn-wa" href="https://wa.me/${phoneDigits}" target="_blank" rel="noreferrer">${ICON_WHATSAPP}<span>WhatsApp</span></a>
        <a class="mk-btn mk-btn-ghost" href="${directionsUrl}" target="_blank" rel="noreferrer">${ICON_PIN}<span>Directions</span></a>
      </div>
    </div>
  </div>
</section>

<section class="mk-section" id="about">
  <h2>About Us</h2>
  <span class="mk-rule"></span>
  <p class="mk-lead">${description}</p>
  <div class="mk-facts">
    <div class="mk-fact">${ICON_PIN}<div><strong>Visit us</strong><span>${address}</span></div></div>
    ${workingTime ? `<div class="mk-fact">${ICON_CLOCK}<div><strong>Working hours</strong><span>${workingTime}</span></div></div>` : ""}
    <div class="mk-fact">${ICON_PHONE}<div><strong>Call us</strong><span><a href="tel:${phone}">${phone}</a></span></div></div>
  </div>
</section>

${
  galleryHtml
    ? `<section class="mk-section mk-section-alt" id="gallery">
  <h2>Our Gallery</h2>
  <span class="mk-rule"></span>
  <div class="mk-grid">${galleryHtml}</div>
</section>`
    : ""
}

${
  servicesHtml
    ? `<section class="mk-section" id="services">
  <h2>Our Services</h2>
  <span class="mk-rule"></span>
  <div class="mk-services">${servicesHtml}</div>
</section>`
    : ""
}

${
  instagram
    ? `<section class="mk-social">
  <a href="https://www.instagram.com/${escapeHtml(instagram)}/" target="_blank" rel="noreferrer">
    ${ICON_INSTAGRAM}<span>Follow us on Instagram</span>
  </a>
</section>`
    : ""
}

<section class="mk-map-section">
  <div class="mk-map">
    <iframe src="https://maps.google.com/maps?q=${mapsQuery}&amp;z=16&amp;output=embed" loading="lazy" title="Map to ${name}"></iframe>
  </div>
  <a class="mk-btn-map" href="${directionsUrl}" target="_blank" rel="noreferrer">${ICON_PIN}<span>Goto Shop</span></a>
</section>

<section class="mk-section mk-section-alt" id="contact">
  <h2>Contact Us</h2>
  <span class="mk-rule"></span>
  <div class="mk-contact-card">
    <div class="mk-contact-info">
      <h3>${ICON_PIN}<span>Address</span></h3>
      <p>${address}</p>
      ${workingTime ? `<h3>${ICON_CLOCK}<span>Working Time</span></h3><p>${workingTime}</p>` : ""}
      <h3>${ICON_PHONE}<span>Call Us</span></h3>
      <p><a href="tel:${phone}">${phone}</a></p>
      ${email ? `<h3>${ICON_PHONE}<span>Email</span></h3><p><a href="mailto:${email}">${email}</a></p>` : ""}
      <a class="mk-btn mk-btn-wa mk-contact-wa" href="https://wa.me/${phoneDigits}" target="_blank" rel="noreferrer">${ICON_WHATSAPP}<span>Chat on WhatsApp</span></a>
    </div>
    <!-- Submissions are delivered to this business's Leads inbox. -->
    <form class="mk-contact-form" data-mk-form="enquiry">
      <input type="text" name="name" placeholder="Name" required/>
      <input type="tel" name="phone" placeholder="Phone number"/>
      <input type="email" name="email" placeholder="Email address"/>
      <input type="text" name="subject" placeholder="Subject"/>
      <textarea name="message" placeholder="Message..." rows="5"></textarea>
      <button type="submit">Submit</button>
    </form>
  </div>
</section>

<footer class="mk-footer">
  <div class="mk-footer-inner">
    <p class="mk-footer-name">${name}</p>
    <p>${address}</p>
    <p><a href="tel:${phone}">${phone}</a>${email ? ` · <a href="mailto:${email}">${email}</a>` : ""}</p>
    <p class="mk-footer-copy">&copy; ${new Date().getFullYear()} ${name}. All rights reserved.</p>
  </div>
</footer>

<div class="mk-float">
  <a class="mk-float-btn mk-float-wa" href="https://wa.me/${phoneDigits}" target="_blank" rel="noreferrer" aria-label="Chat on WhatsApp">${ICON_WHATSAPP}</a>
  <a class="mk-float-btn mk-float-call" href="tel:${phone}" aria-label="Call us">${ICON_PHONE}</a>
</div>`.trim();

  const css = `
:root{--mk-accent:#e11d2e;--mk-dark:#12161c;--mk-muted:#6b7280}
.mk-header{position:sticky;top:0;z-index:40;background:#fff;box-shadow:0 1px 14px rgba(15,23,42,.08)}
.mk-header-inner{max-width:1200px;margin:0 auto;padding:12px 22px;display:flex;align-items:center;gap:18px}
.mk-brand{display:flex;align-items:center;gap:12px;text-decoration:none;color:var(--mk-dark);margin-right:auto}
.mk-logo{width:50px;height:50px;object-fit:cover;border-radius:50%;flex:0 0 auto;box-shadow:0 2px 8px rgba(15,23,42,.14)}
.mk-logo-text{display:flex;align-items:center;justify-content:center;background:var(--mk-accent);color:#fff;font-size:22px;font-weight:800}
.mk-brand-text{display:flex;flex-direction:column;line-height:1.25}
.mk-brand-text strong{font-size:17px;font-weight:800;letter-spacing:.4px;text-transform:uppercase}
.mk-brand-text small{font-size:11.5px;color:var(--mk-muted);letter-spacing:.6px;text-transform:uppercase}
.mk-nav{display:flex;gap:26px}
.mk-nav a{color:#374151;text-decoration:none;font-size:12.5px;font-weight:700;letter-spacing:1.1px;text-transform:uppercase;padding:6px 0;border-bottom:2px solid transparent}
.mk-nav a:hover{color:var(--mk-accent);border-bottom-color:var(--mk-accent)}
.mk-header-cta{display:inline-flex;align-items:center;gap:8px;background:var(--mk-accent);color:#fff;text-decoration:none;padding:10px 20px;border-radius:999px;font-size:13px;font-weight:700}
.mk-header-cta svg{width:15px;height:15px}
.mk-header-cta:hover{background:#b91626}

${heroHeight}
${trackCss}
${slideKeyframes}
.mk-slide img{width:100%;height:100%;object-fit:cover;display:block}
.mk-slide-empty{display:flex;align-items:center;justify-content:center;background:linear-gradient(135deg,#12161c,#2b3442);color:#fff}
.mk-slide-empty span{font-size:32px;font-weight:800;letter-spacing:2px;text-transform:uppercase}
.mk-hero-overlay{position:absolute;inset:0;display:flex;align-items:center;background:linear-gradient(90deg,rgba(10,14,20,.82) 0%,rgba(10,14,20,.55) 55%,rgba(10,14,20,.25) 100%)}
.mk-hero-inner{max-width:1200px;margin:0 auto;padding:0 26px;width:100%;color:#fff}
.mk-eyebrow{display:inline-block;background:rgba(255,255,255,.16);border:1px solid rgba(255,255,255,.28);padding:6px 15px;border-radius:999px;font-size:11.5px;font-weight:700;letter-spacing:1.4px;text-transform:uppercase;margin-bottom:16px}
.mk-hero h1{margin:0 0 14px;font-size:clamp(30px,5vw,56px);line-height:1.08;font-weight:800;letter-spacing:-.5px;max-width:16ch;text-shadow:0 2px 18px rgba(0,0,0,.35)}
.mk-hero-hours{display:inline-flex;align-items:center;gap:8px;margin:0 0 26px;font-size:14.5px;color:rgba(255,255,255,.9)}
.mk-hero-hours svg{width:16px;height:16px}
.mk-hero-actions{display:flex;flex-wrap:wrap;gap:12px}
.mk-btn{display:inline-flex;align-items:center;gap:9px;padding:13px 26px;border-radius:999px;text-decoration:none;font-size:14.5px;font-weight:700;transition:transform .15s,background .15s}
.mk-btn svg{width:17px;height:17px}
.mk-btn:hover{transform:translateY(-2px)}
.mk-btn-primary{background:var(--mk-accent);color:#fff}
.mk-btn-primary:hover{background:#b91626}
.mk-btn-wa{background:#25d366;color:#fff}
.mk-btn-wa:hover{background:#1eb356}
.mk-btn-ghost{background:rgba(255,255,255,.12);color:#fff;border:1px solid rgba(255,255,255,.4)}
.mk-btn-ghost:hover{background:rgba(255,255,255,.22)}

.mk-section{padding:78px 22px;max-width:1200px;margin:0 auto}
.mk-section-alt{background:#f6f8fb;max-width:none}
.mk-section h2{text-align:center;font-size:clamp(24px,3.4vw,34px);font-weight:800;letter-spacing:1.5px;text-transform:uppercase;color:var(--mk-dark);margin:0 0 12px}
.mk-rule{display:block;width:62px;height:3px;background:var(--mk-accent);border-radius:2px;margin:0 auto 34px}
.mk-lead{max-width:820px;margin:0 auto;text-align:center;color:var(--mk-muted);font-size:15.5px;line-height:1.9}
.mk-facts{max-width:1080px;margin:44px auto 0;display:grid;grid-template-columns:repeat(auto-fit,minmax(250px,1fr));gap:18px}
.mk-fact{display:flex;gap:14px;background:#fff;border:1px solid #e8edf3;border-radius:12px;padding:20px}
.mk-fact svg{width:20px;height:20px;color:var(--mk-accent);flex:0 0 auto;margin-top:2px}
.mk-fact strong{display:block;font-size:13px;letter-spacing:.6px;text-transform:uppercase;color:var(--mk-dark);margin-bottom:4px}
.mk-fact span{font-size:14px;color:var(--mk-muted);line-height:1.6}
.mk-fact a{color:var(--mk-muted);text-decoration:none}

.mk-grid{max-width:1200px;margin:0 auto;display:grid;grid-template-columns:repeat(4,1fr);gap:20px}
.mk-card{margin:0;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 2px 12px rgba(15,23,42,.07);transition:transform .2s,box-shadow .2s}
.mk-card:hover{transform:translateY(-4px);box-shadow:0 10px 26px rgba(15,23,42,.13)}
.mk-card-img{overflow:hidden;height:220px}
.mk-card-img img{width:100%;height:100%;object-fit:cover;display:block;transition:transform .35s}
.mk-card:hover .mk-card-img img{transform:scale(1.07)}
.mk-card figcaption{padding:14px 10px;text-align:center;font-size:12.5px;font-weight:600;letter-spacing:1px;text-transform:uppercase;color:#374151}

.mk-services{max-width:960px;margin:0 auto;display:grid;gap:14px}
.mk-service{display:flex;justify-content:space-between;align-items:flex-start;gap:22px;background:#fff;border:1px solid #e8edf3;border-radius:12px;padding:22px 24px;transition:border-color .2s,box-shadow .2s}
.mk-service:hover{border-color:#d6dee8;box-shadow:0 6px 18px rgba(15,23,42,.07)}
.mk-service h3{margin:0 0 5px;font-size:16.5px;color:var(--mk-dark)}
.mk-service p{margin:0;color:var(--mk-muted);font-size:14px;line-height:1.65}
.mk-price{color:var(--mk-accent);font-weight:800;font-size:17.5px;white-space:nowrap}

.mk-social{padding:44px 22px;text-align:center;background:#fff}
.mk-social a{display:inline-flex;align-items:center;gap:10px;color:var(--mk-dark);font-size:16px;font-weight:600;text-decoration:none;padding:12px 26px;border:1px solid #e8edf3;border-radius:999px}
.mk-social svg{width:20px;height:20px;color:#e1306c}
.mk-social a:hover{border-color:#e1306c;color:#e1306c}

.mk-map-section{position:relative;padding-bottom:52px;text-align:center;background:#f6f8fb}
.mk-map{max-width:1200px;margin:0 auto;height:430px}
.mk-map iframe{width:100%;height:100%;border:0;display:block}
.mk-btn-map{display:inline-flex;align-items:center;gap:9px;margin-top:-24px;position:relative;background:var(--mk-accent);color:#fff;padding:13px 32px;border-radius:999px;text-decoration:none;font-weight:700;font-size:14.5px;box-shadow:0 6px 18px rgba(225,29,46,.32)}
.mk-btn-map svg{width:16px;height:16px}
.mk-btn-map:hover{background:#b91626}

.mk-contact-card{max-width:1140px;margin:0 auto;background:#fff;border-radius:14px;box-shadow:0 4px 26px rgba(15,23,42,.08);padding:44px;display:grid;grid-template-columns:1fr 1.35fr;gap:46px}
.mk-contact-info h3{display:flex;align-items:center;gap:9px;margin:0 0 7px;font-size:14.5px;font-weight:800;letter-spacing:.7px;text-transform:uppercase;color:var(--mk-dark)}
.mk-contact-info h3 svg{width:16px;height:16px;color:var(--mk-accent)}
.mk-contact-info h3+p{margin:0 0 24px;color:var(--mk-muted);font-size:14.5px;line-height:1.7}
.mk-contact-info a{color:var(--mk-muted);text-decoration:none}
.mk-contact-info a:hover{color:var(--mk-accent)}
.mk-contact-wa{margin-top:6px}
.mk-contact-wa span{color:#fff}
.mk-contact-form{display:flex;flex-direction:column;gap:15px}
.mk-contact-form input,.mk-contact-form textarea{width:100%;background:#f3f5f9;border:1px solid #e4e9f0;border-radius:8px;padding:14px 16px;font-size:14.5px;color:#111827;font-family:inherit}
.mk-contact-form input::placeholder,.mk-contact-form textarea::placeholder{color:#9aa3b2}
.mk-contact-form input:focus,.mk-contact-form textarea:focus{outline:none;border-color:var(--mk-accent);background:#fff;box-shadow:0 0 0 3px rgba(225,29,46,.1)}
.mk-contact-form textarea{resize:vertical;min-height:130px}
.mk-contact-form button{align-self:flex-start;background:var(--mk-accent);color:#fff;border:0;border-radius:999px;padding:14px 42px;font-size:15px;font-weight:700;cursor:pointer}
.mk-contact-form button:hover{background:#b91626}

.mk-footer{background:var(--mk-dark);color:#9aa3b2;text-align:center;padding:44px 22px}
.mk-footer-inner{max-width:760px;margin:0 auto;display:grid;gap:7px;font-size:14px;line-height:1.7}
.mk-footer-name{color:#fff;font-size:18px;font-weight:800;letter-spacing:1px;text-transform:uppercase;margin:0 0 4px}
.mk-footer a{color:#cbd5e1;text-decoration:none}
.mk-footer a:hover{color:#fff}
.mk-footer-copy{margin-top:14px;padding-top:16px;border-top:1px solid rgba(255,255,255,.1);font-size:12.5px;color:#6b7280}

.mk-float{position:fixed;right:20px;bottom:22px;display:flex;flex-direction:column;gap:12px;z-index:60}
.mk-float-btn{width:56px;height:56px;border-radius:50%;display:flex;align-items:center;justify-content:center;color:#fff;text-decoration:none;box-shadow:0 6px 18px rgba(0,0,0,.26);transition:transform .18s}
.mk-float-btn svg{width:28px;height:28px}
.mk-float-btn:hover{transform:scale(1.08)}
.mk-float-wa{background:#25d366}
.mk-float-call{background:var(--mk-accent)}
.mk-float-call svg{width:25px;height:25px}

@media(max-width:1024px){.mk-grid{grid-template-columns:repeat(3,1fr)}.mk-nav{display:none}}
@media(max-width:860px){.mk-grid{grid-template-columns:repeat(2,1fr)}.mk-contact-card{grid-template-columns:1fr;padding:28px;gap:32px}.mk-header-cta span{display:none}.mk-header-cta{padding:10px 13px}}
@media(max-width:560px){.mk-hero{height:min(70vh,470px)}.mk-section{padding:52px 18px}.mk-card-img{height:150px}.mk-grid{gap:12px}.mk-btn{padding:11px 18px;font-size:13.5px}.mk-float-btn{width:50px;height:50px}.mk-float-btn svg{width:25px;height:25px}}
@media(prefers-reduced-motion:reduce){.mk-track{animation:none}.mk-card,.mk-card-img img,.mk-btn{transition:none}}`.trim();

  return {
    html,
    css,
    data: {
      name: business.name,
      tagline: business.category?.name ? `${business.category.name} in ${business.city}` : business.city,
      description: business.description ?? "",
      phone: business.phone,
      email: business.email,
      address: [business.addressLine1, business.addressLine2, business.city, business.state, business.postalCode]
        .filter(Boolean)
        .join(", "),
      workingTime: summariseHours(business.hours),
      instagram: business.instagramUsername ?? null,
      logoUrl: business.logoUrl,
      photoCount: business.photos.length,
      slideCount,
      serviceCount: business.services.length,
    },
  };
}
