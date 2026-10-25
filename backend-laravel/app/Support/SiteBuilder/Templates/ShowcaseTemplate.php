<?php

namespace App\Support\SiteBuilder\Templates;

use App\Support\SiteBuilder\Helpers;
use App\Support\SiteBuilder\Icons;

/**
 * Showcase — the familiar one-page business site: logo-and-name header, a
 * full-width photo banner, a centred "About us", a captioned photo grid of
 * what the business offers, map, and a contact block beside the form.
 */
class ShowcaseTemplate
{
    public const ID = 'showcase';

    public static function meta(): array
    {
        return [
            'id' => self::ID,
            'name' => 'Showcase',
            'description' => 'Full-width photo banner, captioned services grid, map and a contact block beside the form.',
            'accent' => '#0d6efd',
            'bestFor' => 'Clinics, salons and service businesses',
        ];
    }

    public static function build(array $ctx): array
    {
        $hero = self::heroCarousel($ctx);
        $floats = Helpers::floatButtons($ctx, '#0d6efd');
        $phone = Icons::PHONE;
        $pin = Icons::PIN;
        $clock = Icons::CLOCK;
        $mail = Icons::MAIL;
        $instagram = Icons::INSTAGRAM;

        // The photos double as the services showcase, each captioned with
        // what it shows — the way these pages are usually filled in.
        $tilesHtml = collect($ctx['photos'])->map(fn ($p) => <<<HTML
                <figure class="mk-tile">
                  <div class="mk-tile-img"><img src="{$p['url']}" alt="{$p['caption']}" loading="lazy"/></div>
                  <figcaption>{$p['caption']}</figcaption>
                </figure>
            HTML)->implode('');

        $pricesHtml = collect($ctx['services'])->map(function ($s) {
            $desc = $s['description'] ? "<p>{$s['description']}</p>" : '';

            return <<<HTML
              <div class="mk-price-row">
                <div><h3>{$s['name']}</h3>{$desc}</div>
                <span class="mk-price">{$s['price']}</span>
              </div>
            HTML;
        })->implode('');

        $navServices = ($tilesHtml || $pricesHtml) ? '<a href="#services">Services</a>' : '';
        $galleryHtml = collect($ctx['gallery'])->map(fn ($g) => "<figure><img src=\"{$g['url']}\" alt=\"{$g['caption']}\" loading=\"lazy\"/></figure>")->implode('');
        $navGallery = $galleryHtml ? '<a href="#gallery">Gallery</a>' : '';
        $gallerySection = $galleryHtml ? <<<HTML
            <section class="mk-section" id="gallery">
              <div class="mk-title"><h2>Our Gallery</h2></div>
              <div class="mk-gallery">{$galleryHtml}</div>
            </section>
            HTML : '';
        $categoryLine = $ctx['category'] ? '<h3 class="mk-about-sub">'.$ctx['category'].($ctx['city'] ? " · {$ctx['city']}" : '').'</h3>' : '';
        $tilesGrid = $tilesHtml ? "<div class=\"mk-tiles\">{$tilesHtml}</div>" : '';
        $pricesList = $pricesHtml ? "<div class=\"mk-prices\">{$pricesHtml}</div>" : '';
        $servicesSection = ($tilesHtml || $pricesHtml) ? <<<HTML
            <section class="mk-section mk-section-alt" id="services">
              <div class="mk-title"><h2>Our Services</h2></div>
              {$tilesGrid}
              {$pricesList}
            </section>
            HTML : '';
        $socialSection = $ctx['instagram'] ? <<<HTML
            <section class="mk-social">
              <h5>Follow Us On Instagram</h5>
              <a href="https://www.instagram.com/{$ctx['instagram']}/" target="_blank" rel="noreferrer" aria-label="Instagram">{$instagram}</a>
            </section>
            HTML : '';
        $mapSection = Helpers::mapSection($ctx);
        $contactHours = $ctx['workingTime'] ? "<div class=\"mk-info\"><span class=\"mk-info-title\">{$clock} Working Time</span><p>{$ctx['workingTime']}</p></div>" : '';
        $contactEmail = $ctx['email'] ? "<div class=\"mk-info\"><span class=\"mk-info-title\">{$mail} Email</span><a href=\"mailto:{$ctx['email']}\">{$ctx['email']}</a></div>" : '';
        $enquiryForm = Helpers::enquiryForm();

        $html = <<<HTML
        <header class="mk-header">
          <div class="mk-header-inner">
            <a class="mk-brand" href="#home">
              {$ctx['logoHtml']}
              <span class="mk-brand-name">{$ctx['name']}</span>
            </a>
            <input type="checkbox" id="mk-nav-toggle" class="mk-nav-toggle" aria-label="Toggle menu"/>
            <label for="mk-nav-toggle" class="mk-burger"><span></span><span></span><span></span></label>
            <nav class="mk-nav">
              <a href="#home">Home</a>
              <a href="#about">About Us</a>
              {$navServices}
              {$navGallery}
              <a href="#contact">Contact Us</a>
            </nav>
          </div>
        </header>

        <section class="mk-hero" id="home">
          {$hero['html']}
        </section>

        <section class="mk-section mk-about" id="about">
          <h2>About us</h2>
          {$categoryLine}
          <p>{$ctx['description']}</p>
        </section>

        {$servicesSection}

        {$gallerySection}

        {$socialSection}

        <div class="mk-title mk-map-title"><h2>Google Map</h2></div>
        {$mapSection}

        <section class="mk-section" id="contact">
          <div class="mk-title"><h2>Contact Us</h2></div>
          <div class="mk-contact">
            <div class="mk-contact-info">
              <div class="mk-info"><span class="mk-info-title">{$pin} Address</span><p>{$ctx['address']}</p></div>
              {$contactHours}
              <div class="mk-info"><span class="mk-info-title">{$phone} Call Us</span><a href="tel:{$ctx['phone']}">{$ctx['phone']}</a></div>
              {$contactEmail}
            </div>
            {$enquiryForm}
          </div>
        </section>

        <footer class="mk-footer">
          <p>&copy; {$ctx['year']} {$ctx['name']}. All rights reserved.</p>
        </footer>

        {$floats['html']}
        HTML;

        $heroCss = $hero['css'];
        $floatsCss = $floats['css'];

        $css = <<<CSS
        :root{--mk-accent:#0d6efd;--mk-accent-dark:#0a58ca;--mk-dark:#212529;--mk-muted:#6c757d}
        #mk-site-root{font-family:Overpass,system-ui,-apple-system,"Segoe UI",Roboto,sans-serif}
        .mk-header{position:sticky;top:0;z-index:40;background:#fff;box-shadow:0 2px 10px rgba(0,0,0,.08)}
        .mk-header-inner{position:relative;max-width:1140px;margin:0 auto;padding:10px 15px;display:flex;align-items:center;gap:16px}
        .mk-brand{display:flex;align-items:center;gap:12px;text-decoration:none;color:var(--mk-dark);margin-right:auto;min-width:0}
        .mk-logo{height:64px;width:auto;max-width:90px;object-fit:contain;flex:0 0 auto}
        .mk-logo-text{display:flex;align-items:center;justify-content:center;width:56px;height:56px;border-radius:8px;background:var(--mk-accent);color:#fff;font-size:24px;font-weight:700}
        .mk-brand-name{font-size:20px;font-weight:700;line-height:1.25;color:var(--mk-dark)}
        .mk-nav-toggle{display:none}
        .mk-burger{display:none;flex-direction:column;gap:5px;padding:10px;cursor:pointer;border:1px solid #dee2e6;border-radius:4px}
        .mk-burger span{display:block;width:22px;height:2px;background:var(--mk-dark)}
        .mk-nav{display:flex;gap:6px}
        .mk-nav a{color:var(--mk-dark);text-decoration:none;font-size:15px;font-weight:600;padding:8px 14px;border-radius:4px}
        .mk-nav a:hover{color:var(--mk-accent)}
        .mk-hero{position:relative;overflow:hidden;height:clamp(340px,64vh,560px);background:var(--mk-dark);color:#fff}
        .mk-hero-radio{position:absolute;top:50%;left:0;opacity:0;pointer-events:none}
        .mk-slides{position:absolute;inset:0}
        .mk-slides::after{content:"";position:absolute;inset:0;z-index:1;background:linear-gradient(180deg,rgba(0,0,0,.35),rgba(0,0,0,.55))}
        .mk-slide{position:absolute;inset:0;opacity:0;transition:opacity .8s ease}
        .mk-slide:only-child{opacity:1}
        .mk-slide img{width:100%;height:100%;object-fit:cover;display:block}
        .mk-slide-empty{background:linear-gradient(135deg,var(--mk-accent),var(--mk-accent-dark))}
        {$heroCss}
        .mk-hero-caption{position:relative;z-index:2;height:100%;max-width:900px;margin:0 auto;padding:0 80px;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;animation:mk-rise .9s ease both}
        .mk-hero-tag{margin:0 0 16px;padding:6px 16px;border:1px solid rgba(255,255,255,.65);border-radius:30px;font-size:13px;font-weight:600;letter-spacing:2px;text-transform:uppercase}
        .mk-hero-caption h1{margin:0;font-size:clamp(30px,5vw,54px);font-weight:800;line-height:1.15;color:#fff;text-shadow:0 2px 14px rgba(0,0,0,.35)}
        .mk-hero-actions{display:flex;flex-wrap:wrap;justify-content:center;gap:12px;margin-top:28px}
        .mk-hero-btn{display:inline-flex;align-items:center;gap:8px;padding:12px 28px;border:2px solid var(--mk-accent);border-radius:4px;background:var(--mk-accent);color:#fff;text-decoration:none;font-size:15px;font-weight:700;transition:background .2s,border-color .2s,color .2s}
        .mk-hero-btn svg{width:16px;height:16px}
        .mk-hero-btn:hover{background:var(--mk-accent-dark);border-color:var(--mk-accent-dark)}
        .mk-hero-btn-ghost{background:transparent;border-color:#fff}
        .mk-hero-btn-ghost:hover{background:#fff;border-color:#fff;color:var(--mk-dark)}
        .mk-arrows{position:absolute;top:50%;left:0;right:0;z-index:3;display:flex;justify-content:space-between;padding:0 18px;transform:translateY(-50%);visibility:hidden;pointer-events:none}
        .mk-arrows label{display:flex;align-items:center;justify-content:center;width:46px;height:46px;border-radius:50%;background:rgba(0,0,0,.35);color:#fff;cursor:pointer;pointer-events:auto;transition:background .2s}
        .mk-arrows label:hover{background:var(--mk-accent)}
        .mk-arrows svg{width:22px;height:22px}
        .mk-dots{position:absolute;left:0;right:0;bottom:22px;z-index:3;display:flex;justify-content:center;gap:10px}
        .mk-dot{width:12px;height:12px;border-radius:50%;background:rgba(255,255,255,.5);cursor:pointer;transition:background .3s}
        @keyframes mk-rise{from{opacity:0;transform:translateY(18px)}to{opacity:1;transform:none}}
        .mk-section{padding:70px 15px}
        .mk-section-alt{background:#f8f9fa}
        .mk-title{text-align:center;margin:0 auto 40px}
        .mk-title h2,.mk-about h2{display:inline-block;margin:0;font-size:32px;font-weight:700;color:var(--mk-dark);padding-bottom:12px;border-bottom:3px solid var(--mk-accent)}
        .mk-about{max-width:900px;margin:0 auto;text-align:center}
        .mk-about h2{margin-bottom:26px}
        .mk-about-sub{margin:0 0 12px;font-size:16px;font-weight:600;color:var(--mk-accent);text-transform:uppercase;letter-spacing:1px}
        .mk-about p{margin:0;color:#495057;font-size:16px;line-height:1.85}
        .mk-tiles{max-width:1140px;margin:0 auto;display:grid;grid-template-columns:repeat(4,1fr);gap:30px}
        .mk-tile{margin:0;text-align:center;background:#fff;box-shadow:0 2px 12px rgba(0,0,0,.08);border-radius:4px;overflow:hidden}
        .mk-tile-img{position:relative;overflow:hidden;aspect-ratio:2/1}
        .mk-tile-img img{width:100%;height:100%;object-fit:cover;display:block;transition:transform .4s}
        .mk-tile-img::after{content:"+";position:absolute;inset:0;display:flex;align-items:center;justify-content:center;background:rgba(13,110,253,.55);color:#fff;font-size:44px;font-weight:300;opacity:0;transition:opacity .3s}
        .mk-tile:hover .mk-tile-img img{transform:scale(1.08)}
        .mk-tile:hover .mk-tile-img::after{opacity:1}
        .mk-tile figcaption{padding:14px 10px;font-size:14px;font-weight:700;text-transform:uppercase;color:var(--mk-dark)}
        .mk-prices{max-width:900px;margin:40px auto 0;display:grid;gap:12px}
        .mk-price-row{display:flex;justify-content:space-between;align-items:flex-start;gap:20px;background:#fff;border:1px solid #e9ecef;border-radius:4px;padding:18px 22px}
        .mk-price-row h3{margin:0 0 4px;font-size:16px;color:var(--mk-dark)}
        .mk-price-row p{margin:0;color:var(--mk-muted);font-size:14px}
        .mk-price{color:var(--mk-accent);font-weight:700;font-size:17px;white-space:nowrap}
        .mk-gallery{max-width:1140px;margin:0 auto;display:grid;grid-template-columns:repeat(4,1fr);gap:16px}
        .mk-gallery figure{margin:0;overflow:hidden;border-radius:4px;box-shadow:0 2px 12px rgba(0,0,0,.08)}
        .mk-gallery img{width:100%;aspect-ratio:1;object-fit:cover;display:block;transition:transform .4s}
        .mk-gallery figure:hover img{transform:scale(1.06)}
        .mk-social{padding:40px 15px;text-align:center}
        .mk-social h5{margin:0 0 14px;font-size:18px;font-weight:600;color:var(--mk-dark)}
        .mk-social a{display:inline-flex;align-items:center;justify-content:center;width:50px;height:50px;border-radius:12px;color:#fff;background:radial-gradient(circle at 30% 107%,#fdf497 0%,#fd5949 45%,#d6249f 60%,#285aeb 90%)}
        .mk-social svg{width:26px;height:26px}
        .mk-map-title{padding-top:60px;margin-bottom:30px}
        .mk-map-section{max-width:1140px;margin:0 auto;padding:0 15px;text-align:center}
        .mk-map{height:450px}
        .mk-map iframe{width:100%;height:100%;border:0;display:block}
        .mk-btn-map{display:inline-flex;align-items:center;gap:8px;margin-top:16px;background:var(--mk-accent);color:#fff;padding:10px 24px;border-radius:4px;text-decoration:none;font-weight:600;font-size:15px}
        .mk-btn-map svg{width:16px;height:16px}
        .mk-btn-map:hover{background:var(--mk-accent-dark)}
        .mk-contact{max-width:1140px;margin:0 auto;display:grid;grid-template-columns:5fr 7fr;gap:40px}
        .mk-info{margin-bottom:26px}
        .mk-info-title{display:flex;align-items:center;gap:8px;font-size:15px;font-weight:700;text-transform:uppercase;color:var(--mk-dark);margin-bottom:6px}
        .mk-info-title svg{width:16px;height:16px;color:var(--mk-accent)}
        .mk-info p{margin:0;color:var(--mk-muted);font-size:15px;line-height:1.7}
        .mk-info a{color:var(--mk-muted);font-size:15px;text-decoration:none}
        .mk-info a:hover{color:var(--mk-accent)}
        .mk-contact-form{display:flex;flex-direction:column;gap:14px}
        .mk-contact-form input,.mk-contact-form textarea{width:100%;border:1px solid #ced4da;border-radius:4px;padding:10px 12px;font-size:15px;color:#495057;font-family:inherit;background:#fff}
        .mk-contact-form input:focus,.mk-contact-form textarea:focus{outline:none;border-color:#86b7fe;box-shadow:0 0 0 3px rgba(13,110,253,.2)}
        .mk-contact-form textarea{resize:vertical;min-height:110px}
        .mk-contact-form button{align-self:flex-start;background:var(--mk-accent);color:#fff;border:0;border-radius:4px;padding:10px 28px;font-size:15px;font-weight:600;cursor:pointer}
        .mk-contact-form button:hover{background:var(--mk-accent-dark)}
        .mk-footer{background:var(--mk-dark);color:#adb5bd;text-align:center;padding:18px 15px;font-size:14px}
        .mk-footer p{margin:0}
        {$floatsCss}
        @media(max-width:991px){.mk-tiles,.mk-gallery{grid-template-columns:repeat(2,1fr);gap:20px}
        .mk-burger{display:flex}
        .mk-nav{display:none;position:absolute;top:100%;left:0;right:0;flex-direction:column;gap:0;background:#fff;box-shadow:0 8px 16px rgba(0,0,0,.1);padding:8px 15px}
        .mk-nav a{padding:12px 6px;border-bottom:1px solid #f1f3f5}
        .mk-nav-toggle:checked~.mk-nav{display:flex}}
        @media(max-width:767px){.mk-contact{grid-template-columns:1fr;gap:20px}.mk-hero-caption{padding:0 64px}.mk-arrows{padding:0 10px}.mk-arrows label{width:38px;height:38px}.mk-map{height:320px}}
        @media(max-width:560px){.mk-hero-caption{padding:0 20px}.mk-arrows{display:none}.mk-hero-btn{padding:10px 20px;font-size:14px}.mk-section{padding:50px 15px}.mk-tiles{gap:12px}.mk-brand-name{font-size:16px}.mk-logo{height:48px}.mk-title h2,.mk-about h2{font-size:26px}.mk-tile figcaption{font-size:12px;padding:10px 6px}}
        @media(prefers-reduced-motion:reduce){.mk-hero-caption{animation:none}.mk-tile-img img,.mk-tile-img::after{transition:none}}
        CSS;

        return ['html' => trim($html), 'css' => trim($css), 'liveCss' => trim($heroCss)];
    }

    /**
     * The banner: photos cross-fade under a dark overlay carrying the name
     * and call/contact buttons, with prev/next arrows and dots. Published
     * pages have scripts stripped, so it is all CSS — the slides fade on a
     * keyframe loop until a visitor picks one, then a radio per slide holds
     * that slide (and its arrows and dot) in place.
     */
    private static function heroCarousel(array $ctx): array
    {
        $slides = $ctx['slides'];
        $count = count($slides);
        $phone = Icons::PHONE;
        $tagText = $ctx['category'].($ctx['category'] && $ctx['city'] ? ' · ' : '').$ctx['city'];
        $tag = $tagText !== '' ? "<p class=\"mk-hero-tag\">{$tagText}</p>" : '';
        $caption = <<<HTML
          <div class="mk-hero-caption">
            {$tag}
            <h1>{$ctx['name']}</h1>
            <div class="mk-hero-actions">
              <a class="mk-hero-btn" href="tel:{$ctx['phone']}">{$phone} Call Now</a>
              <a class="mk-hero-btn mk-hero-btn-ghost" href="#contact">Contact Us</a>
            </div>
          </div>
        HTML;

        $slidesHtml = $count
            ? collect($slides)->map(fn ($s) => "<div class=\"mk-slide\"><img src=\"{$s['url']}\" alt=\"{$ctx['name']}\"/></div>")->implode('')
            : '<div class="mk-slide mk-slide-empty"></div>';

        if ($count <= 1) {
            // Spelled out so it also switches off a longer slider's saved animation.
            return ['html' => "<div class=\"mk-slides\">{$slidesHtml}</div>{$caption}", 'css' => '.mk-slide,.mk-arrows,.mk-dot{animation:none}'];
        }

        $prevIcon = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M15 18l-6-6 6-6"/></svg>';
        $nextIcon = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18l6-6-6-6"/></svg>';
        $radios = '';
        $arrows = '';
        $dots = '';
        $delays = '';
        $picked = '';
        for ($i = 1; $i <= $count; $i++) {
            $prev = ($i + $count - 2) % $count + 1;
            $next = $i % $count + 1;
            $delay = ($i - 1) * 5;
            $radios .= "<input type=\"radio\" name=\"mk-hero\" id=\"mk-hero-{$i}\" class=\"mk-hero-radio\" aria-label=\"Show photo {$i}\"/>";
            $arrows .= "<div class=\"mk-arrows\"><label for=\"mk-hero-{$prev}\" aria-label=\"Previous photo\">{$prevIcon}</label><label for=\"mk-hero-{$next}\" aria-label=\"Next photo\">{$nextIcon}</label></div>";
            $dots .= "<label class=\"mk-dot\" for=\"mk-hero-{$i}\" aria-label=\"Show photo {$i}\"></label>";
            $delays .= ".mk-slide:nth-child({$i}),.mk-arrows:nth-child({$i}),.mk-dot:nth-child({$i}){animation-delay:{$delay}s}";
            $picked .= "#mk-hero-{$i}:checked~.mk-slides .mk-slide:nth-child({$i}){opacity:1}"
                ."#mk-hero-{$i}:checked~.mk-hero-nav .mk-arrows:nth-child({$i}){visibility:visible}"
                ."#mk-hero-{$i}:checked~.mk-dots .mk-dot:nth-child({$i}){background:#fff}";
        }

        // Each photo holds for 5s, the first second of which is its fade-in.
        $duration = $count * 5;
        $hold = number_format(100 / $count, 3, '.', '');
        $fadeIn = number_format(20 / $count, 3, '.', '');
        $fadeOut = number_format(120 / $count, 3, '.', '');
        $off = number_format(100 / $count + 0.01, 3, '.', '');

        $css = ".mk-slide,.mk-arrows,.mk-dot{animation-duration:{$duration}s;animation-iteration-count:infinite}
.mk-slide{animation-name:mk-fade}.mk-arrows{animation-name:mk-arrows-on}.mk-dot{animation-name:mk-dot-on}
{$delays}
.mk-hero:hover .mk-slide,.mk-hero:hover .mk-arrows,.mk-hero:hover .mk-dot{animation-play-state:paused}
.mk-hero-radio:checked~.mk-slides .mk-slide,.mk-hero-radio:checked~.mk-hero-nav .mk-arrows,.mk-hero-radio:checked~.mk-dots .mk-dot{animation:none}
{$picked}
@keyframes mk-fade{0%{opacity:0}{$fadeIn}%,{$hold}%{opacity:1}{$fadeOut}%,100%{opacity:0}}
@keyframes mk-arrows-on{0%,{$hold}%{visibility:visible}{$off}%,100%{visibility:hidden}}
@keyframes mk-dot-on{0%,{$hold}%{background:#fff}{$off}%,100%{background:rgba(255,255,255,.5)}}
@media(prefers-reduced-motion:reduce){.mk-slide,.mk-arrows,.mk-dot{animation:none}.mk-slide:first-child{opacity:1}.mk-arrows:first-child{visibility:visible}.mk-dot:first-child{background:#fff}.mk-hero-radio:checked~.mk-slides .mk-slide:first-child{opacity:0}.mk-hero-radio:checked~.mk-hero-nav .mk-arrows:first-child{visibility:hidden}.mk-hero-radio:checked~.mk-dots .mk-dot:first-child{background:rgba(255,255,255,.5)}}";

        return [
            'html' => "{$radios}<div class=\"mk-slides\">{$slidesHtml}</div>{$caption}<div class=\"mk-hero-nav\">{$arrows}</div><div class=\"mk-dots\">{$dots}</div>",
            'css' => $css,
        ];
    }
}
