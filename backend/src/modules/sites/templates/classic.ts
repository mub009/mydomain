import { enquiryForm, floatButtons, ICON, mapSection, SiteTemplate, slideshow } from "./shared";

/**
 * Classic — white, red-accented, sticky header with a photo slideshow hero.
 * The straightforward local-business layout most shops expect.
 */
export const classicTemplate: SiteTemplate = {
  id: "classic",
  name: "Classic",
  description: "Clean white layout with a red accent, photo slideshow and a prominent contact form.",
  accent: "#e11d2e",
  bestFor: "Most local shops and services",

  build(ctx) {
    const slides = slideshow(ctx);
    const floats = floatButtons(ctx, "#e11d2e");

    const galleryHtml = ctx.photos
      .map(
        (p) => `
        <figure class="mk-card">
          <div class="mk-card-img"><img src="${p.url}" alt="${p.caption}" loading="lazy"/></div>
          <figcaption>${p.caption}</figcaption>
        </figure>`,
      )
      .join("");

    const servicesHtml = ctx.services
      .map(
        (s) => `
      <div class="mk-service">
        <div><h3>${s.name}</h3>${s.description ? `<p>${s.description}</p>` : ""}</div>
        <span class="mk-price">${s.price}</span>
      </div>`,
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
      <a href="#about">About Us</a>
      ${ctx.photos.length ? '<a href="#gallery">Gallery</a>' : ""}
      ${ctx.services.length ? '<a href="#services">Services</a>' : ""}
      <a href="#contact">Contact Us</a>
    </nav>
    <a class="mk-header-cta" href="tel:${ctx.phone}">${ICON.phone}<span>Call Now</span></a>
  </div>
</header>

<section class="mk-hero" id="home">
  <div class="mk-track">${slides.html}</div>
  <div class="mk-hero-overlay">
    <div class="mk-hero-inner">
      ${ctx.category ? `<span class="mk-eyebrow">${ctx.category}${ctx.city ? ` in ${ctx.city}` : ""}</span>` : ""}
      <h1>${ctx.name}</h1>
      ${ctx.workingTime ? `<p class="mk-hero-hours">${ICON.clock}<span>Open ${ctx.workingTime}</span></p>` : ""}
      <div class="mk-hero-actions">
        <a class="mk-btn mk-btn-primary" href="tel:${ctx.phone}">${ICON.phone}<span>Call Now</span></a>
        <a class="mk-btn mk-btn-wa" href="${ctx.whatsappUrl}" target="_blank" rel="noreferrer">${ICON.whatsapp}<span>WhatsApp</span></a>
        <a class="mk-btn mk-btn-ghost" href="${ctx.directionsUrl}" target="_blank" rel="noreferrer">${ICON.pin}<span>Directions</span></a>
      </div>
    </div>
  </div>
</section>

<section class="mk-section" id="about">
  <h2>About Us</h2><span class="mk-rule"></span>
  <p class="mk-lead">${ctx.description}</p>
  <div class="mk-facts">
    <div class="mk-fact">${ICON.pin}<div><strong>Visit us</strong><span>${ctx.address}</span></div></div>
    ${ctx.workingTime ? `<div class="mk-fact">${ICON.clock}<div><strong>Working hours</strong><span>${ctx.workingTime}</span></div></div>` : ""}
    <div class="mk-fact">${ICON.phone}<div><strong>Call us</strong><span><a href="tel:${ctx.phone}">${ctx.phone}</a></span></div></div>
  </div>
</section>

${
  galleryHtml
    ? `<section class="mk-section mk-section-alt" id="gallery">
  <h2>Our Gallery</h2><span class="mk-rule"></span>
  <div class="mk-grid">${galleryHtml}</div>
</section>`
    : ""
}

${
  servicesHtml
    ? `<section class="mk-section" id="services">
  <h2>Our Services</h2><span class="mk-rule"></span>
  <div class="mk-services">${servicesHtml}</div>
</section>`
    : ""
}

${
  ctx.instagram
    ? `<section class="mk-social">
  <a href="https://www.instagram.com/${ctx.instagram}/" target="_blank" rel="noreferrer">${ICON.instagram}<span>Follow us on Instagram</span></a>
</section>`
    : ""
}

${mapSection(ctx)}

<section class="mk-section mk-section-alt" id="contact">
  <h2>Contact Us</h2><span class="mk-rule"></span>
  <div class="mk-contact-card">
    <div class="mk-contact-info">
      <h3>${ICON.pin}<span>Address</span></h3>
      <p>${ctx.address}</p>
      ${ctx.workingTime ? `<h3>${ICON.clock}<span>Working Time</span></h3><p>${ctx.workingTime}</p>` : ""}
      <h3>${ICON.phone}<span>Call Us</span></h3>
      <p><a href="tel:${ctx.phone}">${ctx.phone}</a></p>
      ${ctx.email ? `<h3>${ICON.mail}<span>Email</span></h3><p><a href="mailto:${ctx.email}">${ctx.email}</a></p>` : ""}
      <a class="mk-btn mk-btn-wa mk-contact-wa" href="${ctx.whatsappUrl}" target="_blank" rel="noreferrer">${ICON.whatsapp}<span>Chat on WhatsApp</span></a>
    </div>
    ${enquiryForm()}
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
.mk-hero{position:relative;overflow:hidden;height:min(78vh,620px)}
${slides.css}
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
${floats.css}
@media(max-width:1024px){.mk-grid{grid-template-columns:repeat(3,1fr)}.mk-nav{display:none}}
@media(max-width:860px){.mk-grid{grid-template-columns:repeat(2,1fr)}.mk-contact-card{grid-template-columns:1fr;padding:28px;gap:32px}.mk-header-cta span{display:none}.mk-header-cta{padding:10px 13px}}
@media(max-width:560px){.mk-hero{height:min(70vh,470px)}.mk-section{padding:52px 18px}.mk-card-img{height:150px}.mk-grid{gap:12px}.mk-btn{padding:11px 18px;font-size:13.5px}}
@media(prefers-reduced-motion:reduce){.mk-track{animation:none}.mk-card,.mk-card-img img,.mk-btn{transition:none}}`.trim();

    return { html, css };
  },
};
