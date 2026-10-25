<?php

namespace App\Support\SiteBuilder\Templates;

use App\Support\SiteBuilder\Helpers;
use App\Support\SiteBuilder\Icons;

/**
 * Fresh — a full-bleed photo hero with the name laid over it, a green
 * info strip, and a numbered price list. Calm and natural rather than
 * loud; suits shops whose photos sell them.
 */
class FreshTemplate
{
    public const ID = 'fresh';

    private const ACCENT = '#15803d';

    public static function meta(): array
    {
        return [
            'id' => self::ID,
            'name' => 'Fresh',
            'description' => 'Full-width photo hero with the name over it, a green info strip, and a clean numbered price list.',
            'accent' => self::ACCENT,
            'bestFor' => 'Grocery, organic, salons, clinics, home services',
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
                <figure class="mk-tile">
                  <img src="{$p['url']}" alt="{$p['caption']}" loading="lazy"/>
                  <figcaption>{$p['caption']}</figcaption>
                </figure>
            HTML)->implode('');

        $servicesHtml = collect($ctx['services'])->values()->map(function ($s, $i) {
            $num = str_pad((string) ($i + 1), 2, '0', STR_PAD_LEFT);
            $desc = $s['description'] ? "<p>{$s['description']}</p>" : '';

            return <<<HTML
              <li class="mk-item">
                <span class="mk-num">{$num}</span>
                <div class="mk-item-body">
                  <h3>{$s['name']}</h3>
                  {$desc}
                </div>
                <span class="mk-item-price">{$s['price']}</span>
              </li>
            HTML;
        })->implode('');

        $hoursHtml = collect($ctx['hours'])->map(function ($h) {
            $cls = $h['closed'] ? ' class="mk-closed"' : '';

            return "<li{$cls}><span>{$h['day']}</span><span>{$h['value']}</span></li>";
        })->implode('');

        $categoryLine = $ctx['category'] ? '<small>'.$ctx['category'].($ctx['city'] ? " · {$ctx['city']}" : '').'</small>' : '';
        $navGallery = count($ctx['photos']) ? '<a href="#gallery">Gallery</a>' : '';
        $navServices = count($ctx['services']) ? '<a href="#services">Services</a>' : '';
        $eyebrow = $ctx['category'] ? '<span class="mk-eyebrow">'.$ctx['category'].($ctx['city'] ? " · {$ctx['city']}" : '').'</span>' : '';
        $reviewWord = $ctx['reviewCount'] === 1 ? '' : 's';
        $rating = $ctx['rating'] ? "<p class=\"mk-rating\">{$star}<strong>{$ctx['rating']}</strong><span>{$ctx['reviewCount']} review{$reviewWord}</span></p>" : '';
        $stripHours = $ctx['workingTime'] ? "<div class=\"mk-strip-item\">{$clock}<div><small>Open</small><span>{$ctx['workingTime']}</span></div></div>" : '';
        $aboutPhoto = count($ctx['photos'])
            ? "<img class=\"mk-about-img\" src=\"{$ctx['photos'][0]['url']}\" alt=\"{$ctx['photos'][0]['caption']}\" loading=\"lazy\"/>"
            : "<div class=\"mk-about-img mk-about-empty\"><span>{$ctx['initial']}</span></div>";
        $gallerySection = $galleryHtml ? <<<HTML
            <section class="mk-section mk-section-tint" id="gallery">
              <div class="mk-wrap">
                <span class="mk-kicker">Gallery</span>
                <h2>A look inside</h2>
                <div class="mk-tiles">{$galleryHtml}</div>
              </div>
            </section>
            HTML : '';
        $servicesSection = $servicesHtml ? <<<HTML
            <section class="mk-section" id="services">
              <div class="mk-wrap mk-wrap-narrow">
                <span class="mk-kicker">Services &amp; prices</span>
                <h2>What we offer</h2>
                <ol class="mk-list">{$servicesHtml}</ol>
                <a class="mk-btn mk-btn-primary mk-list-cta" href="{$ctx['whatsappUrl']}" target="_blank" rel="noreferrer">{$whatsapp}<span>Ask on WhatsApp</span></a>
              </div>
            </section>
            HTML : '';
        $hoursBlock = $hoursHtml ? "<div class=\"mk-hours-card\"><h3>{$clock}<span>Opening hours</span></h3><ul class=\"mk-hours\">{$hoursHtml}</ul></div>" : '';
        $socialLink = $ctx['instagram'] ? "<a class=\"mk-insta\" href=\"https://www.instagram.com/{$ctx['instagram']}/\" target=\"_blank\" rel=\"noreferrer\">{$instagram}<span>@{$ctx['instagram']}</span></a>" : '';
        $mapSection = Helpers::mapSection($ctx, 'Get directions');
        $contactEmail = $ctx['email'] ? "<h3>{$mail}<span>Email</span></h3><p><a href=\"mailto:{$ctx['email']}\">{$ctx['email']}</a></p>" : '';
        $enquiryForm = Helpers::enquiryForm('Send message');
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
              {$navServices}
              {$navGallery}
              <a href="#contact">Contact</a>
            </nav>
            <a class="mk-header-cta" href="tel:{$ctx['phone']}">{$phone}<span>{$ctx['phone']}</span></a>
          </div>
        </header>

        <section class="mk-hero" id="home">
          <div class="mk-track">{$slides['html']}</div>
          <div class="mk-hero-shade"></div>
          <div class="mk-hero-copy">
            {$eyebrow}
            <h1>{$ctx['name']}</h1>
            {$rating}
            <div class="mk-hero-actions">
              <a class="mk-btn mk-btn-primary" href="tel:{$ctx['phone']}">{$phone}<span>Call now</span></a>
              <a class="mk-btn mk-btn-light" href="{$ctx['whatsappUrl']}" target="_blank" rel="noreferrer">{$whatsapp}<span>WhatsApp</span></a>
            </div>
          </div>
        </section>

        <section class="mk-strip">
          <div class="mk-strip-inner">
            <div class="mk-strip-item">{$pin}<div><small>Find us</small><span>{$ctx['address']}</span></div></div>
            {$stripHours}
            <div class="mk-strip-item">{$phone}<div><small>Call</small><span><a href="tel:{$ctx['phone']}">{$ctx['phone']}</a></span></div></div>
          </div>
        </section>

        <section class="mk-section" id="about">
          <div class="mk-wrap mk-about">
            {$aboutPhoto}
            <div>
              <span class="mk-kicker">About us</span>
              <h2>Welcome to {$ctx['name']}</h2>
              <p class="mk-lead">{$ctx['description']}</p>
              <a class="mk-link" href="{$ctx['directionsUrl']}" target="_blank" rel="noreferrer">{$pin}<span>Get directions</span></a>
            </div>
          </div>
        </section>

        {$servicesSection}

        {$gallerySection}

        {$mapSection}

        <section class="mk-section" id="contact">
          <div class="mk-wrap">
            <span class="mk-kicker">Contact</span>
            <h2>Get in touch</h2>
            <div class="mk-contact">
              <div class="mk-contact-info">
                <h3>{$pin}<span>Address</span></h3>
                <p>{$ctx['address']}</p>
                <h3>{$phone}<span>Phone</span></h3>
                <p><a href="tel:{$ctx['phone']}">{$ctx['phone']}</a></p>
                {$contactEmail}
                {$hoursBlock}
                {$socialLink}
              </div>
              {$enquiryForm}
            </div>
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
        :root{--mk-accent:{$accent};--mk-accent-dark:#166534;--mk-soft:#f0fdf4;--mk-ink:#14281d;--mk-muted:#5b6b61;--mk-line:#e2ece5}
        #mk-site-root{background:#fff;color:var(--mk-ink)}
        .mk-header{position:sticky;top:0;z-index:40;background:#fff;border-bottom:1px solid var(--mk-line)}
        .mk-header-inner{max-width:1200px;margin:0 auto;padding:12px 24px;display:flex;align-items:center;gap:22px}
        .mk-brand{display:flex;align-items:center;gap:12px;text-decoration:none;color:var(--mk-ink);margin-right:auto}
        .mk-logo{width:46px;height:46px;object-fit:cover;border-radius:50%;flex:0 0 auto}
        .mk-logo-text{display:flex;align-items:center;justify-content:center;background:var(--mk-accent);color:#fff;font-size:20px;font-weight:700}
        .mk-brand-text{display:flex;flex-direction:column;line-height:1.25}
        .mk-brand-text strong{font-size:17px;font-weight:700}
        .mk-brand-text small{font-size:12px;color:var(--mk-muted)}
        .mk-nav{display:flex;gap:26px}
        .mk-nav a{color:var(--mk-muted);text-decoration:none;font-size:14px;font-weight:600}
        .mk-nav a:hover{color:var(--mk-accent)}
        .mk-header-cta{display:inline-flex;align-items:center;gap:8px;border:1.5px solid var(--mk-accent);color:var(--mk-accent);text-decoration:none;padding:9px 18px;border-radius:999px;font-size:13.5px;font-weight:700}
        .mk-header-cta svg{width:15px;height:15px}
        .mk-header-cta:hover{background:var(--mk-accent);color:#fff}
        .mk-hero{position:relative;overflow:hidden;height:min(78vh,620px);background:var(--mk-accent-dark)}
        {$slidesCss}
        .mk-slide img{width:100%;height:100%;object-fit:cover;display:block}
        .mk-slide-empty{display:flex;align-items:center;justify-content:center;background:linear-gradient(135deg,var(--mk-accent),var(--mk-accent-dark))}
        .mk-slide-empty span{display:none}
        .mk-hero-shade{position:absolute;inset:0;background:linear-gradient(180deg,rgba(10,30,18,.15) 0%,rgba(10,30,18,.72) 100%);pointer-events:none}
        .mk-hero-copy{position:absolute;left:0;right:0;bottom:0;max-width:1200px;margin:0 auto;padding:0 24px 64px;color:#fff}
        .mk-eyebrow{display:inline-block;background:rgba(255,255,255,.16);border:1px solid rgba(255,255,255,.3);padding:6px 14px;border-radius:999px;font-size:12.5px;font-weight:600;margin-bottom:16px}
        .mk-hero h1{margin:0 0 12px;font-size:clamp(34px,6vw,68px);line-height:1.04;font-weight:800;letter-spacing:-1.5px;max-width:16ch}
        .mk-rating{display:inline-flex;align-items:center;gap:7px;margin:0 0 22px;font-size:14.5px;color:rgba(255,255,255,.88)}
        .mk-rating svg{width:17px;height:17px;color:#facc15}
        .mk-rating strong{color:#fff;font-size:16px}
        .mk-hero-actions{display:flex;flex-wrap:wrap;gap:12px}
        .mk-btn{display:inline-flex;align-items:center;gap:9px;padding:13px 26px;border-radius:999px;text-decoration:none;font-size:14.5px;font-weight:700;transition:transform .16s,background .16s}
        .mk-btn svg{width:17px;height:17px}
        .mk-btn:hover{transform:translateY(-2px)}
        .mk-btn-primary{background:var(--mk-accent);color:#fff}
        .mk-btn-primary:hover{background:var(--mk-accent-dark)}
        .mk-btn-light{background:#fff;color:var(--mk-ink)}
        .mk-strip{background:var(--mk-accent);color:#fff}
        .mk-strip-inner{max-width:1200px;margin:0 auto;padding:22px 24px;display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:20px}
        .mk-strip-item{display:flex;align-items:flex-start;gap:12px;font-size:14px;line-height:1.55}
        .mk-strip-item svg{width:20px;height:20px;flex:0 0 auto;margin-top:2px;opacity:.9}
        .mk-strip-item small{display:block;font-size:11.5px;text-transform:uppercase;letter-spacing:1.2px;opacity:.75;margin-bottom:2px}
        .mk-strip-item a{color:#fff;text-decoration:none}
        .mk-section{padding:80px 24px}
        .mk-section-tint{background:var(--mk-soft)}
        .mk-wrap{max-width:1200px;margin:0 auto}
        .mk-wrap-narrow{max-width:820px}
        .mk-kicker{display:block;color:var(--mk-accent);font-size:12.5px;font-weight:700;letter-spacing:1.6px;text-transform:uppercase;margin-bottom:10px}
        .mk-section h2{margin:0 0 28px;font-size:clamp(26px,3.6vw,38px);font-weight:800;letter-spacing:-.8px;color:var(--mk-ink)}
        .mk-about{display:grid;grid-template-columns:1fr 1.1fr;gap:56px;align-items:center}
        .mk-about h2{margin-bottom:16px}
        .mk-about-img{width:100%;height:420px;object-fit:cover;border-radius:20px;display:block}
        .mk-about-empty{display:flex;align-items:center;justify-content:center;background:var(--mk-soft);color:var(--mk-accent);font-size:96px;font-weight:800}
        .mk-lead{margin:0 0 22px;color:var(--mk-muted);font-size:16px;line-height:1.9}
        .mk-link{display:inline-flex;align-items:center;gap:8px;color:var(--mk-accent);font-weight:700;font-size:14.5px;text-decoration:none}
        .mk-link svg{width:16px;height:16px}
        .mk-list{list-style:none;margin:0;padding:0;border-top:1px solid var(--mk-line)}
        .mk-item{display:flex;align-items:flex-start;gap:20px;padding:22px 0;border-bottom:1px solid var(--mk-line)}
        .mk-num{font-size:14px;font-weight:800;color:var(--mk-accent);background:var(--mk-soft);border-radius:10px;padding:6px 10px;flex:0 0 auto}
        .mk-item-body{flex:1;min-width:0}
        .mk-item h3{margin:2px 0 4px;font-size:17px;font-weight:700}
        .mk-item p{margin:0;color:var(--mk-muted);font-size:14.5px;line-height:1.7}
        .mk-item-price{font-size:16px;font-weight:800;color:var(--mk-ink);white-space:nowrap;padding-top:2px}
        .mk-list-cta{margin-top:30px}
        .mk-tiles{display:grid;grid-template-columns:repeat(4,1fr);gap:16px}
        .mk-tile{margin:0;position:relative;border-radius:16px;overflow:hidden;aspect-ratio:1/1;background:#dcefe2}
        .mk-tile img{width:100%;height:100%;object-fit:cover;display:block;transition:transform .35s}
        .mk-tile:hover img{transform:scale(1.06)}
        .mk-tile figcaption{position:absolute;left:0;right:0;bottom:0;padding:26px 14px 12px;font-size:13.5px;font-weight:600;color:#fff;background:linear-gradient(180deg,transparent,rgba(10,30,18,.7))}
        .mk-map-section{position:relative;padding:0 24px 40px;text-align:center}
        .mk-map{max-width:1200px;margin:0 auto;height:400px;border-radius:20px;overflow:hidden;border:1px solid var(--mk-line)}
        .mk-map iframe{width:100%;height:100%;border:0;display:block}
        .mk-btn-map{display:inline-flex;align-items:center;gap:9px;margin-top:-24px;position:relative;background:var(--mk-accent);color:#fff;padding:13px 30px;border-radius:999px;text-decoration:none;font-weight:700;font-size:14.5px}
        .mk-btn-map svg{width:16px;height:16px}
        .mk-contact{display:grid;grid-template-columns:1fr 1.3fr;gap:48px}
        .mk-contact-info h3{display:flex;align-items:center;gap:9px;margin:0 0 6px;font-size:13.5px;font-weight:700;color:var(--mk-accent)}
        .mk-contact-info h3 svg{width:16px;height:16px}
        .mk-contact-info h3+p{margin:0 0 20px;color:var(--mk-muted);font-size:14.5px;line-height:1.75}
        .mk-contact-info a{color:var(--mk-muted);text-decoration:none}
        .mk-contact-info a:hover{color:var(--mk-accent)}
        .mk-hours-card{background:var(--mk-soft);border-radius:16px;padding:18px 20px;margin:4px 0 20px}
        .mk-hours{list-style:none;margin:0;padding:0}
        .mk-hours li{display:flex;justify-content:space-between;gap:14px;padding:7px 0;font-size:14px;border-bottom:1px dashed #cfe3d5}
        .mk-hours li:last-child{border-bottom:0}
        .mk-hours li span:first-child{font-weight:600}
        .mk-hours li span:last-child{color:var(--mk-muted)}
        .mk-hours .mk-closed span:last-child{color:#b45309}
        .mk-insta{display:inline-flex;align-items:center;gap:9px;font-weight:700;font-size:14.5px}
        .mk-insta svg{width:18px;height:18px;color:#c13584}
        .mk-contact-form{display:flex;flex-direction:column;gap:14px;background:var(--mk-soft);border-radius:20px;padding:30px}
        .mk-contact-form input,.mk-contact-form textarea{width:100%;background:#fff;border:1px solid var(--mk-line);border-radius:12px;padding:13px 16px;font-size:14.5px;color:var(--mk-ink);font-family:inherit}
        .mk-contact-form input::placeholder,.mk-contact-form textarea::placeholder{color:#93a399}
        .mk-contact-form input:focus,.mk-contact-form textarea:focus{outline:none;border-color:var(--mk-accent);box-shadow:0 0 0 3px rgba(21,128,61,.14)}
        .mk-contact-form textarea{resize:vertical;min-height:130px}
        .mk-contact-form button{align-self:flex-start;background:var(--mk-accent);color:#fff;border:0;border-radius:999px;padding:13px 38px;font-size:15px;font-weight:700;cursor:pointer}
        .mk-contact-form button:hover{background:var(--mk-accent-dark)}
        .mk-footer{background:var(--mk-ink);color:#a9bcb0;text-align:center;padding:46px 24px}
        .mk-footer-inner{max-width:740px;margin:0 auto;display:grid;gap:7px;font-size:14px;line-height:1.7}
        .mk-footer-name{color:#fff;font-size:20px;font-weight:800;margin:0 0 4px}
        .mk-footer a{color:#d3e2d8;text-decoration:none}
        .mk-footer a:hover{color:#fff}
        .mk-footer-copy{margin-top:14px;padding-top:16px;border-top:1px solid rgba(255,255,255,.12);font-size:12.5px;color:#7f948a}
        {$floatsCss}
        @media(max-width:1024px){.mk-nav{display:none}.mk-tiles{grid-template-columns:repeat(3,1fr)}}
        @media(max-width:860px){.mk-about,.mk-contact{grid-template-columns:1fr;gap:30px}.mk-about-img{height:300px}.mk-hero{height:min(70vh,500px)}.mk-hero-copy{padding-bottom:44px}.mk-header-cta span{display:none}.mk-header-cta{padding:10px 12px}}
        @media(max-width:560px){.mk-section{padding:56px 18px}.mk-tiles{grid-template-columns:repeat(2,1fr);gap:10px}.mk-item{gap:14px}.mk-item{flex-wrap:wrap}.mk-item-price{margin-left:52px}.mk-contact-form{padding:20px}.mk-btn{padding:12px 20px;font-size:13.5px}}
        @media(prefers-reduced-motion:reduce){.mk-track{animation:none}.mk-tile img,.mk-btn{transition:none}}
        CSS;

        return ['html' => trim($html), 'css' => trim($css), 'liveCss' => trim($slidesCss)];
    }
}
