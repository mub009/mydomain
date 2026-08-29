<?php

namespace App\Support\SiteBuilder\Templates;

use App\Support\SiteBuilder\Helpers;
use App\Support\SiteBuilder\Icons;

/**
 * Vibrant — a colourful, rounded layout with a gradient hero and playful
 * cards. Built for shops that want to look friendly rather than formal.
 */
class VibrantTemplate
{
    public const ID = 'vibrant';

    private const ACCENT = '#7c3aed';

    public static function meta(): array
    {
        return [
            'id' => self::ID,
            'name' => 'Vibrant',
            'description' => 'Colourful gradient hero with rounded cards and bold, friendly typography.',
            'accent' => self::ACCENT,
            'bestFor' => 'Cafés, bakeries, kids, events, wellness',
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
        $star = Icons::STAR;

        $galleryHtml = collect($ctx['photos'])->map(fn ($p) => <<<HTML
                <figure class="mk-bubble">
                  <img src="{$p['url']}" alt="{$p['caption']}" loading="lazy"/>
                  <figcaption>{$p['caption']}</figcaption>
                </figure>
            HTML)->implode('');

        $servicesHtml = collect($ctx['services'])->map(function ($s) use ($ctx) {
            $desc = $s['description'] ? "<p>{$s['description']}</p>" : '';

            return <<<HTML
              <div class="mk-service">
                <span class="mk-price">{$s['price']}</span>
                <h3>{$s['name']}</h3>
                {$desc}
                <a class="mk-service-cta" href="{$ctx['whatsappUrl']}" target="_blank" rel="noreferrer">Enquire →</a>
              </div>
            HTML;
        })->implode('');

        $hoursHtml = collect($ctx['hours'])->map(function ($h) {
            $cls = $h['closed'] ? ' class="mk-closed"' : '';

            return "<li{$cls}><span>{$h['day']}</span><span>{$h['value']}</span></li>";
        })->implode('');

        $categoryLine = $ctx['category'] ? '<small>'.$ctx['category'].($ctx['city'] ? " · {$ctx['city']}" : '').'</small>' : '';
        $navGallery = count($ctx['photos']) ? '<a href="#gallery">Gallery</a>' : '';
        $navServices = count($ctx['services']) ? '<a href="#services">Services</a>' : '';
        $eyebrow = $ctx['category'] ? '<span class="mk-eyebrow">'.$ctx['category'].($ctx['city'] ? " in {$ctx['city']}" : '').'</span>' : '';
        $reviewWord = $ctx['reviewCount'] === 1 ? '' : 's';
        $rating = $ctx['rating'] ? "<p class=\"mk-rating\">{$star}<strong>{$ctx['rating']}</strong><span>from {$ctx['reviewCount']} review{$reviewWord}</span></p>" : '';
        $chipHours = $ctx['workingTime'] ? "<div class=\"mk-chip\">{$clock}<span>{$ctx['workingTime']}</span></div>" : '';
        $chipEmail = $ctx['email'] ? "<div class=\"mk-chip\">{$mail}<span><a href=\"mailto:{$ctx['email']}\">{$ctx['email']}</a></span></div>" : '';
        $gallerySection = $galleryHtml ? <<<HTML
            <section class="mk-section mk-section-wide" id="gallery">
              <span class="mk-kicker">Gallery</span>
              <h2>Have a look around</h2>
              <div class="mk-bubbles">{$galleryHtml}</div>
            </section>
            HTML : '';
        $servicesSection = $servicesHtml ? <<<HTML
            <section class="mk-section mk-section-wide mk-section-alt" id="services">
              <span class="mk-kicker">Services</span>
              <h2>What we do</h2>
              <div class="mk-services">{$servicesHtml}</div>
            </section>
            HTML : '';
        $hoursSection = $hoursHtml ? <<<HTML
            <section class="mk-section mk-section-narrow" id="hours">
              <span class="mk-kicker">Timings</span>
              <h2>We're open</h2>
              <ul class="mk-hours">{$hoursHtml}</ul>
            </section>
            HTML : '';
        $socialSection = $ctx['instagram'] ? <<<HTML
            <section class="mk-social">
              <a href="https://www.instagram.com/{$ctx['instagram']}/" target="_blank" rel="noreferrer">{$instagram}<span>@{$ctx['instagram']}</span></a>
            </section>
            HTML : '';
        $mapSection = Helpers::mapSection($ctx, 'Take me there');
        $contactHours = $ctx['workingTime'] ? "<h3>{$clock}<span>Working Time</span></h3><p>{$ctx['workingTime']}</p>" : '';
        $contactEmail = $ctx['email'] ? "<h3>{$mail}<span>Email</span></h3><p><a href=\"mailto:{$ctx['email']}\">{$ctx['email']}</a></p>" : '';
        $enquiryForm = Helpers::enquiryForm('Send it');
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
              <a href="#about">About</a>
              {$navGallery}
              {$navServices}
              <a href="#contact">Contact</a>
            </nav>
            <a class="mk-header-cta" href="{$ctx['whatsappUrl']}" target="_blank" rel="noreferrer">{$whatsapp}<span>WhatsApp</span></a>
          </div>
        </header>

        <section class="mk-top" id="home">
          <div class="mk-top-inner">
            <div class="mk-top-copy">
              {$eyebrow}
              <h1>{$ctx['name']}</h1>
              <p class="mk-top-sub">{$ctx['description']}</p>
              <div class="mk-hero-actions">
                <a class="mk-btn mk-btn-primary" href="tel:{$ctx['phone']}">{$phone}<span>Call {$ctx['phone']}</span></a>
                <a class="mk-btn mk-btn-ghost" href="{$ctx['directionsUrl']}" target="_blank" rel="noreferrer">{$pin}<span>Directions</span></a>
              </div>
              {$rating}
            </div>
            <div class="mk-hero">
              <div class="mk-track">{$slides['html']}</div>
            </div>
          </div>
        </section>

        <section class="mk-chips">
          <div class="mk-chip">{$pin}<span>{$ctx['address']}</span></div>
          {$chipHours}
          {$chipEmail}
        </section>

        <section class="mk-section" id="about">
          <span class="mk-kicker">Hello 👋</span>
          <h2>A little about us</h2>
          <p class="mk-lead">{$ctx['description']}</p>
        </section>

        {$gallerySection}

        {$servicesSection}

        {$hoursSection}

        {$socialSection}

        {$mapSection}

        <section class="mk-section mk-section-wide" id="contact">
          <span class="mk-kicker">Contact</span>
          <h2>Say hello</h2>
          <div class="mk-contact-card">
            <div class="mk-contact-info">
              <h3>{$pin}<span>Address</span></h3>
              <p>{$ctx['address']}</p>
              {$contactHours}
              <h3>{$phone}<span>Call Us</span></h3>
              <p><a href="tel:{$ctx['phone']}">{$ctx['phone']}</a></p>
              {$contactEmail}
              <a class="mk-btn mk-btn-wa mk-contact-wa" href="{$ctx['whatsappUrl']}" target="_blank" rel="noreferrer">{$whatsapp}<span>Chat on WhatsApp</span></a>
            </div>
            {$enquiryForm}
          </div>
        </section>

        <footer class="mk-footer">
          <div class="mk-footer-inner">
            <p class="mk-footer-name">{$ctx['name']}</p>
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
        :root{--mk-accent:{$accent};--mk-accent-2:#ec4899;--mk-ink:#1b1236;--mk-muted:#6b6486;--mk-line:#ece7f7}
        #mk-site-root{background:#fff;color:var(--mk-ink)}
        .mk-header{position:sticky;top:0;z-index:40;background:rgba(255,255,255,.94);border-bottom:1px solid var(--mk-line)}
        .mk-header-inner{max-width:1220px;margin:0 auto;padding:12px 24px;display:flex;align-items:center;gap:20px}
        .mk-brand{display:flex;align-items:center;gap:12px;text-decoration:none;color:var(--mk-ink);margin-right:auto}
        .mk-logo{width:50px;height:50px;object-fit:cover;border-radius:18px;flex:0 0 auto;box-shadow:0 4px 14px rgba(124,58,237,.22)}
        .mk-logo-text{display:flex;align-items:center;justify-content:center;background:linear-gradient(135deg,var(--mk-accent),var(--mk-accent-2));color:#fff;font-size:22px;font-weight:800}
        .mk-brand-text{display:flex;flex-direction:column;line-height:1.25}
        .mk-brand-text strong{font-size:18px;font-weight:800;letter-spacing:-.3px}
        .mk-brand-text small{font-size:12px;color:var(--mk-muted)}
        .mk-nav{display:flex;gap:26px}
        .mk-nav a{color:#4c4468;text-decoration:none;font-size:14px;font-weight:700}
        .mk-nav a:hover{color:var(--mk-accent)}
        .mk-header-cta{display:inline-flex;align-items:center;gap:8px;background:#25d366;color:#fff;text-decoration:none;padding:11px 20px;border-radius:999px;font-size:13.5px;font-weight:700}
        .mk-header-cta svg{width:16px;height:16px}
        .mk-header-cta:hover{background:#1eb356}
        .mk-top{background:linear-gradient(135deg,#f5f0ff 0%,#ffeef7 55%,#eef6ff 100%)}
        .mk-top-inner{max-width:1220px;margin:0 auto;padding:70px 24px 78px;display:grid;grid-template-columns:1.05fr 1fr;gap:52px;align-items:center}
        .mk-eyebrow{display:inline-block;background:#fff;color:var(--mk-accent);padding:7px 16px;border-radius:999px;font-size:12.5px;font-weight:800;margin-bottom:18px;box-shadow:0 3px 12px rgba(124,58,237,.12)}
        .mk-top h1{margin:0 0 16px;font-size:clamp(32px,5.2vw,58px);line-height:1.06;font-weight:800;letter-spacing:-1.6px;background:linear-gradient(120deg,var(--mk-accent),var(--mk-accent-2));-webkit-background-clip:text;background-clip:text;color:transparent}
        .mk-top-sub{margin:0 0 26px;color:var(--mk-muted);font-size:16.5px;line-height:1.85;max-width:52ch}
        .mk-hero-actions{display:flex;flex-wrap:wrap;gap:12px}
        .mk-btn{display:inline-flex;align-items:center;gap:9px;padding:14px 26px;border-radius:999px;text-decoration:none;font-size:14.5px;font-weight:700;transition:transform .16s,box-shadow .16s}
        .mk-btn svg{width:17px;height:17px}
        .mk-btn:hover{transform:translateY(-2px)}
        .mk-btn-primary{background:linear-gradient(120deg,var(--mk-accent),var(--mk-accent-2));color:#fff;box-shadow:0 8px 22px rgba(124,58,237,.3)}
        .mk-btn-ghost{background:#fff;color:var(--mk-accent);box-shadow:0 4px 14px rgba(27,18,54,.08)}
        .mk-btn-wa{background:#25d366;color:#fff}
        .mk-rating{display:inline-flex;align-items:center;gap:8px;margin:22px 0 0;font-size:14.5px;color:var(--mk-muted)}
        .mk-rating svg{width:18px;height:18px;color:#f59e0b}
        .mk-rating strong{color:var(--mk-ink);font-size:16px}
        .mk-hero{position:relative;overflow:hidden;height:min(58vh,440px);border-radius:28px;box-shadow:0 18px 46px rgba(27,18,54,.16)}
        {$slidesCss}
        .mk-slide img{width:100%;height:100%;object-fit:cover;display:block}
        .mk-slide-empty{display:flex;align-items:center;justify-content:center;background:linear-gradient(135deg,var(--mk-accent),var(--mk-accent-2))}
        .mk-slide-empty span{font-size:30px;font-weight:800;color:#fff;letter-spacing:1px;padding:0 18px;text-align:center}
        .mk-chips{max-width:1220px;margin:0 auto;padding:26px 24px 0;display:flex;flex-wrap:wrap;gap:12px;justify-content:center}
        .mk-chip{display:inline-flex;align-items:center;gap:9px;background:#f8f6fd;border:1px solid var(--mk-line);border-radius:999px;padding:11px 20px;font-size:13.5px;color:#4c4468}
        .mk-chip svg{width:15px;height:15px;color:var(--mk-accent);flex:0 0 auto}
        .mk-chip a{color:inherit;text-decoration:none}
        .mk-section{padding:74px 24px;max-width:920px;margin:0 auto;text-align:center}
        .mk-section-wide{max-width:1220px}
        .mk-section-narrow{max-width:620px}
        .mk-section-alt{background:#faf8ff;max-width:none;border-radius:36px}
        .mk-section-alt>*{max-width:1220px;margin-left:auto;margin-right:auto}
        .mk-kicker{display:block;color:var(--mk-accent);font-size:13px;font-weight:800;letter-spacing:1.4px;text-transform:uppercase;margin-bottom:10px}
        .mk-section h2{margin:0 0 22px;font-size:clamp(26px,4vw,40px);font-weight:800;letter-spacing:-1px;color:var(--mk-ink)}
        .mk-lead{margin:0 auto;max-width:70ch;color:var(--mk-muted);font-size:16px;line-height:1.95}
        .mk-bubbles{display:grid;grid-template-columns:repeat(3,1fr);gap:22px}
        .mk-bubble{margin:0;background:#fff;border-radius:24px;overflow:hidden;box-shadow:0 8px 26px rgba(27,18,54,.09);transition:transform .22s,box-shadow .22s}
        .mk-bubble:hover{transform:translateY(-6px);box-shadow:0 16px 38px rgba(27,18,54,.15)}
        .mk-bubble img{width:100%;height:230px;object-fit:cover;display:block}
        .mk-bubble figcaption{padding:16px 14px;font-size:14px;font-weight:700;color:#4c4468}
        .mk-services{display:grid;grid-template-columns:repeat(3,1fr);gap:22px;text-align:left}
        .mk-service{background:#fff;border-radius:24px;padding:28px;box-shadow:0 8px 26px rgba(27,18,54,.08);display:flex;flex-direction:column;gap:9px}
        .mk-price{align-self:flex-start;background:linear-gradient(120deg,var(--mk-accent),var(--mk-accent-2));color:#fff;border-radius:999px;padding:6px 16px;font-size:14px;font-weight:800}
        .mk-service h3{margin:4px 0 0;font-size:18px;font-weight:800;color:var(--mk-ink)}
        .mk-service p{margin:0;color:var(--mk-muted);font-size:14.5px;line-height:1.75}
        .mk-service-cta{margin-top:auto;padding-top:10px;color:var(--mk-accent);font-size:14px;font-weight:700;text-decoration:none}
        .mk-service-cta:hover{color:var(--mk-accent-2)}
        .mk-hours{list-style:none;margin:0;padding:0;text-align:left;background:#faf8ff;border-radius:24px;overflow:hidden}
        .mk-hours li{display:flex;justify-content:space-between;gap:16px;padding:15px 24px;font-size:14.5px;border-bottom:1px solid #efeaf9}
        .mk-hours li:last-child{border-bottom:0}
        .mk-hours li span:first-child{font-weight:700}
        .mk-hours li span:last-child{color:var(--mk-accent);font-weight:700}
        .mk-hours .mk-closed span:last-child{color:#a49dbb}
        .mk-social{padding:8px 24px 58px;text-align:center}
        .mk-social a{display:inline-flex;align-items:center;gap:11px;color:#fff;font-size:15px;font-weight:700;text-decoration:none;padding:14px 30px;border-radius:999px;background:linear-gradient(120deg,#f09433,#dc2743,#bc1888)}
        .mk-social svg{width:20px;height:20px}
        .mk-social a:hover{opacity:.92}
        .mk-map-section{position:relative;padding-bottom:54px;text-align:center}
        .mk-map{max-width:1220px;margin:0 auto;height:420px;border-radius:28px;overflow:hidden;box-shadow:0 12px 34px rgba(27,18,54,.12)}
        .mk-map iframe{width:100%;height:100%;border:0;display:block}
        .mk-btn-map{display:inline-flex;align-items:center;gap:9px;margin-top:-24px;position:relative;background:linear-gradient(120deg,var(--mk-accent),var(--mk-accent-2));color:#fff;padding:14px 32px;border-radius:999px;text-decoration:none;font-weight:700;font-size:14.5px;box-shadow:0 8px 22px rgba(124,58,237,.3)}
        .mk-btn-map svg{width:16px;height:16px}
        .mk-contact-card{display:grid;grid-template-columns:1fr 1.3fr;gap:44px;background:#faf8ff;border-radius:30px;padding:44px;text-align:left}
        .mk-contact-info h3{display:flex;align-items:center;gap:9px;margin:0 0 7px;font-size:13.5px;font-weight:800;color:var(--mk-accent)}
        .mk-contact-info h3 svg{width:16px;height:16px}
        .mk-contact-info h3+p{margin:0 0 22px;color:var(--mk-muted);font-size:14.5px;line-height:1.75}
        .mk-contact-info a{color:var(--mk-muted);text-decoration:none}
        .mk-contact-info a:hover{color:var(--mk-accent)}
        .mk-contact-wa{margin-top:6px}
        .mk-contact-form{display:flex;flex-direction:column;gap:14px}
        .mk-contact-form input,.mk-contact-form textarea{width:100%;background:#fff;border:1px solid var(--mk-line);border-radius:14px;padding:14px 17px;font-size:14.5px;color:var(--mk-ink);font-family:inherit}
        .mk-contact-form input::placeholder,.mk-contact-form textarea::placeholder{color:#a49dbb}
        .mk-contact-form input:focus,.mk-contact-form textarea:focus{outline:none;border-color:var(--mk-accent);box-shadow:0 0 0 3px rgba(124,58,237,.12)}
        .mk-contact-form textarea{resize:vertical;min-height:130px}
        .mk-contact-form button{align-self:flex-start;background:linear-gradient(120deg,var(--mk-accent),var(--mk-accent-2));color:#fff;border:0;border-radius:999px;padding:14px 42px;font-size:15px;font-weight:800;cursor:pointer;box-shadow:0 8px 22px rgba(124,58,237,.28)}
        .mk-footer{margin-top:24px;background:var(--mk-ink);color:#b6aed0;text-align:center;padding:48px 24px}
        .mk-footer-inner{max-width:740px;margin:0 auto;display:grid;gap:7px;font-size:14px;line-height:1.7}
        .mk-footer-name{color:#fff;font-size:20px;font-weight:800;letter-spacing:-.4px;margin:0 0 4px}
        .mk-footer a{color:#d6cfe9;text-decoration:none}
        .mk-footer a:hover{color:#fff}
        .mk-footer-copy{margin-top:14px;padding-top:16px;border-top:1px solid rgba(255,255,255,.12);font-size:12.5px;color:#8b83a8}
        {$floatsCss}
        @media(max-width:1024px){.mk-nav{display:none}.mk-bubbles,.mk-services{grid-template-columns:repeat(2,1fr)}}
        @media(max-width:860px){.mk-top-inner{grid-template-columns:1fr;gap:34px;padding:52px 22px 60px}.mk-hero{height:min(46vh,320px)}.mk-contact-card{grid-template-columns:1fr;padding:28px;gap:30px}.mk-header-cta span{display:none}.mk-header-cta{padding:11px 13px}}
        @media(max-width:560px){.mk-section{padding:54px 18px}.mk-bubbles,.mk-services{grid-template-columns:1fr;gap:16px}.mk-bubble img{height:200px}.mk-section-alt{border-radius:0}.mk-btn{padding:12px 20px;font-size:13.5px}}
        @media(prefers-reduced-motion:reduce){.mk-track{animation:none}.mk-bubble,.mk-btn{transition:none}}
        CSS;

        return ['html' => trim($html), 'css' => trim($css)];
    }
}
