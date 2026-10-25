<?php

namespace App\Support\SiteBuilder\Templates;

use App\Support\SiteBuilder\Helpers;
use App\Support\SiteBuilder\Icons;

/**
 * Standard — a faithful port of the classic one-page business site (logo +
 * name header, full-width banner carousel, "About us", captioned services
 * grid, Instagram row, satellite map, contact block beside the form, share
 * menu and floating WhatsApp popup). Markup and class names follow the
 * original; its jQuery plugins (Owl carousel, nav toggle, share menu,
 * floating WhatsApp) are recreated in CSS because published pages have
 * scripts stripped.
 *
 * The app's own stylesheet is loaded on the published page and shares some
 * class names with this markup (container, btn, btn-primary, hidden,
 * collapse), so every rule is scoped under .mkd-site — see scope().
 */
class StandardTemplate
{
    public const ID = 'standard';

    // The original page's typeface; the published page links it (see
    // TemplateRegistry::fontUrl) since @import is stripped from site CSS.
    public const FONT_URL = 'https://fonts.googleapis.com/css2?family=Overpass:wght@100;300;400;700&display=swap';

    private const SHARE = '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M18 16.1c-.8 0-1.5.3-2 .8l-7.1-4.2c.1-.2.1-.5.1-.7s0-.5-.1-.7L16 7.2c.5.5 1.2.8 2 .8 1.7 0 3-1.3 3-3s-1.3-3-3-3-3 1.3-3 3c0 .2 0 .5.1.7L8 9.8C7.5 9.3 6.8 9 6 9c-1.7 0-3 1.3-3 3s1.3 3 3 3c.8 0 1.5-.3 2-.8l7.1 4.2c-.1.2-.1.4-.1.6 0 1.6 1.3 2.9 2.9 2.9s2.9-1.3 2.9-2.9-1.2-2.9-2.8-2.9"/></svg>';

    private const FACEBOOK = '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M14 13.5h2.5l1-4H14v-2c0-1 0-2 2-2h1.5V2.1c-.3 0-1.6-.1-2.9-.1C11.9 2 10 3.7 10 6.7v2.8H7v4h3V22h4z"/></svg>';

    private const TWITTER = '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M23 4.6c-.8.4-1.7.6-2.6.7.9-.6 1.6-1.4 2-2.5-.9.5-1.9.9-2.9 1.1a4.5 4.5 0 00-7.7 4.1A12.8 12.8 0 011.6 3.3a4.5 4.5 0 001.4 6 4.4 4.4 0 01-2-.6v.1c0 2.2 1.5 4 3.6 4.4-.7.2-1.4.2-2 .1.6 1.8 2.2 3.1 4.2 3.1A9 9 0 010 18.3a12.8 12.8 0 006.9 2c8.3 0 12.8-6.9 12.8-12.8v-.6c.9-.6 1.6-1.4 2.2-2.3z"/></svg>';

    private const GOOGLE_PLUS = '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M8 10.8v2.6h4.3c-.2 1.1-1.3 3.3-4.3 3.3a4.7 4.7 0 010-9.4c1.5 0 2.4.6 3 1.1l2-2C11.8 5.3 10.1 4.5 8 4.5a7.5 7.5 0 100 15c4.3 0 7.2-3 7.2-7.3l-.1-1.4zm16 0h-2.2V8.6h-2.2v2.2h-2.2V13h2.2v2.2h2.2V13H24z"/></svg>';

    private const PLUS_CIRCLE = '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 2a10 10 0 100 20 10 10 0 000-20m5 11h-4v4h-2v-4H7v-2h4V7h2v4h4z"/></svg>';

    public static function meta(): array
    {
        return [
            'id' => self::ID,
            'name' => 'Standard',
            'description' => 'The classic one-page site: banner carousel, About us, captioned services grid, satellite map, contact form, share menu and WhatsApp popup.',
            'accent' => '#ee1c25',
            'bestFor' => 'Clinics, shops and service businesses',
        ];
    }

    public static function build(array $ctx): array
    {
        $phone = Icons::PHONE;
        $pin = Icons::PIN;
        $clock = Icons::CLOCK;
        $mail = Icons::MAIL;
        $whatsapp = Icons::WHATSAPP;
        $instagram = Icons::INSTAGRAM;
        $share = self::SHARE;
        $facebook = self::FACEBOOK;
        $twitter = self::TWITTER;
        $googlePlus = self::GOOGLE_PLUS;
        $plus = self::PLUS_CIRCLE;

        // WhatsApp needs the country code; local numbers are Indian.
        $waNumber = strlen($ctx['phoneDigits']) === 10 ? "91{$ctx['phoneDigits']}" : $ctx['phoneDigits'];
        $waChat = "https://wa.me/{$waNumber}?text=".rawurlencode("I'd like to talk to you");
        $siteUrl = $ctx['siteUrl'];
        $shareUrl = rawurlencode($siteUrl);

        $logoImg = $ctx['logoSrc'] ? "<img src=\"{$ctx['logoSrc']}\" alt=\"\">" : '';
        $banner = self::banner($ctx);

        // The photos double as the services showcase, each captioned with
        // what it shows — the way these pages are filled in. Services with
        // no photo still get a box.
        $boxes = collect($ctx['photos'])->map(fn ($p) => <<<HTML
                        <div class="col-lg-3 col-md-6 col-sm-6 col-xs-12 col-6 image text-center">
                            <div class="w-box">
                                <div class="img-wrapper">
                                    <a href="{$p['url']}" target="_blank" rel="noreferrer"><img src="{$p['url']}" class="img-responsive" alt="{$p['caption']}"></a>
                                    <div class="img-overlay">{$plus}</div>
                                </div>
                                <p>{$p['caption']}</p>
                            </div>
                        </div>
            HTML)->implode('');
        if ($boxes === '') {
            $boxes = collect($ctx['services'])->map(fn ($s) => <<<HTML
                        <div class="col-lg-3 col-md-6 col-sm-6 col-xs-12 col-6 image text-center">
                            <div class="w-box w-box-text">
                                <p>{$s['name']}</p>
                            </div>
                        </div>
                HTML)->implode('');
        }
        $servicesSection = $boxes === '' ? '' : <<<HTML
            <div class="popular_sec" id="services">
                <div class="container">
                    <div class="title">
                        <h2>Our Services</h2>
                    </div>
                    <section class="service-gallery">
                        <div class="container">
                            <div id="image-gallery">
                                <div class="row">
            {$boxes}
                                </div>
                            </div>
                        </div>
                    </section>
                </div>
            </div>
            HTML;

        $galleryItems = collect($ctx['gallery'])->map(fn ($g) => "<div class=\"col-lg-3 col-md-4 col-6 g-item\"><a href=\"{$g['url']}\" target=\"_blank\" rel=\"noreferrer\"><img src=\"{$g['url']}\" alt=\"{$g['caption']}\" loading=\"lazy\"></a></div>")->implode('');
        $gallerySection = $galleryItems === '' ? '' : <<<HTML
            <div class="popular_sec our_gallery" id="gallery">
                <div class="container">
                    <div class="title">
                        <h2>Our Gallery</h2>
                    </div>
                    <div class="row">{$galleryItems}</div>
                </div>
            </div>
            HTML;

        $socialSection = $ctx['instagram'] ? <<<HTML
            <div class="socail_feeds">
                <div class="container">
                    <div class="row">
                        <div class="col-md-4">
                            <h5>Follow Us On Instagram <a href="https://www.instagram.com/{$ctx['instagram']}/" target="_blank" rel="noreferrer" class="insta">{$instagram}</a></h5>
                            <a href="https://www.instagram.com/{$ctx['instagram']}/" target="_blank" rel="noreferrer" class="insta-badge" aria-label="Instagram">{$instagram}</a>
                        </div>
                    </div>
                </div>
            </div>
            HTML : '';

        $hoursItem = $ctx['workingTime'] ? <<<HTML
                                <div class="list">
                                    <span class="sml_title">{$clock} Working Time</span>
                                    <p>{$ctx['workingTime']}</p>
                                </div>
            HTML : '';
        $emailItem = $ctx['email'] ? <<<HTML
                                <div class="list">
                                    <span class="sml_title">{$mail} EMAIL</span>
                                    <a href="mailto:{$ctx['email']}">{$ctx['email']}</a>
                                </div>
            HTML : '';

        [$lat, $lng] = explode(',', $ctx['mapsQuery']);
        $mapUrl = "https://maps.google.com/maps?q={$lat},{$lng}&amp;t=k&amp;z=18&amp;output=embed";

        $html = <<<HTML
        <div class="mkd-site">
        <div id="social-share">
          <input type="checkbox" id="mkd-share" class="mkd-toggle" aria-label="Share"/>
          <ul class="social-itens hidden">
            <li><button type="button" class="btn-share social-item-3"><a href="https://www.facebook.com/sharer/sharer.php?u={$shareUrl}" target="_blank" rel="noreferrer">{$facebook}</a></button></li>
            <li><button type="button" class="btn-share social-item-2"><a href="https://twitter.com/intent/tweet?url={$shareUrl}" target="_blank" rel="noreferrer">{$twitter}</a></button></li>
            <li><button type="button" class="btn-share social-item-1"><a href="https://plus.google.com/share?url={$shareUrl}" target="_blank" rel="noreferrer">{$googlePlus}</a></button></li>
            <li><button type="button" class="btn-share social-item-7"><a href="whatsapp://send?text={$shareUrl}" data-action="share/whatsapp/share" target="_blank" rel="noreferrer">{$whatsapp}</a></button></li>
          </ul>
          <div class="social-open-menu">
            <label for="mkd-share" class="btn-share">{$share}</label>
          </div>
        </div>

        <header>
          <div class="container">
            <div class="wrapper">
              <nav class="navbar navbar-expand-lg">
                <a class="navbar-brand logo" href="#home">{$logoImg}<h1 class="h1logo">{$ctx['name']}</h1></a>
                <input type="checkbox" id="mkd-nav" class="mkd-toggle" aria-label="Toggle navigation"/>
                <label for="mkd-nav" class="navbar-toggler collapsed"><span class="navbar-toggler-icon"></span></label>
                <div class="collapse navbar-collapse" id="navbarNavDropdown">
                  <ul class="navbar-nav ml-auto main_nav">
                    <li class="nav-item active"><a class="nav-link act-link" href="#home">Home<span class="sr-only">(current)</span></a></li>
                    <li class="nav-item"><a class="nav-link" href="#about">About Us</a></li>
                    <li class="nav-item"><a class="nav-link" href="#contact">Contact Us</a></li>
                  </ul>
                </div>
              </nav>
            </div>
          </div>
        </header>

        <div class="banner" id="home">
          <div class="owl-carousel main_banner">
            {$banner['html']}
          </div>
        </div>

        <div class="about_section" id="about">
          <div class="container">
            <div class="row">
              <div class="col-md-12 text-center">
                <div class="content">
                  <div class="ab">
                    <h2>About us</h2>
                    <br>
                    <p>{$ctx['description']}</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {$servicesSection}

        {$gallerySection}

        {$socialSection}

        <div class="contact_wrap" id="map">
          <div class="container">
            <div class="col-md-12">
              <div class="title">
                <h2 class="map-title">Google Map</h2>
              </div>
              <div class="gmap">
                <iframe src="{$mapUrl}" width="100%" height="450" style="border:0;" loading="lazy" title="Map to {$ctx['name']}"></iframe>
                <div class="text-center"><a href="{$ctx['directionsUrl']}" target="_blank" rel="noreferrer" class="btn btn-primary mb-2">Goto Shop</a></div>
              </div>
            </div>
          </div>
        </div>

        <div class="contact_wrap" id="contact">
          <div class="container">
            <div class="title">
              <h2>Contact US</h2>
            </div>
            <div class="row contact-new">
              <div class="col-md-5">
                <div class="contact_info">
                  <div class="list">
                    <span class="sml_title">{$pin} ADDRESS</span>
                    <p>{$ctx['address']}</p>
                  </div>
        {$hoursItem}
                  <div class="list">
                    <span class="sml_title">{$phone} CALL US</span>
                    <a href="tel:{$ctx['phone']}">{$ctx['phone']}</a>
                  </div>
        {$emailItem}
                </div>
              </div>
              <div class="col-md-7">
                <div class="contact_form">
                  <form data-mk-form="enquiry">
                    <div class="row">
                      <div class="col"><input type="text" name="name" class="form-control" placeholder="Name"></div>
                    </div>
                    <div class="row">
                      <div class="col"><input type="email" name="email" class="form-control" placeholder="Email address"></div>
                    </div>
                    <div class="row">
                      <div class="col"><input type="text" name="subject" class="form-control" placeholder="Subject"></div>
                    </div>
                    <div class="row">
                      <div class="col-12">
                        <div class="form-group">
                          <textarea name="message" placeholder="Message..." class="form-control" rows="3"></textarea>
                        </div>
                      </div>
                      <div class="col-12">
                        <button type="submit" class="btn btn-primary mb-2">Submit</button>
                      </div>
                    </div>
                  </form>
                </div>
              </div>
            </div>
          </div>
        </div>

        <footer>
          <div class="copyright">
            <div class="container text-center">
              <p>Developed by MydomainBook.com</p>
            </div>
          </div>
        </footer>

        <div id="myButton" class="floating-wpp">
          <input type="checkbox" id="mkd-wpp" class="mkd-toggle" aria-label="WhatsApp chat"/>
          <div class="floating-wpp-popup">
            <label for="mkd-wpp" class="floating-wpp-head"><span>Welcome!</span><strong>&times;</strong></label>
            <div class="floating-wpp-message">Hello, how can we help you?</div>
            <div class="floating-wpp-input-message">
              <span>I'd like to talk to you</span>
              <a class="floating-wpp-btn-send" href="{$waChat}" target="_blank" rel="noreferrer" aria-label="Send">{$whatsapp}</a>
            </div>
          </div>
          <label for="mkd-wpp" class="floating-wpp-button">{$whatsapp}</label>
        </div>
        </div>
        HTML;

        $css = self::scope(self::css($banner['css']), '.mkd-site');

        return ['html' => trim($html), 'css' => trim($css), 'liveCss' => trim(self::scope($banner['css'], '.mkd-site'))];
    }

    /**
     * The Owl carousel the original used (fade, 3s per slide, dots),
     * rebuilt as a CSS animation. Slides are stacked and cross-fade.
     */
    private static function banner(array $ctx): array
    {
        $slides = collect($ctx['slides'])->values();
        $count = $slides->count();
        if ($count === 0) {
            return ['html' => '<div class="owl-item owl-empty"></div>', 'css' => '.owl-item{animation:none}'];
        }

        $items = $slides->map(fn ($s, $i) => "<div class=\"owl-item owl-item-".($i + 1)."\"><img src=\"{$s['url']}\" alt=\"\"></div>")->implode('');
        if ($count === 1) {
            return ['html' => $items, 'css' => '.owl-item{opacity:1;animation:none}'];
        }

        $dots = $slides->map(fn ($_, $i) => '<span class="owl-dot owl-dot-'.($i + 1).'"><span></span></span>')->implode('');
        $duration = $count * 3;
        $visible = number_format(100 / $count, 3, '.', '');
        $fade = number_format(min(8, 100 / $count / 3), 3, '.', '');
        $css = "@keyframes mkd-fade{0%{opacity:0}{$fade}%{opacity:1}{$visible}%{opacity:1}".number_format($visible + $fade, 3, '.', '')."%{opacity:0}100%{opacity:0}}
@keyframes mkd-dot{0%{background:#ee1c25}{$visible}%{background:#ee1c25}".number_format($visible + 0.01, 3, '.', '')."%{background:#fff}100%{background:#fff}}
.owl-item,.owl-dot span{animation-duration:{$duration}s;animation-iteration-count:infinite}
.owl-item{animation-name:mkd-fade}
.owl-dot span{animation-name:mkd-dot}
.main_banner:hover .owl-item,.main_banner:hover .owl-dot span{animation-play-state:paused}";
        for ($i = 0; $i < $count; $i++) {
            $n = $i + 1;
            $delay = $i * 3;
            $css .= "\n.owl-item-{$n},.owl-dot-{$n} span{animation-delay:{$delay}s}";
        }

        return ['html' => $items."<div class=\"owl-dots\">{$dots}</div>", 'css' => $css];
    }

    private static function css(string $bannerCss): string
    {
        return <<<CSS
        :scope{font-family:'Overpass',sans-serif;font-size:14px;line-height:1.5;color:#212529;background:#fff;text-align:left}
        *,*::before,*::after{box-sizing:border-box}
        h1,h2,h3,h4,h5{margin-top:0;margin-bottom:.5rem;font-weight:500;line-height:1.2}
        h2{font-size:2rem}
        h5{font-size:1.25rem}
        p{margin-top:0;margin-bottom:1rem}
        ul{margin-top:0;margin-bottom:1rem}
        a{color:#007bff;text-decoration:none;background-color:transparent}
        a:hover{color:#0056b3;text-decoration:underline}
        img{vertical-align:middle;border-style:none;display:inline}
        svg{width:1em;height:1em;vertical-align:-.125em;display:inline-block}
        button{font-family:inherit;margin:0}
        .mkd-toggle{position:absolute;opacity:0;pointer-events:none;width:0;height:0}
        .container{width:100%;max-width:none;padding-right:15px;padding-left:15px;margin-right:auto;margin-left:auto}
        @media (min-width:576px){.container{max-width:540px}}
        @media (min-width:768px){.container{max-width:720px}}
        @media (min-width:992px){.container{max-width:960px}}
        @media (min-width:1200px){.container{max-width:1140px}}
        .row{display:flex;flex-wrap:wrap;margin-right:-15px;margin-left:-15px}
        .col,.col-6,.col-12,.col-xs-12,.col-sm-6,.col-md-4,.col-md-5,.col-md-6,.col-md-7,.col-md-12,.col-lg-3{position:relative;width:100%;padding-right:15px;padding-left:15px}
        .col{flex-basis:0;flex-grow:1;max-width:100%}
        .col-6{flex:0 0 50%;max-width:50%}
        .col-12{flex:0 0 100%;max-width:100%}
        @media (min-width:576px){.col-sm-6{flex:0 0 50%;max-width:50%}}
        @media (min-width:768px){.col-md-4{flex:0 0 33.333333%;max-width:33.333333%}.col-md-5{flex:0 0 41.666667%;max-width:41.666667%}.col-md-6{flex:0 0 50%;max-width:50%}.col-md-7{flex:0 0 58.333333%;max-width:58.333333%}.col-md-12{flex:0 0 100%;max-width:100%}}
        @media (min-width:992px){.col-lg-3{flex:0 0 25%;max-width:25%}}
        .text-center{text-align:center}
        .ml-auto{margin-left:auto}
        .mb-2{margin-bottom:.5rem}
        .sr-only{position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap;border:0}
        .form-group{margin-bottom:1rem}
        .form-control{display:block;width:100%;height:calc(1.5em + .75rem + 2px);padding:.375rem .75rem;font-family:inherit;font-size:1rem;font-weight:400;line-height:1.5;color:#495057;background-color:#fff;background-clip:padding-box;border:1px solid #ced4da;border-radius:.25rem;transition:border-color .15s ease-in-out,box-shadow .15s ease-in-out}
        .form-control:focus{color:#495057;background-color:#fff;border-color:#80bdff;outline:0;box-shadow:0 0 0 .2rem rgba(0,123,255,.25)}
        textarea.form-control{height:auto;resize:vertical}
        .btn{display:inline-block;gap:0;font-family:inherit;font-weight:500;color:#212529;text-align:center;vertical-align:middle;cursor:pointer;user-select:none;background-color:transparent;border:1px solid transparent;padding:.375rem .75rem;font-size:14px;line-height:1.5;border-radius:5rem;box-shadow:none;transition:color .15s ease-in-out,background-color .15s ease-in-out,border-color .15s ease-in-out}
        .btn:hover{text-decoration:none}
        .btn-primary{color:#fff;background-color:#007bff;border-color:#007bff}
        .btn-primary:hover{color:#fff;background-color:#0069d9;border-color:#0062cc}

        .navbar{position:relative;display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;padding:0;flex-grow:1}
        .navbar-brand{display:flex;align-items:center;padding-top:.3125rem;padding-bottom:.3125rem;margin-right:0;font-size:1.25rem;line-height:inherit}
        .navbar-brand:hover{text-decoration:none}
        .navbar-nav{display:flex;flex-direction:column;padding-left:0;margin-bottom:0;list-style:none}
        .nav-link{display:block;padding:.5rem 1rem}
        .navbar-collapse{flex-basis:100%;flex-grow:1;align-items:center}
        .collapse{visibility:visible}
        .collapse:not(.show){display:none}
        .navbar-toggler{line-height:1;background:none;border:1px solid transparent;border-radius:.25rem;cursor:pointer;position:absolute;right:-5px;top:25px;height:20px;width:23px;padding:0;display:flex;align-items:center}
        .navbar-toggler-icon{display:inline-block;vertical-align:middle;position:relative;height:3px;width:100%;background:none}
        .navbar-toggler-icon::after,.navbar-toggler-icon::before{position:absolute;content:'';height:100%;width:100%;background:#000;left:0}
        .navbar-toggler-icon::after{transform:rotate(45deg);transform-origin:right;top:7px;transition-duration:.4s}
        .navbar-toggler-icon::before{transform:rotate(-45deg);transform-origin:right;top:-7px;transition-duration:.4s}
        .navbar-toggler.collapsed .navbar-toggler-icon{background:#000}
        .navbar-toggler.collapsed .navbar-toggler-icon::before{top:-7px;transform:none;transition-duration:.4s}
        .navbar-toggler.collapsed .navbar-toggler-icon::after{top:7px;transform:none;transition-duration:.4s}
        #mkd-nav:checked + .navbar-toggler.collapsed .navbar-toggler-icon{background:none}
        #mkd-nav:checked + .navbar-toggler.collapsed .navbar-toggler-icon::before{top:-7px;transform:rotate(-45deg)}
        #mkd-nav:checked + .navbar-toggler.collapsed .navbar-toggler-icon::after{top:7px;transform:rotate(45deg)}
        #mkd-nav:checked ~ .navbar-collapse{display:block}
        @media (min-width:992px){.navbar-expand-lg{flex-flow:row nowrap;justify-content:flex-start}.navbar-expand-lg .navbar-nav{flex-direction:row}.navbar-expand-lg .navbar-collapse{display:flex;flex-basis:auto}.navbar-expand-lg .navbar-toggler{display:none}}

        header{position:sticky;top:0;width:100%;transition:all .5s ease;z-index:999;background:#fff;padding:5px 0;box-shadow:0 1px 1px rgba(0,0,0,.01),0 10px 30px rgba(0,0,0,.08)}
        header .wrapper{display:flex;flex-direction:row;justify-content:space-between;align-items:baseline}
        header .wrapper .navbar-brand{display:flex;align-items:center}
        .logo img{max-width:200px;max-height:80px;margin-right:8px}
        .navbar-brand h1{font-size:20px;font-weight:600;margin:5px 0;color:#000;text-transform:uppercase}
        .h1logo{overflow-wrap:break-word;word-wrap:break-word;word-break:break-word;hyphens:auto}
        .main_nav.navbar-nav a.nav-link{color:#000;font-size:14px;font-weight:600;padding-right:.8rem;padding-left:.8rem;text-transform:uppercase}

        .banner{position:relative;height:600px}
        .main_banner{position:relative;height:100%;overflow:hidden}
        .owl-item{position:absolute;inset:0;opacity:0}
        .owl-item img{width:100%;height:100%;object-fit:cover;display:block}
        .owl-empty{opacity:1;background:#f1f7ff}
        .banner .owl-dots{position:absolute;bottom:50px;left:48%;z-index:999;display:flex}
        .banner .owl-dots .owl-dot{padding:5px}
        .banner .owl-dots .owl-dot span{width:15px;height:15px;background:#fff;display:inline-block;border-radius:50px}
        {$bannerCss}

        .about_section{padding:100px 0}
        .about_section .content p{line-height:26px}
        .ab h2{text-transform:uppercase}

        .title{text-transform:uppercase}
        .popular_sec{padding-bottom:50px;padding-top:50px;background:#f1f7ff}
        .popular_sec .title{text-align:center;margin-bottom:30px}
        .service-gallery{padding-top:0}
        .service-gallery .container{padding:0}
        .our_gallery .g-item{padding:8px}
        .our_gallery img{width:100%;aspect-ratio:4/3;object-fit:cover;border-radius:4px;display:block}
        .image{margin-bottom:25px}
        .w-box{background:#fff;width:100%;border-radius:5px;box-shadow:0 5px 15px rgba(0,0,0,.1);margin-bottom:5px;overflow:hidden}
        .w-box p{margin-top:5px;margin-bottom:0;padding:5px}
        .w-box-text{padding:30px 10px;font-weight:600}
        .img-wrapper{position:relative;height:260px}
        .img-wrapper img{width:100%;height:100%;object-fit:cover;display:block}
        .img-overlay{background:rgba(0,0,0,.7);width:100%;height:100%;position:absolute;top:0;left:0;display:flex;justify-content:center;align-items:center;opacity:0;pointer-events:none;transition:opacity .3s}
        .img-wrapper:hover .img-overlay{opacity:1}
        .img-overlay svg{color:#fff;width:3em;height:3em;font-size:14px}

        .socail_feeds{padding:30px 0;text-align:center}
        .socail_feeds h5 .insta{color:#c13584}
        .insta-badge{display:inline-flex;align-items:center;justify-content:center;width:50px;height:50px;border-radius:12px;color:#fff;background:linear-gradient(45deg,#f09433,#e6683c,#dc2743,#cc2366,#bc1888)}
        .insta-badge svg{width:28px;height:28px}

        .contact_wrap{padding-bottom:10px;padding-top:30px;background:#fafcff}
        .contact_wrap .title{text-align:center;margin-bottom:0}
        .contact_wrap .title .map-title{font-size:26px;font-weight:700;color:#4285f4;text-transform:none;margin:10px 0 20px}
        .gmap iframe{display:block;width:100%;height:450px;border:0;margin-bottom:15px}
        .contact-new{background:#fff;padding:50px 30px 30px 30px;box-shadow:0 5px 15px rgba(0,0,0,.1);border-radius:10px;margin-left:0;margin-right:0}
        .contact_wrap .contact_info{margin-top:20px}
        .contact_wrap .contact_info .list{margin-bottom:15px}
        .contact_wrap .contact_info .list .sml_title{font-weight:600;font-size:18px;display:block;margin-bottom:10px}
        .contact_wrap .contact_info .list p{width:100%}
        .contact_wrap .contact_info .list a{color:#000;text-decoration:none}
        .contact_wrap .contact_form .form-control{margin-bottom:15px;height:45px;background:#f4f4f4;border:1px solid #ddd}
        .contact_wrap .contact_form textarea.form-control{height:150px}
        .contact_wrap .contact_form .btn{width:150px;display:block;background:#ee1c25;border-color:#ee1c25;margin-top:0;padding:.575rem .75rem;border-radius:5px}

        footer{background:#fff;position:relative;color:#fff}
        .copyright{border-top:1px solid #fff;text-align:center;color:#fff;position:relative;z-index:2}
        .copyright p{margin:auto;padding:15px 0;font-size:14px;color:#000}

        #social-share{position:fixed;bottom:115px;right:30px;z-index:20}
        #social-share ul.social-itens{list-style:none;text-align:center;position:relative;display:block;padding:0;margin:0}
        #social-share ul.social-itens li{position:relative}
        #social-share .btn-share{position:relative;display:inline-flex;align-items:center;justify-content:center;cursor:pointer;border-radius:50%;color:#fff;line-height:1;outline:0;border:0;margin-top:15px;width:50px;height:50px;padding:0;font-size:18px;box-shadow:0 1px 3px rgba(0,0,0,.12),0 1px 2px rgba(0,0,0,.24)}
        #social-share .btn-share:hover{box-shadow:0 3px 6px rgba(0,0,0,.16),0 3px 6px rgba(0,0,0,.23)}
        #social-share .btn-share a{color:#fff;display:flex;align-items:center;justify-content:center;width:100%;height:100%}
        #social-share ul.social-itens li .btn-share{transform:scale(0);opacity:0;transition:all 500ms cubic-bezier(.68,-.55,.265,1.55)}
        #mkd-share:checked ~ ul.social-itens li .btn-share{transform:scale(1);opacity:1}
        #social-share .social-item-1{background-color:#dd4b39}
        #social-share .social-item-2{background-color:#00aced}
        #social-share .social-item-3{background-color:#3b5998}
        #social-share .social-item-7{background-color:#29a628}
        #social-share li:nth-child(1) .btn-share{transition-delay:.3s}
        #social-share li:nth-child(2) .btn-share{transition-delay:.2s}
        #social-share li:nth-child(3) .btn-share{transition-delay:.1s}
        #social-share div.social-open-menu .btn-share{background-color:#f44336}

        .floating-wpp{position:fixed;bottom:15px;left:15px;font-size:14px;z-index:60;transition:bottom .2s}
        .floating-wpp:hover{bottom:17px}
        .floating-wpp .floating-wpp-button{display:block;position:relative;width:72px;height:72px;border-radius:50%;background:#25d366;color:#fff;box-shadow:1px 1px 4px rgba(60,60,60,.4);transition:box-shadow .2s;cursor:pointer;overflow:hidden}
        .floating-wpp:hover .floating-wpp-button{box-shadow:1px 2px 8px rgba(60,60,60,.4)}
        .floating-wpp .floating-wpp-button svg{position:absolute;width:60%;height:60%;top:50%;left:50%;transform:translate3d(-50%,-50%,0)}
        .floating-wpp .floating-wpp-popup{border-radius:6px;background-color:#e5ddd5;position:absolute;overflow:hidden;padding:0;box-shadow:1px 2px 8px rgba(60,60,60,.25);width:0;height:0;bottom:0;opacity:0;transition:bottom .1s ease-out,opacity .2s ease-out;transform-origin:bottom}
        #mkd-wpp:checked ~ .floating-wpp-popup{padding:0 12px 12px 12px;width:260px;height:auto;bottom:82px;opacity:1}
        .floating-wpp .floating-wpp-head{text-align:right;color:#fff;background:#25d366;margin:0 -15px 10px -15px;padding:6px 15px;display:flex;justify-content:space-between;cursor:pointer}
        .floating-wpp .floating-wpp-message{background-color:#fff;padding:8px;border-radius:0 5px 5px 5px;box-shadow:1px 1px 1px rgba(0,0,0,.15)}
        .floating-wpp .floating-wpp-input-message{background-color:#fff;margin:10px -15px -15px -15px;padding:10px 15px;display:flex;align-items:center;justify-content:space-between;color:#555}
        .floating-wpp .floating-wpp-btn-send{margin-left:12px;color:#25d366;font-size:24px;display:flex}
        .floating-wpp .floating-wpp-btn-send svg{width:24px;height:24px}

        @media (max-width:991.98px){.main_nav.navbar-nav a.nav-link{padding:1rem .8rem;border-bottom:1px solid #e1e1e1;font-size:14px}.main_banner{height:400px}}
        @media (max-width:767.98px){.navbar-collapse{background:#f4f4f4}.navbar-brand h1{font-size:18px;white-space:break-spaces}.socail_feeds .col-md-4{padding-top:15px}.banner .owl-dots{left:15px;bottom:15px}header .wrapper{display:flex}.contact_wrap .title h2,.popular_sec .title h2{font-size:26px;font-weight:600}.about_section{padding:30px 0}.popular_sec{padding-bottom:30px;padding-top:30px}}
        @media (max-width:575.98px){.main_banner{height:290px}.banner{height:300px;margin-bottom:0}.logo img{max-width:110px}.popular_sec .title{margin-top:0}}
        @media only screen and (max-width:600px){#social-share{bottom:85px;right:20px}.img-wrapper{height:140px}.image{padding:5px}.w-box{padding:0}}
        @media (prefers-reduced-motion:reduce){.owl-item,.owl-dot span{animation:none}.owl-item-1{opacity:1}}
        CSS;
    }

    /**
     * Prefixes every selector with $prefix (":scope" becomes the prefix
     * itself), recursing into @media blocks and leaving @keyframes alone.
     */
    private static function scope(string $css, string $prefix): string
    {
        $out = '';
        $i = 0;
        $n = strlen($css);
        while ($i < $n) {
            $open = strpos($css, '{', $i);
            if ($open === false) {
                break;
            }
            $selector = trim(substr($css, $i, $open - $i));
            $depth = 1;
            $j = $open + 1;
            while ($j < $n && $depth > 0) {
                if ($css[$j] === '{') {
                    $depth++;
                } elseif ($css[$j] === '}') {
                    $depth--;
                }
                $j++;
            }
            $body = substr($css, $open + 1, $j - $open - 2);
            $i = $j;

            if (str_starts_with($selector, '@keyframes')) {
                $out .= "{$selector}{{$body}}\n";
            } elseif (str_starts_with($selector, '@media')) {
                $out .= "{$selector}{".trim(self::scope($body, $prefix))."}\n";
            } else {
                $scoped = collect(explode(',', $selector))
                    ->map(fn ($s) => trim($s) === ':scope' ? $prefix : "{$prefix} ".trim($s))
                    ->implode(',');
                $out .= "{$scoped}{".trim($body)."}\n";
            }
        }

        return $out;
    }
}
