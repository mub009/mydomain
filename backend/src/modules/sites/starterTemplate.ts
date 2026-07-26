import { Business, BusinessHours, BusinessPhoto, Category, Service } from "@prisma/client";

type BusinessWithDetails = Business & {
  category: Category | null;
  photos: BusinessPhoto[];
  hours: BusinessHours[];
  services: Service[];
};

const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

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
  const period = h >= 12 ? "PM" : "AM";
  const hour = h % 12 === 0 ? 12 : h % 12;
  return `${hour}:${String(m ?? 0).padStart(2, "0")} ${period}`;
}

/**
 * Builds the first draft of a business's website from the data they already
 * entered in their listing. The owner edits this in the builder afterwards;
 * it is only a starting point, never overwritten once they save.
 */
export function buildStarterTemplate(business: BusinessWithDetails) {
  const name = escapeHtml(business.name);
  const tagline = escapeHtml(business.category?.name ? `${business.category.name} in ${business.city}` : business.city);
  const description = escapeHtml(
    business.description || `Welcome to ${business.name}. Visit us in ${business.city} — we look forward to serving you.`,
  );
  const address = escapeHtml(
    [business.addressLine1, business.addressLine2, business.city, business.state, business.postalCode]
      .filter(Boolean)
      .join(", "),
  );
  const phone = escapeHtml(business.phone);
  const email = escapeHtml(business.email);
  const hero = business.photos[0]?.url ?? business.coverImageUrl ?? "";

  const galleryHtml = business.photos
    .slice(0, 6)
    .map(
      (photo) =>
        `<div class="mk-gallery-item"><img src="${escapeHtml(photo.url)}" alt="${escapeHtml(photo.caption || business.name)}"/></div>`,
    )
    .join("");

  const servicesHtml = business.services
    .map(
      (service) => `
        <div class="mk-service">
          <h3>${escapeHtml(service.name)}</h3>
          ${service.description ? `<p>${escapeHtml(service.description)}</p>` : ""}
          <span class="mk-price">${formatPrice(service.priceCents, service.currency)}</span>
        </div>`,
    )
    .join("");

  const hoursHtml = business.hours
    .map(
      (hour) => `
        <li>
          <span>${DAY_NAMES[hour.dayOfWeek]}</span>
          <strong>${hour.isClosed ? "Closed" : `${to12Hour(hour.openTime)} – ${to12Hour(hour.closeTime)}`}</strong>
        </li>`,
    )
    .join("");

  const html = `
<section class="mk-hero"${hero ? ` style="background-image:linear-gradient(rgba(6,44,30,.62),rgba(6,44,30,.62)),url('${escapeHtml(hero)}')"` : ""}>
  <div class="mk-hero-inner">
    <h1>${name}</h1>
    <p class="mk-tagline">${tagline}</p>
    <a class="mk-btn" href="tel:${phone}">Call ${phone}</a>
  </div>
</section>

<section class="mk-section">
  <h2>About us</h2>
  <p class="mk-lead">${description}</p>
</section>

${
  servicesHtml
    ? `<section class="mk-section mk-section-alt">
  <h2>What we offer</h2>
  <div class="mk-services">${servicesHtml}</div>
</section>`
    : ""
}

${
  galleryHtml
    ? `<section class="mk-section">
  <h2>Gallery</h2>
  <div class="mk-gallery">${galleryHtml}</div>
</section>`
    : ""
}

<section class="mk-section mk-section-alt">
  <div class="mk-columns">
    <div>
      <h2>Visit us</h2>
      <p>${address}</p>
      <p><strong>Phone:</strong> <a href="tel:${phone}">${phone}</a></p>
      ${email ? `<p><strong>Email:</strong> <a href="mailto:${email}">${email}</a></p>` : ""}
    </div>
    ${hoursHtml ? `<div><h2>Opening hours</h2><ul class="mk-hours">${hoursHtml}</ul></div>` : ""}
  </div>
</section>

<footer class="mk-footer">
  <p>&copy; ${new Date().getFullYear()} ${name}. All rights reserved.</p>
</footer>`.trim();

  const css = `
.mk-hero{background:#0f5132;background-size:cover;background-position:center;color:#fff;padding:96px 24px;text-align:center}
.mk-hero-inner{max-width:760px;margin:0 auto}
.mk-hero h1{font-size:44px;line-height:1.1;margin:0 0 12px;font-weight:800}
.mk-tagline{font-size:18px;opacity:.9;margin:0 0 24px}
.mk-btn{display:inline-block;background:#16a34a;color:#fff;padding:14px 32px;border-radius:9999px;text-decoration:none;font-weight:700}
.mk-btn:hover{background:#15803d}
.mk-section{padding:64px 24px;max-width:1080px;margin:0 auto}
.mk-section-alt{background:#f6faf7;max-width:none}
.mk-section h2{font-size:30px;font-weight:800;margin:0 0 20px;color:#0f172a;text-align:center}
.mk-lead{font-size:17px;line-height:1.7;color:#475569;max-width:760px;margin:0 auto;text-align:center}
.mk-services{display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:20px;max-width:1080px;margin:0 auto}
.mk-service{background:#fff;border:1px solid #e2e8f0;border-radius:14px;padding:22px}
.mk-service h3{margin:0 0 8px;font-size:18px;color:#0f172a}
.mk-service p{margin:0 0 12px;color:#64748b;font-size:14px;line-height:1.6}
.mk-price{font-weight:800;color:#16a34a;font-size:18px}
.mk-gallery{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:14px}
.mk-gallery-item img{width:100%;height:200px;object-fit:cover;border-radius:12px;display:block}
.mk-columns{display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:40px;max-width:1080px;margin:0 auto}
.mk-columns p{color:#475569;line-height:1.7;margin:0 0 10px}
.mk-columns a{color:#16a34a;text-decoration:none}
.mk-hours{list-style:none;padding:0;margin:0}
.mk-hours li{display:flex;justify-content:space-between;padding:9px 0;border-bottom:1px solid #e2e8f0;color:#475569}
.mk-footer{background:#0f172a;color:#94a3b8;text-align:center;padding:28px 24px;font-size:14px}
@media(max-width:640px){.mk-hero{padding:64px 20px}.mk-hero h1{font-size:32px}.mk-section{padding:44px 20px}}`.trim();

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
      photoCount: business.photos.length,
      serviceCount: business.services.length,
    },
  };
}
