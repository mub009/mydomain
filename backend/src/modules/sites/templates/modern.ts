import { enquiryForm, floatButtons, ICON, mapSection, SiteTemplate, slideshow } from "./shared";

const ACCENT = "#f5b301";

/**
 * Modern — a dark, cinematic layout. Full-bleed hero, translucent sticky
 * header and amber accents on near-black surfaces.
 */
export const modernTemplate: SiteTemplate = {
  id: "modern",
  name: "Modern Dark",
  description: "Bold dark theme with a cinematic hero, amber highlights and large statement typography.",
  accent: ACCENT,
  bestFor: "Studios, gyms, auto, electronics",

  build(ctx) {
    const slides = slideshow(ctx, { emptyClass: "mk-slide-empty" });
    const floats = floatButtons(ctx, ACCENT);

    const galleryHtml = ctx.photos
      .map(
        (p) => `
        <figure class="mk-tile">
          <img src="${p.url}" alt="${p.caption}" loading="lazy"/>
          <figcaption>${p.caption}</figcaption>
        </figure>`,
      )
      .join("");

    const servicesHtml = ctx.services
      .map(
        (s, i) => `
      <div class="mk-service">
        <span class="mk-service-no">${String(i + 1).padStart(2, "0")}</span>
        <div class="mk-service-body">
          <h3>${s.name}</h3>
          ${s.description ? `<p>${s.description}</p>` : ""}
        </div>
        <span class="mk-price">${s.price}</span>
      </div>`,
      )
      .join("");

    const hoursHtml = ctx.hours
      .map(
        (h) => `
      <li${h.closed ? ' class="mk-closed"' : ""}><span>${h.day}</span><span>${h.value}</span></li>`,
      )
      .join("");

    const html = `
<header class="mk-header">
  <div class="mk-header-inner">
    <a class="mk-brand" href="#home">
      ${ctx.logoHtml}
      <span class="mk-brand-text">
        <strong>${ctx.name}</strong>
        ${ctx.category ? `<small>${ctx.category}${ctx.city ? ` · ${ctx.city}` : ""}</small>` : ""}
      </span>
    </a>
    <nav class="mk-nav">
      <a href="#home">Home</a>
      <a href="#about">About</a>
      ${ctx.photos.length ? '<a href="#gallery">Work</a>' : ""}
      ${ctx.services.length ? '<a href="#services">Services</a>' : ""}
      <a href="#contact">Contact</a>
    </nav>
    <a class="mk-header-cta" href="tel:${ctx.phone}">${ICON.phone}<span>${ctx.phone}</span></a>
  </div>
</header>

<section class="mk-hero" id="home">
  <div class="mk-track">${slides.html}</div>
  <div class="mk-hero-overlay">
    <div class="mk-hero-inner">
      ${ctx.category ? `<span class="mk-eyebrow">${ctx.category}${ctx.city ? ` · ${ctx.city}` : ""}</span>` : ""}
      <h1>${ctx.name}</h1>
      <p class="mk-hero-sub">${ctx.description}</p>
      ${
        ctx.rating
          ? `<p class="mk-hero-rating">${ICON.star}<strong>${ctx.rating}</strong><span>${ctx.reviewCount} review${ctx.reviewCount === 1 ? "" : "s"}</span></p>`
          : ""
      }
      <div class="mk-hero-actions">
        <a class="mk-btn mk-btn-primary" href="tel:${ctx.phone}">${ICON.phone}<span>Call Now</span></a>
        <a class="mk-btn mk-btn-wa" href="${ctx.whatsappUrl}" target="_blank" rel="noreferrer">${ICON.whatsapp}<span>WhatsApp</span></a>
        <a class="mk-btn mk-btn-ghost" href="${ctx.directionsUrl}" target="_blank" rel="noreferrer">${ICON.pin}<span>Directions</span></a>
      </div>
    </div>
  </div>
</section>

<section class="mk-strip">
  <div class="mk-strip-item">${ICON.pin}<div><strong>Find us</strong><span>${ctx.address}</span></div></div>
  ${ctx.workingTime ? `<div class="mk-strip-item">${ICON.clock}<div><strong>Open</strong><span>${ctx.workingTime}</span></div></div>` : ""}
  <div class="mk-strip-item">${ICON.phone}<div><strong>Talk to us</strong><span><a href="tel:${ctx.phone}">${ctx.phone}</a></span></div></div>
</section>

<section class="mk-section" id="about">
  <span class="mk-kicker">About</span>
  <h2>Why choose ${ctx.name}</h2>
  <p class="mk-lead">${ctx.description}</p>
</section>

${
  galleryHtml
    ? `<section class="mk-section mk-section-wide" id="gallery">
  <span class="mk-kicker">Gallery</span>
  <h2>Our work</h2>
  <div class="mk-mosaic">${galleryHtml}</div>
</section>`
    : ""
}

${
  servicesHtml
    ? `<section class="mk-section" id="services">
  <span class="mk-kicker">Services</span>
  <h2>What we offer</h2>
  <div class="mk-services">${servicesHtml}</div>
</section>`
    : ""
}

${
  hoursHtml
    ? `<section class="mk-section mk-section-narrow" id="hours">
  <span class="mk-kicker">Timings</span>
  <h2>Opening hours</h2>
  <ul class="mk-hours">${hoursHtml}</ul>
</section>`
    : ""
}

${
  ctx.instagram
    ? `<section class="mk-social">
  <a href="https://www.instagram.com/${ctx.instagram}/" target="_blank" rel="noreferrer">${ICON.instagram}<span>@${ctx.instagram}</span></a>
</section>`
    : ""
}

${mapSection(ctx, "Get Directions")}

<section class="mk-section mk-section-wide" id="contact">
  <span class="mk-kicker">Contact</span>
  <h2>Send us a message</h2>
  <div class="mk-contact-card">
    <div class="mk-contact-info">
      <h3>${ICON.pin}<span>Address</span></h3>
      <p>${ctx.address}</p>
      ${ctx.workingTime ? `<h3>${ICON.clock}<span>Working Time</span></h3><p>${ctx.workingTime}</p>` : ""}
      <h3>${ICON.phone}<span>Phone</span></h3>
      <p><a href="tel:${ctx.phone}">${ctx.phone}</a></p>
      ${ctx.email ? `<h3>${ICON.mail}<span>Email</span></h3><p><a href="mailto:${ctx.email}">${ctx.email}</a></p>` : ""}
      <a class="mk-btn mk-btn-wa mk-contact-wa" href="${ctx.whatsappUrl}" target="_blank" rel="noreferrer">${ICON.whatsapp}<span>Chat on WhatsApp</span></a>
    </div>
    ${enquiryForm("Send Message")}
  </div>
</section>

<footer class="mk-footer">
  <div class="mk-footer-inner">
    <p class="mk-footer-name">${ctx.name}</p>
    <p>${ctx.address}</p>
    <p><a href="tel:${ctx.phone}">${ctx.phone}</a>${ctx.email ? ` · <a href="mailto:${ctx.email}">${ctx.email}</a>` : ""}</p>
    <p class="mk-footer-copy">&copy; ${ctx.year} ${ctx.name}. All rights reserved.</p>
  </div>
</footer>

${floats.html}`.trim();

    const css = `
:root{--mk-accent:${ACCENT};--mk-bg:#0d1015;--mk-surface:#161b22;--mk-line:#242c37;--mk-muted:#9aa6b6}
#mk-site-root{background:var(--mk-bg);color:#e8edf4}
.mk-header{position:sticky;top:0;z-index:40;background:rgba(13,16,21,.92);border-bottom:1px solid var(--mk-line)}
.mk-header-inner{max-width:1240px;margin:0 auto;padding:12px 24px;display:flex;align-items:center;gap:20px}
.mk-brand{display:flex;align-items:center;gap:12px;text-decoration:none;color:#fff;margin-right:auto}
.mk-logo{width:48px;height:48px;object-fit:cover;border-radius:12px;flex:0 0 auto;border:1px solid var(--mk-line)}
.mk-logo-text{display:flex;align-items:center;justify-content:center;background:var(--mk-accent);color:#0d1015;font-size:21px;font-weight:800}
.mk-brand-text{display:flex;flex-direction:column;line-height:1.25}
.mk-brand-text strong{font-size:17px;font-weight:800;letter-spacing:.6px;text-transform:uppercase}
.mk-brand-text small{font-size:11.5px;color:var(--mk-muted);letter-spacing:.7px;text-transform:uppercase}
.mk-nav{display:flex;gap:28px}
.mk-nav a{color:#c3cddb;text-decoration:none;font-size:12.5px;font-weight:700;letter-spacing:1.2px;text-transform:uppercase}
.mk-nav a:hover{color:var(--mk-accent)}
.mk-header-cta{display:inline-flex;align-items:center;gap:8px;border:1px solid var(--mk-accent);color:var(--mk-accent);text-decoration:none;padding:9px 18px;border-radius:8px;font-size:13px;font-weight:700}
.mk-header-cta svg{width:15px;height:15px}
.mk-header-cta:hover{background:var(--mk-accent);color:#0d1015}
.mk-hero{position:relative;overflow:hidden;height:min(88vh,700px)}
${slides.css}
.mk-slide img{width:100%;height:100%;object-fit:cover;display:block}
.mk-slide-empty{display:flex;align-items:center;justify-content:center;background:radial-gradient(circle at 30% 30%,#232b36,#0d1015)}
.mk-slide-empty span{font-size:34px;font-weight:800;letter-spacing:3px;text-transform:uppercase;color:var(--mk-accent)}
.mk-hero-overlay{position:absolute;inset:0;display:flex;align-items:flex-end;background:linear-gradient(180deg,rgba(13,16,21,.35) 0%,rgba(13,16,21,.72) 55%,var(--mk-bg) 100%)}
.mk-hero-inner{max-width:1240px;margin:0 auto;padding:0 26px 76px;width:100%}
.mk-eyebrow{display:inline-block;color:var(--mk-accent);font-size:12px;font-weight:800;letter-spacing:2.4px;text-transform:uppercase;margin-bottom:14px}
.mk-hero h1{margin:0 0 16px;font-size:clamp(34px,6.4vw,76px);line-height:1.02;font-weight:800;letter-spacing:-1.5px;color:#fff;max-width:15ch}
.mk-hero-sub{margin:0 0 18px;max-width:60ch;color:#c3cddb;font-size:16px;line-height:1.8}
.mk-hero-rating{display:inline-flex;align-items:center;gap:8px;margin:0 0 24px;color:#fff;font-size:14.5px}
.mk-hero-rating svg{width:17px;height:17px;color:var(--mk-accent)}
.mk-hero-rating span{color:var(--mk-muted)}
.mk-hero-actions{display:flex;flex-wrap:wrap;gap:12px}
.mk-btn{display:inline-flex;align-items:center;gap:9px;padding:14px 28px;border-radius:8px;text-decoration:none;font-size:14.5px;font-weight:700;transition:transform .15s,background .15s}
.mk-btn svg{width:17px;height:17px}
.mk-btn:hover{transform:translateY(-2px)}
.mk-btn-primary{background:var(--mk-accent);color:#0d1015}
.mk-btn-primary:hover{background:#ffc933}
.mk-btn-wa{background:#25d366;color:#04240f}
.mk-btn-wa:hover{background:#3ae57c}
.mk-btn-ghost{background:transparent;color:#fff;border:1px solid rgba(255,255,255,.32)}
.mk-btn-ghost:hover{background:rgba(255,255,255,.1)}
.mk-strip{max-width:1240px;margin:-34px auto 0;position:relative;z-index:5;padding:0 24px;display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:1px;background:var(--mk-line);border:1px solid var(--mk-line);border-radius:14px;overflow:hidden}
.mk-strip-item{display:flex;gap:13px;background:var(--mk-surface);padding:22px 24px}
.mk-strip-item svg{width:19px;height:19px;color:var(--mk-accent);flex:0 0 auto;margin-top:3px}
.mk-strip-item strong{display:block;font-size:11.5px;letter-spacing:1.2px;text-transform:uppercase;color:var(--mk-accent);margin-bottom:5px}
.mk-strip-item span{font-size:14px;color:#d3dbe6;line-height:1.6}
.mk-strip-item a{color:#d3dbe6;text-decoration:none}
.mk-section{padding:88px 24px;max-width:1000px;margin:0 auto}
.mk-section-wide{max-width:1240px}
.mk-section-narrow{max-width:700px}
.mk-kicker{display:block;color:var(--mk-accent);font-size:12px;font-weight:800;letter-spacing:2.6px;text-transform:uppercase;margin-bottom:10px}
.mk-section h2{margin:0 0 26px;font-size:clamp(26px,4vw,42px);font-weight:800;letter-spacing:-.8px;color:#fff;line-height:1.15}
.mk-lead{margin:0;color:var(--mk-muted);font-size:16px;line-height:1.95;max-width:72ch}
.mk-mosaic{display:grid;grid-template-columns:repeat(3,1fr);gap:14px}
.mk-tile{margin:0;position:relative;border-radius:14px;overflow:hidden;background:var(--mk-surface);aspect-ratio:4/3}
.mk-tile img{width:100%;height:100%;object-fit:cover;display:block;transition:transform .4s}
.mk-tile:hover img{transform:scale(1.06)}
.mk-tile figcaption{position:absolute;left:0;right:0;bottom:0;padding:26px 16px 13px;background:linear-gradient(180deg,transparent,rgba(6,8,11,.9));color:#fff;font-size:12.5px;font-weight:600;letter-spacing:.7px}
.mk-services{display:grid;gap:1px;background:var(--mk-line);border:1px solid var(--mk-line);border-radius:14px;overflow:hidden}
.mk-service{display:flex;align-items:flex-start;gap:20px;background:var(--mk-surface);padding:24px 26px;transition:background .2s}
.mk-service:hover{background:#1c232d}
.mk-service-no{color:var(--mk-accent);font-size:13px;font-weight:800;letter-spacing:1px;padding-top:3px}
.mk-service-body{flex:1}
.mk-service h3{margin:0 0 5px;font-size:17px;color:#fff;font-weight:700}
.mk-service p{margin:0;color:var(--mk-muted);font-size:14px;line-height:1.7}
.mk-price{color:var(--mk-accent);font-weight:800;font-size:17.5px;white-space:nowrap}
.mk-hours{list-style:none;margin:0;padding:0;border:1px solid var(--mk-line);border-radius:14px;overflow:hidden}
.mk-hours li{display:flex;justify-content:space-between;gap:16px;padding:15px 22px;background:var(--mk-surface);font-size:14.5px;border-bottom:1px solid var(--mk-line)}
.mk-hours li:last-child{border-bottom:0}
.mk-hours li span:first-child{color:#d3dbe6;font-weight:600}
.mk-hours li span:last-child{color:var(--mk-accent)}
.mk-hours .mk-closed span:last-child{color:#7b8798}
.mk-social{padding:20px 24px 60px;text-align:center}
.mk-social a{display:inline-flex;align-items:center;gap:11px;color:#fff;font-size:15.5px;font-weight:600;text-decoration:none;padding:13px 30px;border:1px solid var(--mk-line);border-radius:999px;background:var(--mk-surface)}
.mk-social svg{width:20px;height:20px;color:#e1306c}
.mk-social a:hover{border-color:#e1306c}
.mk-map-section{position:relative;padding-bottom:56px;text-align:center;background:var(--mk-surface)}
.mk-map{max-width:1240px;margin:0 auto;height:440px;filter:grayscale(.35) contrast(1.05)}
.mk-map iframe{width:100%;height:100%;border:0;display:block}
.mk-btn-map{display:inline-flex;align-items:center;gap:9px;margin-top:-24px;position:relative;background:var(--mk-accent);color:#0d1015;padding:14px 32px;border-radius:8px;text-decoration:none;font-weight:700;font-size:14.5px}
.mk-btn-map svg{width:16px;height:16px}
.mk-btn-map:hover{background:#ffc933}
.mk-contact-card{display:grid;grid-template-columns:1fr 1.3fr;gap:46px;background:var(--mk-surface);border:1px solid var(--mk-line);border-radius:16px;padding:44px}
.mk-contact-info h3{display:flex;align-items:center;gap:9px;margin:0 0 7px;font-size:12.5px;font-weight:800;letter-spacing:1.3px;text-transform:uppercase;color:var(--mk-accent)}
.mk-contact-info h3 svg{width:15px;height:15px}
.mk-contact-info h3+p{margin:0 0 24px;color:#d3dbe6;font-size:14.5px;line-height:1.7}
.mk-contact-info a{color:#d3dbe6;text-decoration:none}
.mk-contact-info a:hover{color:var(--mk-accent)}
.mk-contact-wa{margin-top:6px}
.mk-contact-form{display:flex;flex-direction:column;gap:14px}
.mk-contact-form input,.mk-contact-form textarea{width:100%;background:#0f141a;border:1px solid var(--mk-line);border-radius:8px;padding:14px 16px;font-size:14.5px;color:#e8edf4;font-family:inherit}
.mk-contact-form input::placeholder,.mk-contact-form textarea::placeholder{color:#6f7c8d}
.mk-contact-form input:focus,.mk-contact-form textarea:focus{outline:none;border-color:var(--mk-accent)}
.mk-contact-form textarea{resize:vertical;min-height:130px}
.mk-contact-form button{align-self:flex-start;background:var(--mk-accent);color:#0d1015;border:0;border-radius:8px;padding:14px 40px;font-size:15px;font-weight:800;cursor:pointer}
.mk-contact-form button:hover{background:#ffc933}
.mk-footer{border-top:1px solid var(--mk-line);text-align:center;padding:46px 24px;color:var(--mk-muted)}
.mk-footer-inner{max-width:760px;margin:0 auto;display:grid;gap:7px;font-size:14px;line-height:1.7}
.mk-footer-name{color:#fff;font-size:18px;font-weight:800;letter-spacing:1.4px;text-transform:uppercase;margin:0 0 4px}
.mk-footer a{color:#c3cddb;text-decoration:none}
.mk-footer a:hover{color:var(--mk-accent)}
.mk-footer-copy{margin-top:14px;padding-top:16px;border-top:1px solid var(--mk-line);font-size:12.5px;color:#6f7c8d}
${floats.css}
@media(max-width:1024px){.mk-nav{display:none}.mk-mosaic{grid-template-columns:repeat(2,1fr)}}
@media(max-width:860px){.mk-contact-card{grid-template-columns:1fr;padding:28px;gap:30px}.mk-header-cta span{display:none}.mk-header-cta{padding:9px 12px}}
@media(max-width:560px){.mk-hero{height:min(80vh,540px)}.mk-hero-inner{padding-bottom:52px}.mk-section{padding:56px 18px}.mk-mosaic{grid-template-columns:1fr;gap:10px}.mk-strip{margin-top:-18px}.mk-service{flex-wrap:wrap;gap:12px}.mk-btn{padding:12px 20px;font-size:13.5px}}
@media(prefers-reduced-motion:reduce){.mk-track{animation:none}.mk-tile img,.mk-btn{transition:none}}`.trim();

    return { html, css };
  },
};
