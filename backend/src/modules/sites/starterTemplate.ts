import { Business, BusinessHours, BusinessPhoto, Category, Service } from "@prisma/client";

type BusinessWithDetails = Business & {
  category: Category | null;
  photos: BusinessPhoto[];
  hours: BusinessHours[];
  services: Service[];
};

const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
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

/**
 * Builds the first draft of a business's website from the data they already
 * entered in their listing. The owner edits this in the builder afterwards;
 * it is only a starting point, never overwritten once they save.
 */
export function buildStarterTemplate(business: BusinessWithDetails) {
  const name = escapeHtml(business.name);
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
  const logo = escapeHtml(business.logoUrl ?? "");
  const hero = escapeHtml(business.photos[0]?.url ?? business.coverImageUrl ?? "");
  const workingTime = escapeHtml(summariseHours(business.hours));
  const instagram = business.instagramUsername?.replace(/^@/, "");
  const mapsQuery = `${business.latitude},${business.longitude}`;
  const directionsUrl = `https://www.google.com/maps/dir/?api=1&destination=${mapsQuery}`;

  // "Our services" is the product/-service showcase: photos when the shop has
  // them, otherwise its priced services.
  const showcaseHtml = business.photos.length
    ? business.photos
        .map(
          (photo) => `
        <figure class="mk-card">
          <img src="${escapeHtml(photo.url)}" alt="${escapeHtml(photo.caption || business.name)}"/>
          <figcaption>${escapeHtml(photo.caption || business.name)}</figcaption>
        </figure>`,
        )
        .join("")
    : business.services
        .map(
          (service) => `
        <figure class="mk-card mk-card-text">
          <figcaption>${escapeHtml(service.name)}<span>${formatPrice(service.priceCents, service.currency)}</span></figcaption>
        </figure>`,
        )
        .join("");

  const priceListHtml = business.photos.length && business.services.length
    ? `
<section class="mk-section" id="pricing">
  <h2>Our Services</h2>
  <div class="mk-prices">
    ${business.services
      .map(
        (service) => `
      <div class="mk-price-row">
        <div>
          <h3>${escapeHtml(service.name)}</h3>
          ${service.description ? `<p>${escapeHtml(service.description)}</p>` : ""}
        </div>
        <span>${formatPrice(service.priceCents, service.currency)}</span>
      </div>`,
      )
      .join("")}
  </div>
</section>`
    : "";

  const html = `
<header class="mk-header">
  <div class="mk-header-inner">
    <a class="mk-brand" href="#home">
      ${logo ? `<img class="mk-logo" src="${logo}" alt="${name}"/>` : ""}
      <span>${name}</span>
    </a>
    <nav class="mk-nav">
      <a href="#home">Home</a>
      <a href="#about">About Us</a>
      <a href="#contact">Contact Us</a>
    </nav>
  </div>
</header>

<section class="mk-hero" id="home">
  ${hero ? `<img src="${hero}" alt="${name}"/>` : `<div class="mk-hero-fallback"><span>${name}</span></div>`}
</section>

<section class="mk-section" id="about">
  <h2>About Us</h2>
  <p class="mk-lead">${description}</p>
</section>

${
  showcaseHtml
    ? `<section class="mk-section mk-section-alt" id="services">
  <h2>${business.photos.length ? "Our Gallery" : "Our Services"}</h2>
  <div class="mk-grid">${showcaseHtml}</div>
</section>`
    : ""
}

${priceListHtml}

${
  instagram
    ? `<section class="mk-social">
  <a href="https://www.instagram.com/${escapeHtml(instagram)}/" target="_blank" rel="noreferrer">
    Follow Us On Instagram
  </a>
</section>`
    : ""
}

<section class="mk-map-section">
  <div class="mk-map">
    <iframe src="https://maps.google.com/maps?q=${mapsQuery}&amp;z=16&amp;output=embed" loading="lazy" title="Map to ${name}"></iframe>
  </div>
  <a class="mk-btn-map" href="${directionsUrl}" target="_blank" rel="noreferrer">Goto Shop</a>
</section>

<section class="mk-section mk-section-alt" id="contact">
  <h2>Contact Us</h2>
  <div class="mk-contact-card">
    <div class="mk-contact-info">
      <h3>Address</h3>
      <p>${address}</p>
      ${workingTime ? `<h3>Working Time</h3><p>${workingTime}</p>` : ""}
      <h3>Call Us</h3>
      <p><a href="tel:${phone}">${phone}</a></p>
      ${email ? `<h3>Email</h3><p><a href="mailto:${email}">${email}</a></p>` : ""}
    </div>
    <!-- Submissions are delivered to this business's Leads inbox. -->
    <form class="mk-contact-form" data-mk-form="enquiry">
      <input type="text" name="name" placeholder="Name" required/>
      <input type="email" name="email" placeholder="Email address"/>
      <input type="text" name="subject" placeholder="Subject"/>
      <textarea name="message" placeholder="Message..." rows="5"></textarea>
      <button type="submit">Submit</button>
    </form>
  </div>
</section>

<footer class="mk-footer">
  <p>&copy; ${new Date().getFullYear()} ${name}</p>
</footer>

<div class="mk-float">
  <a class="mk-float-btn mk-float-call" href="tel:${phone}" title="Call us">&#9742;</a>
  <a class="mk-float-btn mk-float-wa" href="https://wa.me/${phoneDigits}" target="_blank" rel="noreferrer" title="WhatsApp">&#128172;</a>
</div>`.trim();

  const css = `
.mk-header{position:sticky;top:0;z-index:40;background:#fff;box-shadow:0 1px 10px rgba(0,0,0,.07)}
.mk-header-inner{max-width:1180px;margin:0 auto;padding:14px 22px;display:flex;align-items:center;justify-content:space-between;gap:18px;flex-wrap:wrap}
.mk-brand{display:flex;align-items:center;gap:12px;text-decoration:none;color:#111;font-weight:700;font-size:19px;letter-spacing:.4px;text-transform:uppercase}
.mk-logo{width:52px;height:52px;object-fit:contain;border-radius:50%}
.mk-nav{display:flex;gap:26px}
.mk-nav a{color:#222;text-decoration:none;font-size:13px;font-weight:700;letter-spacing:1px;text-transform:uppercase}
.mk-nav a:hover{color:#e11d2e}
.mk-hero img{display:block;width:100%;max-height:620px;object-fit:cover}
.mk-hero-fallback{height:340px;display:flex;align-items:center;justify-content:center;background:#111;color:#fff;font-size:30px;font-weight:800;letter-spacing:2px;text-transform:uppercase}
.mk-section{padding:70px 22px}
.mk-section-alt{background:#f7f9fc}
.mk-section h2{text-align:center;font-size:34px;font-weight:400;letter-spacing:3px;text-transform:uppercase;color:#1a1a1a;margin:0 0 34px}
.mk-lead{max-width:820px;margin:0 auto;text-align:center;color:#555;font-size:15px;line-height:1.9}
.mk-grid{max-width:1180px;margin:0 auto;display:grid;grid-template-columns:repeat(4,1fr);gap:22px}
.mk-card{margin:0;background:#fff;overflow:hidden}
.mk-card img{display:block;width:100%;height:230px;object-fit:cover}
.mk-card figcaption{padding:12px 8px;text-align:center;font-size:13px;letter-spacing:1.2px;text-transform:uppercase;color:#333;border-bottom:1px solid #e9edf2}
.mk-card-text figcaption{display:flex;flex-direction:column;gap:6px;padding:30px 12px;border:1px solid #e9edf2}
.mk-card-text span{color:#e11d2e;font-weight:700;font-size:16px;letter-spacing:0}
.mk-prices{max-width:900px;margin:0 auto}
.mk-price-row{display:flex;justify-content:space-between;align-items:flex-start;gap:20px;padding:18px 0;border-bottom:1px solid #e9edf2}
.mk-price-row h3{margin:0 0 4px;font-size:16px;color:#1a1a1a}
.mk-price-row p{margin:0;color:#777;font-size:14px;line-height:1.6}
.mk-price-row span{color:#e11d2e;font-weight:700;font-size:17px;white-space:nowrap}
.mk-social{padding:36px 22px;text-align:center}
.mk-social a{color:#1a1a1a;font-size:17px;text-decoration:none;border-bottom:2px solid #e11d2e;padding-bottom:4px}
.mk-map-section{position:relative;padding-bottom:46px;text-align:center}
.mk-map{max-width:1100px;margin:0 auto;height:430px}
.mk-map iframe{width:100%;height:100%;border:0;display:block}
.mk-btn-map{display:inline-block;margin-top:-22px;position:relative;background:#e11d2e;color:#fff;padding:12px 34px;border-radius:4px;text-decoration:none;font-weight:600;font-size:15px}
.mk-btn-map:hover{background:#b91626}
.mk-contact-card{max-width:1140px;margin:0 auto;background:#fff;border-radius:6px;box-shadow:0 2px 18px rgba(0,0,0,.06);padding:42px;display:grid;grid-template-columns:1fr 1.4fr;gap:44px}
.mk-contact-info h3{margin:0 0 6px;font-size:16px;font-weight:700;letter-spacing:.6px;text-transform:uppercase;color:#1a1a1a}
.mk-contact-info h3+p{margin:0 0 24px;color:#555;font-size:14px;line-height:1.7}
.mk-contact-info a{color:#555;text-decoration:none}
.mk-contact-form{display:flex;flex-direction:column;gap:16px}
.mk-contact-form input,.mk-contact-form textarea{width:100%;background:#f2f4f7;border:1px solid #e6e9ee;border-radius:4px;padding:14px 16px;font-size:14px;color:#333;font-family:inherit}
.mk-contact-form input:focus,.mk-contact-form textarea:focus{outline:none;border-color:#c8cdd6;background:#fff}
.mk-contact-form textarea{resize:vertical;min-height:130px}
.mk-contact-form button{align-self:flex-start;background:#e11d2e;color:#fff;border:0;border-radius:4px;padding:13px 40px;font-size:15px;font-weight:600;cursor:pointer}
.mk-contact-form button:hover{background:#b91626}
.mk-footer{background:#fff;text-align:center;padding:22px;color:#666;font-size:14px;border-top:1px solid #eef1f5}
.mk-float{position:fixed;right:20px;bottom:24px;display:flex;flex-direction:column;gap:14px;z-index:50}
.mk-float-btn{width:56px;height:56px;border-radius:50%;display:flex;align-items:center;justify-content:center;color:#fff;font-size:26px;text-decoration:none;box-shadow:0 4px 14px rgba(0,0,0,.24)}
.mk-float-call{background:#e11d2e}
.mk-float-wa{background:#25d366}
@media(max-width:900px){.mk-grid{grid-template-columns:repeat(2,1fr)}.mk-contact-card{grid-template-columns:1fr;padding:26px;gap:30px}}
@media(max-width:560px){.mk-section{padding:46px 18px}.mk-section h2{font-size:25px}.mk-grid{gap:14px}.mk-card img{height:165px}.mk-nav{gap:16px}.mk-brand{font-size:15px}}`.trim();

  return {
    html,
    css,
    // Plain values the editor can offer as re-insertable snippets.
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
      photoCount: business.photos.length,
      serviceCount: business.services.length,
    },
  };
}
