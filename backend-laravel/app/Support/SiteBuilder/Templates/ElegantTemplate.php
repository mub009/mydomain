<?php

namespace App\Support\SiteBuilder\Templates;

use App\Support\SiteBuilder\Helpers;
use App\Support\SiteBuilder\Icons;

/**
 * Elegant — warm ivory surfaces, serif headings and a gold accent, with the
 * hero split between an introduction and the photo slideshow.
 */
class ElegantTemplate
{
    public const ID = 'elegant';

    private const ACCENT = '#b08d5a';

    public static function meta(): array
    {
        return [
            'id' => self::ID,
            'name' => 'Elegant',
            'description' => 'Refined serif design on warm ivory with a gold accent and a split introduction hero.',
            'accent' => self::ACCENT,
            'bestFor' => 'Salons, boutiques, restaurants, clinics',
        ];
    }

    public static function build(array $ctx): array
    {
        $slides = Helpers::slideshow($ctx, 'mk-slide-empty');
        $floats = Helpers::floatButtons($ctx, self::ACCENT);
        $accent = self::ACCENT;
        $phone = Icons::PHONE;
        $whatsapp = Icons::WHATSAPP;
        $pin = Icons::PIN;
        $clock = Icons::CLOCK;
        $mail = Icons::MAIL;
        $instagram = Icons::INSTAGRAM;

        $galleryHtml = collect($ctx['photos'])->map(fn ($p) => <<<HTML
                <figure class="mk-frame">
                  <img src="{$p['url']}" alt="{$p['caption']}" loading="lazy"/>
                  <figcaption>{$p['caption']}</figcaption>
                </figure>
            HTML)->implode('');

        $servicesHtml = collect($ctx['services'])->map(function ($s) {
            $desc = $s['description'] ? "<p>{$s['description']}</p>" : '';

            return <<<HTML
              <div class="mk-service">
                <div class="mk-service-head">
                  <h3>{$s['name']}</h3>
                  <span class="mk-dots"></span>
                  <span class="mk-price">{$s['price']}</span>
                </div>
                {$desc}
              </div>
            HTML;
        })->implode('');

        $hoursHtml = collect($ctx['hours'])->map(function ($h) {
            $cls = $h['closed'] ? ' class="mk-closed"' : '';

            return "<li{$cls}><span>{$h['day']}</span><span>{$h['value']}</span></li>";
        })->implode('');

        $categoryLine = $ctx['category'] ? '<small>'.$ctx['category'].($ctx['city'] ? " · {$ctx['city']}" : '').'</small>' : '';
        $navGallery = count($ctx['photos']) ? '<a href="#gallery">Gallery</a>' : '';
        $navServices = count($ctx['services']) ? '<a href="#services">Menu</a>' : '';
        $heroEyebrow = $ctx['category'] ? '<span class="mk-eyebrow">'.$ctx['category'].($ctx['city'] ? " · {$ctx['city']}" : '').'</span>' : '';
        $heroHours = $ctx['workingTime'] ? "<p class=\"mk-hero-hours\">{$clock}<span>{$ctx['workingTime']}</span></p>" : '';
        $aboutHeading = $ctx['city'] ? "Proudly serving {$ctx['city']}" : 'About us';
        $workingFact = $ctx['workingTime'] ? "<div class=\"mk-fact\">{$clock}<strong>Hours</strong><span>{$ctx['workingTime']}</span></div>" : '';
        $gallerySection = $galleryHtml ? <<<HTML
            <section class="mk-section mk-section-alt mk-section-wide" id="gallery">
              <span class="mk-kicker">Gallery</span>
              <h2>A look inside</h2>
              <span class="mk-flourish mk-center"></span>
              <div class="mk-frames">{$galleryHtml}</div>
            </section>
            HTML : '';
        $servicesSection = $servicesHtml ? <<<HTML
            <section class="mk-section" id="services">
              <span class="mk-kicker">What we offer</span>
              <h2>Our menu</h2>
              <span class="mk-flourish mk-center"></span>
              <div class="mk-services">{$servicesHtml}</div>
            </section>
            HTML : '';
        $hoursSection = $hoursHtml ? <<<HTML
            <section class="mk-section mk-section-alt mk-section-narrow" id="hours">
              <span class="mk-kicker">Timings</span>
              <h2>When to visit</h2>
              <span class="mk-flourish mk-center"></span>
              <ul class="mk-hours">{$hoursHtml}</ul>
            </section>
            HTML : '';
        $socialSection = $ctx['instagram'] ? <<<HTML
            <section class="mk-social">
              <a href="https://www.instagram.com/{$ctx['instagram']}/" target="_blank" rel="noreferrer">{$instagram}<span>Follow @{$ctx['instagram']}</span></a>
            </section>
            HTML : '';
        $mapSection = Helpers::mapSection($ctx, 'Find Us');
        $contactHours = $ctx['workingTime'] ? "<h3>{$clock}<span>Working Time</span></h3><p>{$ctx['workingTime']}</p>" : '';
        $contactEmail = $ctx['email'] ? "<h3>{$mail}<span>Email</span></h3><p><a href=\"mailto:{$ctx['email']}\">{$ctx['email']}</a></p>" : '';
        $enquiryForm = Helpers::enquiryForm('Send Enquiry');
        $footerEmail = $ctx['email'] ? " · <a href=\"mailto:{$ctx['email']}\">{$ctx['email']}</a>" : '';

        $html = <<<HTML
        <header class="mk-header">
          <div class="mk-header-inner">
            <a class="mk-brand" href="#home">
              {$ctx['logoHtml']}
              <span class="mk-brand-text">
                <strong>{$ctx['name']}</strong>
                {$categoryLine}
              </span>
            </a>
            <nav class="mk-nav">
              <a href="#home">Home</a>
              <a href="#about">Our Story</a>
              {$navGallery}
              {$navServices}
              <a href="#contact">Visit</a>
            </nav>
            <a class="mk-header-cta" href="tel:{$ctx['phone']}">{$phone}<span>Reserve</span></a>
          </div>
        </header>

        <section class="mk-hero-split" id="home">
          <div class="mk-hero-copy">
            {$heroEyebrow}
            <h1>{$ctx['name']}</h1>
            <span class="mk-flourish"></span>
            <p class="mk-hero-sub">{$ctx['description']}</p>
            {$heroHours}
            <div class="mk-hero-actions">
              <a class="mk-btn mk-btn-primary" href="tel:{$ctx['phone']}">{$phone}<span>Call Us</span></a>
              <a class="mk-btn mk-btn-outline" href="{$ctx['whatsappUrl']}" target="_blank" rel="noreferrer">{$whatsapp}<span>WhatsApp</span></a>
            </div>
          </div>
          <div class="mk-hero">
            <div class="mk-track">{$slides['html']}</div>
          </div>
        </section>

        <section class="mk-section" id="about">
          <span class="mk-kicker">Our Story</span>
          <h2>{$aboutHeading}</h2>
          <span class="mk-flourish mk-center"></span>
          <p class="mk-lead">{$ctx['description']}</p>
          <div class="mk-facts">
            <div class="mk-fact">{$pin}<strong>Address</strong><span>{$ctx['address']}</span></div>
            {$workingFact}
            <div class="mk-fact">{$phone}<strong>Reservations</strong><span><a href="tel:{$ctx['phone']}">{$ctx['phone']}</a></span></div>
          </div>
        </section>

        {$gallerySection}

        {$servicesSection}

        {$hoursSection}

        {$socialSection}

        {$mapSection}

        <section class="mk-section mk-section-wide" id="contact">
          <span class="mk-kicker">Contact</span>
          <h2>Get in touch</h2>
          <span class="mk-flourish mk-center"></span>
          <div class="mk-contact-card">
            <div class="mk-contact-info">
              <h3>{$pin}<span>Address</span></h3>
              <p>{$ctx['address']}</p>
              {$contactHours}
              <h3>{$phone}<span>Call Us</span></h3>
              <p><a href="tel:{$ctx['phone']}">{$ctx['phone']}</a></p>
              {$contactEmail}
              <a class="mk-btn mk-btn-outline mk-contact-wa" href="{$ctx['whatsappUrl']}" target="_blank" rel="noreferrer">{$whatsapp}<span>Chat on WhatsApp</span></a>
            </div>
            {$enquiryForm}
          </div>
        </section>

        <footer class="mk-footer">
          <div class="mk-footer-inner">
            <p class="mk-footer-name">{$ctx['name']}</p>
            <span class="mk-flourish mk-center"></span>
            <p>{$ctx['address']}</p>
            <p><a href="tel:{$ctx['phone']}">{$ctx['phone']}</a>{$footerEmail}</p>
            <p class="mk-footer-copy">&copy; {$ctx['year']} {$ctx['name']}. All rights reserved.</p>
          </div>
        </footer>

        {$floats['html']}
        HTML;

        $slidesCss = $slides['css'];
        $floatsCss = $floats['css'];

        $css = <<<CSS
        :root{--mk-accent:{$accent};--mk-ink:#2a251f;--mk-muted:#7a7267;--mk-cream:#faf7f2;--mk-line:#e6ddce}
        #mk-site-root{background:var(--mk-cream);color:var(--mk-ink)}
        #mk-site-root h1,#mk-site-root h2,#mk-site-root h3{font-family:Georgia,"Times New Roman",serif;font-weight:400}
        .mk-header{position:sticky;top:0;z-index:40;background:rgba(250,247,242,.95);border-bottom:1px solid var(--mk-line)}
        .mk-header-inner{max-width:1200px;margin:0 auto;padding:14px 24px;display:flex;align-items:center;gap:20px}
        .mk-brand{display:flex;align-items:center;gap:13px;text-decoration:none;color:var(--mk-ink);margin-right:auto}
        .mk-logo{width:50px;height:50px;object-fit:cover;border-radius:50%;flex:0 0 auto;border:1px solid var(--mk-line)}
        .mk-logo-text{display:flex;align-items:center;justify-content:center;background:var(--mk-accent);color:#fff;font-family:Georgia,serif;font-size:22px}
        .mk-brand-text{display:flex;flex-direction:column;line-height:1.3}
        .mk-brand-text strong{font-family:Georgia,serif;font-size:19px;font-weight:400;letter-spacing:1.6px}
        .mk-brand-text small{font-size:10.5px;color:var(--mk-muted);letter-spacing:2px;text-transform:uppercase}
        .mk-nav{display:flex;gap:30px}
        .mk-nav a{color:var(--mk-ink);text-decoration:none;font-size:11.5px;font-weight:600;letter-spacing:2px;text-transform:uppercase}
        .mk-nav a:hover{color:var(--mk-accent)}
        .mk-header-cta{display:inline-flex;align-items:center;gap:8px;background:var(--mk-accent);color:#fff;text-decoration:none;padding:11px 24px;font-size:11.5px;font-weight:700;letter-spacing:1.6px;text-transform:uppercase}
        .mk-header-cta svg{width:14px;height:14px}
        .mk-header-cta:hover{background:#96754a}
        .mk-hero-split{display:grid;grid-template-columns:1fr 1fr;min-height:min(84vh,640px);background:#fff}
        .mk-hero-copy{display:flex;flex-direction:column;justify-content:center;padding:70px clamp(26px,5vw,76px)}
        .mk-eyebrow{color:var(--mk-accent);font-size:11px;font-weight:700;letter-spacing:3px;text-transform:uppercase;margin-bottom:18px}
        .mk-hero-split h1{margin:0;font-size:clamp(34px,4.6vw,62px);line-height:1.08;letter-spacing:-.5px}
        .mk-flourish{display:block;width:64px;height:1px;background:var(--mk-accent);margin:24px 0;position:relative}
        .mk-flourish::after{content:"";position:absolute;left:28px;top:-3px;width:7px;height:7px;background:var(--mk-accent);transform:rotate(45deg)}
        .mk-center{margin-left:auto;margin-right:auto}
        .mk-hero-sub{margin:0 0 22px;color:var(--mk-muted);font-size:16px;line-height:1.95;max-width:52ch}
        .mk-hero-hours{display:inline-flex;align-items:center;gap:9px;margin:0 0 28px;color:var(--mk-ink);font-size:14px}
        .mk-hero-hours svg{width:16px;height:16px;color:var(--mk-accent)}
        .mk-hero-actions{display:flex;flex-wrap:wrap;gap:12px}
        .mk-btn{display:inline-flex;align-items:center;gap:9px;padding:14px 30px;text-decoration:none;font-size:11.5px;font-weight:700;letter-spacing:1.8px;text-transform:uppercase;transition:background .18s,color .18s}
        .mk-btn svg{width:15px;height:15px}
        .mk-btn-primary{background:var(--mk-accent);color:#fff}
        .mk-btn-primary:hover{background:#96754a}
        .mk-btn-outline{background:transparent;color:var(--mk-ink);border:1px solid var(--mk-accent)}
        .mk-btn-outline:hover{background:var(--mk-accent);color:#fff}
        .mk-hero{position:relative;overflow:hidden;min-height:340px}
        {$slidesCss}
        .mk-slide img{width:100%;height:100%;object-fit:cover;display:block}
        .mk-slide-empty{display:flex;align-items:center;justify-content:center;background:linear-gradient(135deg,#efe7da,#d9cbb2)}
        .mk-slide-empty span{font-family:Georgia,serif;font-size:30px;letter-spacing:3px;color:#8a7657;text-transform:uppercase}
        .mk-section{padding:88px 24px;max-width:960px;margin:0 auto;text-align:center}
        .mk-section-wide{max-width:1200px}
        .mk-section-narrow{max-width:640px}
        .mk-section-alt{background:#fff;max-width:none}
        .mk-section-alt>*{max-width:1200px;margin-left:auto;margin-right:auto}
        .mk-kicker{display:block;color:var(--mk-accent);font-size:11px;font-weight:700;letter-spacing:3px;text-transform:uppercase;margin-bottom:12px}
        .mk-section h2{margin:0;font-size:clamp(27px,3.6vw,42px);letter-spacing:-.3px}
        .mk-lead{margin:0 auto;max-width:70ch;color:var(--mk-muted);font-size:16px;line-height:2.05}
        .mk-facts{margin:46px auto 0;display:grid;grid-template-columns:repeat(auto-fit,minmax(230px,1fr));gap:36px;max-width:1000px}
        .mk-fact svg{width:22px;height:22px;color:var(--mk-accent);margin-bottom:12px}
        .mk-fact strong{display:block;font-size:11px;letter-spacing:2.2px;text-transform:uppercase;margin-bottom:8px}
        .mk-fact span{display:block;font-size:14.5px;color:var(--mk-muted);line-height:1.8}
        .mk-fact a{color:var(--mk-muted);text-decoration:none}
        .mk-frames{display:grid;grid-template-columns:repeat(3,1fr);gap:26px;margin-top:8px}
        .mk-frame{margin:0;background:var(--mk-cream);padding:12px;border:1px solid var(--mk-line)}
        .mk-frame img{width:100%;height:260px;object-fit:cover;display:block}
        .mk-frame figcaption{padding:14px 4px 4px;font-size:11.5px;letter-spacing:1.8px;text-transform:uppercase;color:var(--mk-muted)}
        .mk-services{max-width:820px;margin:0 auto;text-align:left;display:grid;gap:26px}
        .mk-service-head{display:flex;align-items:baseline;gap:12px}
        .mk-service h3{margin:0;font-size:19px;white-space:nowrap}
        .mk-dots{flex:1;border-bottom:1px dotted #c9bda8;transform:translateY(-4px)}
        .mk-price{color:var(--mk-accent);font-family:Georgia,serif;font-size:19px;white-space:nowrap}
        .mk-service p{margin:7px 0 0;color:var(--mk-muted);font-size:14.5px;line-height:1.75;max-width:62ch}
        .mk-hours{list-style:none;margin:0;padding:0;text-align:left}
        .mk-hours li{display:flex;justify-content:space-between;gap:16px;padding:14px 4px;font-size:14.5px;border-bottom:1px solid var(--mk-line)}
        .mk-hours li:last-child{border-bottom:0}
        .mk-hours li span:last-child{color:var(--mk-accent)}
        .mk-hours .mk-closed span:last-child{color:#a89e90}
        .mk-social{padding:14px 24px 64px;text-align:center;background:var(--mk-cream)}
        .mk-social a{display:inline-flex;align-items:center;gap:11px;color:var(--mk-ink);font-size:11.5px;font-weight:700;letter-spacing:2px;text-transform:uppercase;text-decoration:none;padding:14px 30px;border:1px solid var(--mk-line);background:#fff}
        .mk-social svg{width:19px;height:19px;color:#c1739a}
        .mk-social a:hover{border-color:var(--mk-accent)}
        .mk-map-section{position:relative;padding-bottom:58px;text-align:center;background:#fff}
        .mk-map{max-width:1200px;margin:0 auto;height:430px;filter:sepia(.18) saturate(.85)}
        .mk-map iframe{width:100%;height:100%;border:0;display:block}
        .mk-btn-map{display:inline-flex;align-items:center;gap:9px;margin-top:-25px;position:relative;background:var(--mk-accent);color:#fff;padding:15px 34px;text-decoration:none;font-size:11.5px;font-weight:700;letter-spacing:2px;text-transform:uppercase}
        .mk-btn-map svg{width:15px;height:15px}
        .mk-btn-map:hover{background:#96754a}
        .mk-contact-card{display:grid;grid-template-columns:1fr 1.25fr;gap:50px;background:#fff;border:1px solid var(--mk-line);padding:48px;text-align:left;margin-top:8px}
        .mk-contact-info h3{display:flex;align-items:center;gap:9px;margin:0 0 7px;font-family:inherit;font-size:11px;font-weight:700;letter-spacing:2.2px;text-transform:uppercase;color:var(--mk-accent)}
        .mk-contact-info h3 svg{width:15px;height:15px}
        .mk-contact-info h3+p{margin:0 0 24px;color:var(--mk-muted);font-size:14.5px;line-height:1.8}
        .mk-contact-info a{color:var(--mk-muted);text-decoration:none}
        .mk-contact-info a:hover{color:var(--mk-accent)}
        .mk-contact-wa{margin-top:6px}
        .mk-contact-form{display:flex;flex-direction:column;gap:15px}
        .mk-contact-form input,.mk-contact-form textarea{width:100%;background:var(--mk-cream);border:1px solid var(--mk-line);padding:14px 16px;font-size:14.5px;color:var(--mk-ink);font-family:inherit}
        .mk-contact-form input::placeholder,.mk-contact-form textarea::placeholder{color:#a89e90}
        .mk-contact-form input:focus,.mk-contact-form textarea:focus{outline:none;border-color:var(--mk-accent);background:#fff}
        .mk-contact-form textarea{resize:vertical;min-height:132px}
        .mk-contact-form button{align-self:flex-start;background:var(--mk-accent);color:#fff;border:0;padding:15px 42px;font-size:11.5px;font-weight:700;letter-spacing:2px;text-transform:uppercase;cursor:pointer}
        .mk-contact-form button:hover{background:#96754a}
        .mk-footer{background:var(--mk-ink);color:#b6ab9c;text-align:center;padding:52px 24px}
        .mk-footer-inner{max-width:720px;margin:0 auto;display:grid;justify-items:center;gap:7px;font-size:14px;line-height:1.8}
        .mk-footer-name{font-family:Georgia,serif;color:#fff;font-size:22px;letter-spacing:3px;text-transform:uppercase;margin:0}
        .mk-footer .mk-flourish{margin:6px 0 14px}
        .mk-footer a{color:#d5cabb;text-decoration:none}
        .mk-footer a:hover{color:var(--mk-accent)}
        .mk-footer-copy{margin-top:16px;font-size:12px;color:#8a8074;letter-spacing:.6px}
        {$floatsCss}
        @media(max-width:1024px){.mk-nav{display:none}.mk-frames{grid-template-columns:repeat(2,1fr)}}
        @media(max-width:860px){.mk-hero-split{grid-template-columns:1fr}.mk-hero{min-height:300px;order:-1}.mk-hero-copy{padding:48px 26px}.mk-contact-card{grid-template-columns:1fr;padding:28px;gap:32px}.mk-header-cta span{display:none}.mk-header-cta{padding:11px 14px}}
        @media(max-width:560px){.mk-section{padding:56px 20px}.mk-frames{grid-template-columns:1fr;gap:18px}.mk-frame img{height:220px}.mk-service-head{flex-wrap:wrap}.mk-dots{display:none}}
        @media(prefers-reduced-motion:reduce){.mk-track{animation:none}}
        CSS;

        return ['html' => trim($html), 'css' => trim($css)];
    }
}
