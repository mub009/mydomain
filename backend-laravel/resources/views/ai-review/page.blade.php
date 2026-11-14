{{-- The public AI Google Review page (App\Http\Controllers\Web\AiReviewPageController):
     the AI writes the customer a review as soon as it opens; they pick their
     stars and language, can rewrite or edit it, then copy it and go to the
     business's Google page to paste and post it. Self-contained like the
     visiting card: no app CSS or JS. $b is escaped by Blade. --}}
<!doctype html>
<html lang="en" style="--brand:{{ $theme['brand'] }};--brand-dark:{{ $theme['brandDark'] }};--brand-light:{{ $theme['brandLight'] }};--bg-light:{{ $theme['bgLight'] }};--bg-dark:{{ $theme['bgDark'] }}">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
  <meta name="color-scheme" content="light dark" />
  <meta name="robots" content="noindex" />
  <meta name="format-detection" content="telephone=no" />
  <title>Review {{ $b['name'] }}</title>
  <meta property="og:title" content="Review {{ $b['name'] }} on Google" />
  @if ($b['logoUrl'])<meta property="og:image" content="{{ $b['logoUrl'] }}" />@endif
  <style>
    :root{
      --brand:#0f9e68;--brand-dark:#0c8a5a;--brand-light:#34d399;--bg-light:#c7f5de;--bg-dark:#04281c;
      --ink:#0f172a;--muted:#64748b;--line:#e2e8f0;--star:#f5b301;
      --card-bg:#ffffff;--content-bg:#ffffff;--bar-bg:rgba(255,255,255,.9);
      --page-grad:linear-gradient(160deg,var(--bg-light) 0%,#eaf7f0 42%,#f1f5f9 100%);
      --shadow:0 10px 30px -12px rgba(15,23,42,.18);--overlay-bg:rgba(15,23,42,.5);
      --copy-bg:#0f172a;--copy-fg:#ffffff;--chip-bg:#ffffff;
    }
    html.dark{
      --ink:#f1f5f9;--muted:#94a3b8;--line:#334155;--card-bg:#0f1b2b;--content-bg:#16233a;
      --bar-bg:rgba(15,23,43,.85);--page-grad:linear-gradient(160deg,var(--bg-dark) 0%,#0b1726 55%,#0b1220 100%);
      --shadow:0 10px 30px -12px rgba(0,0,0,.6);--overlay-bg:rgba(0,0,0,.65);
      --copy-bg:#ffffff;--copy-fg:#0f172a;--chip-bg:#16233a;
    }
    *{box-sizing:border-box}
    html,body{margin:0;padding:0}
    body{min-height:100vh;background:var(--page-grad);color:var(--ink);font-family:system-ui,-apple-system,"Segoe UI",Roboto,"Noto Sans","Noto Sans Malayalam","Noto Sans Devanagari",sans-serif;-webkit-font-smoothing:antialiased;line-height:1.5;transition:background .3s ease,color .3s ease;opacity:0}
    body.ready{opacity:1;transition:opacity .35s ease}
    button{font-family:inherit}
    a{color:inherit}
    @keyframes fadeUp{from{opacity:0;transform:translateY(14px)}to{opacity:1;transform:translateY(0)}}
    @keyframes spin{to{transform:rotate(360deg)}}

    .bar{position:fixed;top:12px;left:50%;transform:translateX(-50%);width:min(440px,calc(100% - 24px));background:var(--bar-bg);backdrop-filter:blur(10px);-webkit-backdrop-filter:blur(10px);border:1px solid var(--line);border-radius:999px;box-shadow:var(--shadow);display:flex;align-items:center;justify-content:space-between;padding:8px 8px 8px 16px;z-index:50}
    .bar-logo{display:flex;align-items:center;gap:6px;font-weight:800;font-size:14px;color:var(--brand-dark)}
    html.dark .bar-logo{color:var(--brand-light)}
    .bar-logo svg{width:16px;height:16px;flex-shrink:0}
    .theme-btn{width:32px;height:32px;border-radius:50%;border:0;background:none;display:flex;align-items:center;justify-content:center;cursor:pointer;color:var(--muted);-webkit-tap-highlight-color:transparent}
    .theme-btn:hover{background:rgba(15,23,42,.06)}
    html.dark .theme-btn:hover{background:rgba(255,255,255,.1)}
    .theme-btn svg{width:18px;height:18px}
    .theme-btn .moon{display:block}
    .theme-btn .sun{display:none}
    html.dark .theme-btn .moon{display:none}
    html.dark .theme-btn .sun{display:block}

    .page{max-width:460px;margin:0 auto;padding:76px 16px calc(32px + env(safe-area-inset-bottom))}
    section{animation:fadeUp .5s ease both}

    .biz-card{background:var(--card-bg);border-radius:22px;box-shadow:var(--shadow);padding:20px 18px 18px;border:1px solid var(--line);position:relative;margin-bottom:16px}
    .logo{width:72px;height:72px;border-radius:18px;margin-top:-44px;margin-bottom:10px;overflow:hidden;background:var(--content-bg);display:flex;align-items:center;justify-content:center;font-weight:800;font-size:24px;color:var(--brand-dark);border:3px solid var(--card-bg);box-shadow:0 4px 10px -4px rgba(15,23,42,.3)}
    .logo img{width:100%;height:100%;object-fit:cover;display:block}
    .biz-name{display:flex;align-items:center;gap:6px;margin:0;font-size:19px;font-weight:800}
    .tagline{margin:3px 0 0;font-size:13px;color:var(--muted)}
    .tick{position:relative;display:inline-flex;color:var(--brand);flex-shrink:0}
    .tick svg{width:16px;height:16px;display:block}
    .tick .tip{position:absolute;bottom:135%;left:50%;transform:translateX(-50%);width:200px;background:var(--content-bg);color:var(--ink);border:1px solid var(--line);border-radius:10px;padding:10px 12px;font-size:11px;line-height:1.5;font-weight:400;box-shadow:var(--shadow);opacity:0;visibility:hidden;transition:opacity .2s ease;pointer-events:none;z-index:5}
    .tick:hover .tip,.tick:focus .tip{opacity:1;visibility:visible}
    .social{display:flex;gap:10px;margin-top:12px}
    .social a{width:46px;height:46px;border-radius:13px;display:flex;align-items:center;justify-content:center;box-shadow:0 2px 6px -2px rgba(15,23,42,.3);transition:transform .15s ease}
    .social a:hover{transform:translateY(-2px)}
    .social svg{width:24px;height:24px;fill:#fff}
    .social a.facebook{background:#1877F2}
    .social a.instagram{background:radial-gradient(circle at 30% 107%,#fdf497 0%,#fdf497 5%,#fd5949 45%,#d6249f 60%,#285AEB 90%)}
    .social a.youtube{background:#FF0000}
    .social a.whatsapp{background:#25D366}

    .picker{background:var(--card-bg);border-radius:22px;box-shadow:var(--shadow);padding:18px;border:1px solid var(--line);margin-bottom:16px}
    .label{display:block;margin:0 0 8px;font-size:12px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:.05em}
    .label+.label{margin-top:16px}
    .stars{display:flex;gap:6px}
    .stars button{background:none;border:0;padding:2px;cursor:pointer;color:#cbd5e1;-webkit-tap-highlight-color:transparent}
    .stars button.on{color:var(--star)}
    .stars svg{width:34px;height:34px;display:block}
    .chips{display:flex;flex-wrap:wrap;gap:8px}
    .chips button{border:1px solid var(--line);background:var(--chip-bg);border-radius:999px;padding:7px 14px;font-size:14px;cursor:pointer;color:var(--ink);-webkit-tap-highlight-color:transparent}
    .chips button.on{background:var(--brand);border-color:var(--brand);color:#fff;font-weight:600}

    .review-card{border-radius:22px;overflow:hidden;background:linear-gradient(135deg,var(--brand),var(--brand-dark));box-shadow:var(--shadow);margin-bottom:16px}
    .review-head{display:flex;align-items:center;justify-content:space-between;padding:14px 18px}
    .review-status{display:flex;align-items:center;gap:10px;color:#fff;font-size:13px;font-weight:800;letter-spacing:.06em}
    .spin{display:none;width:16px;height:16px;border-radius:50%;border:2.5px solid rgba(255,255,255,.35);border-top-color:#fff;animation:spin .8s linear infinite;flex-shrink:0}
    .edit-btn{width:28px;height:28px;border-radius:8px;border:0;background:rgba(255,255,255,.25);display:flex;align-items:center;justify-content:center;cursor:pointer;flex-shrink:0;-webkit-tap-highlight-color:transparent}
    .edit-btn .dot{width:10px;height:10px;border-radius:2px;background:#fff;display:block}
    .edit-btn svg{width:15px;height:15px;fill:#fff;display:none}
    .review-body{background:var(--content-bg);border-radius:22px 22px 0 0;margin-top:-10px;padding:18px}
    textarea{width:100%;min-height:130px;resize:vertical;border:0;padding:0;font:inherit;font-size:15px;font-style:italic;color:var(--ink);background:transparent;line-height:1.6}
    textarea:focus{outline:none}
    .hint{margin:4px 0 0;font-size:12px;color:var(--muted)}
    .error{display:none;margin-top:10px;font-size:13px;color:#dc2626;background:rgba(220,38,38,.1);border-radius:10px;padding:8px 10px}
    .review-actions{display:flex;gap:10px;margin-top:16px}
    .copy-btn{flex:1;height:46px;border-radius:999px;border:0;background:var(--copy-bg);color:var(--copy-fg);font-size:14px;font-weight:700;display:flex;align-items:center;justify-content:center;gap:8px;cursor:pointer;box-shadow:0 10px 20px -8px rgba(0,0,0,.35);transition:transform .15s ease;-webkit-tap-highlight-color:transparent}
    .copy-btn:active{transform:scale(.97)}
    .copy-btn:disabled{opacity:.55;cursor:default}
    .copy-btn svg{width:17px;height:17px;flex-shrink:0}
    .regen-btn{width:46px;height:46px;border-radius:50%;border:0;background:var(--bg-light);color:var(--brand-dark);display:flex;align-items:center;justify-content:center;cursor:pointer;flex-shrink:0;transition:transform .15s ease;-webkit-tap-highlight-color:transparent}
    html.dark .regen-btn{background:rgba(255,255,255,.1);color:var(--brand-light)}
    .regen-btn:active{transform:scale(.92)}
    .regen-btn:disabled{opacity:.55;cursor:default}
    .regen-btn svg{width:19px;height:19px}
    .regen-btn svg.spin-icon{animation:spin .7s linear infinite}
    .copy-only{display:block;width:100%;background:none;border:0;margin-top:10px;font-size:12px;font-weight:700;color:var(--muted);cursor:pointer;text-align:center;padding:4px;-webkit-tap-highlight-color:transparent}
    .copy-only:disabled{opacity:.5;cursor:default}

    .powered{text-align:center;font-size:11px;color:var(--muted);margin:4px 0 0}

    .overlay{position:fixed;inset:0;background:var(--overlay-bg);backdrop-filter:blur(6px);-webkit-backdrop-filter:blur(6px);display:flex;align-items:center;justify-content:center;padding:24px;z-index:100;opacity:0;visibility:hidden;transition:opacity .25s ease,visibility .25s ease}
    .overlay.show{opacity:1;visibility:visible}
    .overlay-card{background:var(--content-bg);border-radius:20px;padding:28px 22px;text-align:center;width:240px;box-shadow:0 25px 50px -12px rgba(0,0,0,.4);border:1px solid var(--line);transform:scale(.92);transition:transform .25s cubic-bezier(.34,1.56,.64,1)}
    .overlay.show .overlay-card{transform:scale(1)}
    .g-icon{width:56px;height:56px;border-radius:50%;background:var(--card-bg);box-shadow:0 4px 10px -4px rgba(15,23,42,.3);display:flex;align-items:center;justify-content:center;margin:0 auto 14px;padding:12px}
    .g-icon svg{width:100%;height:100%}
    .overlay-title{font-size:17px;font-weight:800;margin:0 0 4px}
    .overlay-text{margin:0 0 14px;font-size:13px;color:var(--muted)}
    .loader{width:120px;height:4px;border-radius:999px;background:rgba(127,127,127,.25);position:relative;margin:0 auto 8px;overflow:hidden}
    .loader::before{content:"";position:absolute;inset:0 auto 0 0;width:40%;background:var(--brand);border-radius:999px;animation:loaderMove 1s ease-in-out infinite}
    @keyframes loaderMove{0%{left:-40%}50%{left:60%}100%{left:100%}}
    .redirect-label{font-size:10px;font-weight:800;letter-spacing:.06em;color:var(--brand-dark);text-transform:uppercase}
    html.dark .redirect-label{color:var(--brand-light)}
  </style>
</head>
<body>
  <div class="bar">
    <span class="bar-logo">
      <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 2.5l2.9 6.1 6.6.8-4.9 4.6 1.3 6.6L12 17.3l-5.9 3.3 1.3-6.6L2.5 9.4l6.6-.8z"/></svg>
      Markkito
    </span>
    <button type="button" class="theme-btn" data-theme-toggle aria-label="Toggle dark mode">
      <svg class="moon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/></svg>
      <svg class="sun" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="5"/><path d="M12 1v3M12 20v3M4.2 4.2l2.1 2.1M17.7 17.7l2.1 2.1M1 12h3M20 12h3M4.2 19.8l2.1-2.1M17.7 6.3l2.1-2.1"/></svg>
    </button>
  </div>

  <div class="page">
    <section class="biz-card" style="animation-delay:.02s">
      <div class="logo">
        @if ($b['logoUrl'])<img src="{{ $b['logoUrl'] }}" alt="{{ $b['name'] }} logo" />@else{{ $b['initials'] }}@endif
      </div>
      <h1 class="biz-name">
        {{ $b['name'] }}
        <span class="tick" tabindex="0">
          <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 1.5l2.4 1.4 2.8-.3 1.2 2.5 2.5 1.2-.3 2.8 1.4 2.4-1.4 2.4.3 2.8-2.5 1.2-1.2 2.5-2.8-.3L12 22.5l-2.4-1.4-2.8.3-1.2-2.5-2.5-1.2.3-2.8L2 12l1.4-2.4-.3-2.8 2.5-1.2 1.2-2.5 2.8.3z"/><path d="M8.5 12.2l2.4 2.4 4.6-4.9" fill="none" stroke="#fff" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>
          <span class="tip">Verified business on Markkito.</span>
        </span>
      </h1>
      @if ($b['tagline'])<p class="tagline">{{ $b['tagline'] }}</p>@endif
      @php($social = array_filter([$b['social']['facebook'] ?? null, $b['social']['instagram'] ?? null, $b['social']['youtube'] ?? null, $b['whatsappHref'] ?? null]))
      @if ($social)
        <div class="social">
          @if (!empty($b['social']['facebook']))
            <a class="facebook" href="{{ $b['social']['facebook'] }}" target="_blank" rel="noopener" aria-label="Facebook"><svg viewBox="0 0 50 50"><path d="M25 3C12.85 3 3 12.85 3 25c0 11.03 8.125 20.137 18.712 21.728V30.831h-5.443v-5.783h5.443V21.2c0-6.371 3.104-9.168 8.399-9.168 2.536 0 3.877.188 4.512.274v5.048h-3.612c-2.248 0-3.033 2.131-3.033 4.533v3.161h6.588l-.894 5.783h-5.694v15.944C38.716 45.318 47 36.137 47 25c0-12.15-9.85-22-22-22"/></svg></a>
          @endif
          @if (!empty($b['social']['instagram']))
            <a class="instagram" href="{{ $b['social']['instagram'] }}" target="_blank" rel="noopener" aria-label="Instagram"><svg viewBox="0 0 24 24"><path d="M8 3C5.243 3 3 5.243 3 8v8c0 2.757 2.243 5 5 5h8c2.757 0 5-2.243 5-5V8c0-2.757-2.243-5-5-5zm0 2h8c1.654 0 3 1.346 3 3v8c0 1.654-1.346 3-3 3H8c-1.654 0-3-1.346-3-3V8c0-1.654 1.346-3 3-3m9 1a1 1 0 0 1 0 2 1 1 0 0 1 0-2m-5 1c2.757 0 5 2.243 5 5s-2.243 5-5 5-5-2.243-5-5 2.243-5 5-5m0 2c-1.654 0-3 1.346-3 3s1.346 3 3 3 3-1.346 3-3-1.346-3-3-3"/></svg></a>
          @endif
          @if (!empty($b['social']['youtube']))
            <a class="youtube" href="{{ $b['social']['youtube'] }}" target="_blank" rel="noopener" aria-label="YouTube"><svg viewBox="0 0 24 24"><path d="M23.5 6.2a3 3 0 0 0-2.1-2.1C19.5 3.5 12 3.5 12 3.5s-7.5 0-9.4.6A3 3 0 0 0 .5 6.2 31.4 31.4 0 0 0 0 12a31.4 31.4 0 0 0 .5 5.8 3 3 0 0 0 2.1 2.1c1.9.6 9.4.6 9.4.6s7.5 0 9.4-.6a3 3 0 0 0 2.1-2.1A31.4 31.4 0 0 0 24 12a31.4 31.4 0 0 0-.5-5.8zM9.75 15.5v-7L16 12l-6.25 3.5z"/></svg></a>
          @endif
          @if (!empty($b['whatsappHref']))
            <a class="whatsapp" href="{{ $b['whatsappHref'] }}" target="_blank" rel="noopener" aria-label="WhatsApp"><svg viewBox="0 0 24 24"><path d="M20.52 3.48A11.86 11.86 0 0 0 12.06 0C5.5 0 .17 5.33.17 11.89c0 2.1.55 4.16 1.59 5.97L0 24l6.33-1.66a11.9 11.9 0 0 0 5.73 1.46h.01c6.56 0 11.89-5.33 11.89-11.89a11.82 11.82 0 0 0-3.44-8.43zM12.07 21.8c-1.79 0-3.54-.48-5.07-1.39l-.36-.21-3.76.99 1-3.66-.24-.38a9.83 9.83 0 1 1 8.43 4.65zm5.4-7.37c-.29-.15-1.71-.85-1.98-.95-.26-.1-.45-.15-.64.15-.19.29-.73.95-.9 1.14-.16.19-.33.22-.62.07-.29-.15-1.2-.44-2.28-1.4-.84-.75-1.41-1.67-1.57-1.95-.16-.29-.02-.44.12-.59.13-.13.29-.33.44-.49.15-.16.19-.29.29-.48.1-.19.05-.36-.02-.51-.07-.15-.64-1.54-.88-2.11-.23-.55-.46-.47-.64-.48h-.55c-.19 0-.49.07-.75.36-.26.29-.98.96-.98 2.34s1 2.72 1.14 2.91c.15.19 1.97 3.01 4.78 4.22.67.29 1.2.47 1.61.6.68.22 1.29.19 1.78.12.54-.08 1.71-.7 1.95-1.37.24-.67.24-1.24.17-1.36-.07-.12-.26-.19-.55-.34z"/></svg></a>
          @endif
        </div>
      @endif
    </section>

    <section class="picker" style="animation-delay:.08s">
      <span class="label" id="stars-label">Your rating</span>
      <div class="stars" role="radiogroup" aria-labelledby="stars-label" data-stars>
        @for ($i = 1; $i <= 5; $i++)
          <button type="button" role="radio" aria-checked="false" aria-label="{{ $i }} star{{ $i > 1 ? 's' : '' }}" data-star="{{ $i }}">
            <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 2.5l2.9 6.1 6.6.8-4.9 4.6 1.3 6.6L12 17.3l-5.9 3.3 1.3-6.6L2.5 9.4l6.6-.8z"/></svg>
          </button>
        @endfor
      </div>

      @if (count($languages) > 1)
        <span class="label">Language</span>
        <div class="chips" data-langs>
          @foreach ($languages as $i => $l)
            <button type="button" data-lang="{{ $l['code'] }}" class="{{ $i === 0 ? 'on' : '' }}" aria-pressed="{{ $i === 0 ? 'true' : 'false' }}">{{ $l['label'] }}</button>
          @endforeach
        </div>
      @endif
    </section>

    <section class="review-card" style="animation-delay:.14s">
      <div class="review-head">
        <div class="review-status"><span class="spin" data-spin></span><span data-busy-text>TAP A STAR TO START</span></div>
        <button type="button" class="edit-btn" data-focus-review aria-label="Edit your review">
          <span class="dot" data-edit-dot></span>
          <svg data-edit-pencil viewBox="0 0 306.637 306.637" aria-hidden="true"><path d="M12.809 238.52 0 306.637l68.118-12.809 184.277-184.277-55.309-55.309zm47.981 41.423-41.992 7.896 7.896-41.992L197.086 75.455l34.096 34.096zM251.329 0l-41.507 41.507 55.308 55.308 41.507-41.507zm-20.294 41.507 20.294-20.294 34.095 34.095-20.294 20.294z"/></svg>
        </button>
      </div>
      <div class="review-body">
        <textarea data-review aria-label="Your review — you can change it" placeholder="Tap a star above to get your review"></textarea>
        <p class="hint">You can edit it before posting.</p>
        <p class="error" data-error role="alert"></p>
        <div class="review-actions">
          <button type="button" class="copy-btn" data-go disabled>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
            Copy &amp; post on Google
          </button>
          <button type="button" class="regen-btn" data-again aria-label="Write another review" disabled>
            <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M19 8l-4 4h3c0 3.31-2.69 6-6 6-1.01 0-1.97-.25-2.8-.7l-1.46 1.46C8.97 19.54 10.43 20 12 20c4.42 0 8-3.58 8-8h3l-4-4zM6 12c0-3.31 2.69-6 6-6 1.01 0 1.97.25 2.8.7l1.46-1.46C15.03 4.46 13.57 4 12 4c-4.42 0-8 3.58-8 8H1l4 4 4-4H6z"/></svg>
          </button>
        </div>
        <button type="button" class="copy-only" data-copy disabled>Just copy the review</button>
      </div>
    </section>

    <p class="powered">Powered by <a href="{{ rtrim((string) config('app.url'), '/') ?: '/' }}" target="_blank" rel="noopener">Markkito</a></p>
  </div>

  <div class="overlay" data-overlay role="dialog" aria-modal="true" aria-labelledby="overlay-title">
    <div class="overlay-card">
      <div class="g-icon">
        <svg viewBox="-3 0 262 262" xmlns="http://www.w3.org/2000/svg">
          <path d="M255.878 133.451c0-10.734-.871-18.567-2.756-26.69H130.55v48.448h71.947c-1.45 12.04-9.283 30.172-26.69 42.356l-.244 1.622 38.755 30.023 2.685.268c24.659-22.774 38.875-56.282 38.875-96.027" fill="#4285F4"/>
          <path d="M130.55 261.1c35.248 0 64.839-11.605 86.453-31.622l-41.196-31.913c-11.024 7.688-25.82 13.055-45.257 13.055-34.523 0-63.824-22.773-74.269-54.25l-1.531.13-40.298 31.187-.527 1.465C35.393 231.798 79.49 261.1 130.55 261.1" fill="#34A853"/>
          <path d="M56.281 156.37c-2.756-8.123-4.351-16.827-4.351-25.82 0-8.994 1.595-17.697 4.206-25.82l-.073-1.73L15.26 71.312l-1.335.635C5.077 89.644 0 109.517 0 130.55s5.077 40.905 13.925 58.602l42.356-32.782" fill="#FBBC05"/>
          <path d="M130.55 50.479c24.514 0 41.05 10.589 50.479 19.438l36.844-35.974C195.245 12.91 165.798 0 130.55 0 79.49 0 35.393 29.301 13.925 71.947l42.211 32.783c10.59-31.477 39.891-54.251 74.414-54.251" fill="#EB4335"/>
        </svg>
      </div>
      <b class="overlay-title" id="overlay-title">Review copied!</b>
      <p class="overlay-text" data-overlay-text>Paste it on the Google page.</p>
      <div class="loader" data-loader hidden></div>
      <span class="redirect-label" data-redirect-label hidden>Opening Google…</span>
    </div>
  </div>

  <script type="application/json" id="ai-review-data">@json(['slug' => $slug, 'googleUrl' => $googleUrl, 'language' => $languages[0]['code']])</script>
  <script>
    (() => {
      const cfg = JSON.parse(document.getElementById("ai-review-data").textContent);
      const $ = (s) => document.querySelector(s);
      const root = document.documentElement;
      const text = $("[data-review]"), err = $("[data-error]");
      const go = $("[data-go]"), copyBtn = $("[data-copy]"), again = $("[data-again]");
      let rating = 0, language = cfg.language, edited = false, seq = 0;

      // Theme: a saved choice wins; otherwise the device's own preference.
      const stored = (() => { try { return localStorage.getItem("ai-review-theme"); } catch (e) { return null; } })();
      const setDark = (on) => { root.classList.toggle("dark", on); try { localStorage.setItem("ai-review-theme", on ? "dark" : "light"); } catch (e) {} };
      setDark(stored ? stored === "dark" : window.matchMedia("(prefers-color-scheme: dark)").matches);
      $("[data-theme-toggle]").addEventListener("click", () => setDark(!root.classList.contains("dark")));

      const ready = () => { const has = text.value.trim().length > 0; go.disabled = copyBtn.disabled = !has; };
      text.addEventListener("input", () => { edited = true; ready(); });
      $("[data-focus-review]").addEventListener("click", () => text.focus());

      function setBusy(busy) {
        $("[data-spin]").style.display = busy ? "block" : "none";
        $("[data-edit-dot]").style.display = busy ? "block" : "none";
        $("[data-edit-pencil]").style.display = busy ? "none" : "block";
        again.disabled = busy;
      }

      async function write() {
        if (!rating) return; // Nothing to ask the AI for until the customer picks a star.
        const mine = ++seq;
        setBusy(true); err.style.display = "none";
        // While the AI writes: a few steps, so the wait feels like progress.
        const steps = ["WRITING YOUR REVIEW…", "READING ABOUT THE BUSINESS…", "CHOOSING THE RIGHT WORDS…", "MAKING IT SOUND LIKE YOU…", "ALMOST THERE…"];
        let step = 0; const busyText = $("[data-busy-text]"); busyText.textContent = steps[0];
        const ticker = setInterval(() => { step = Math.min(step + 1, steps.length - 1); busyText.textContent = steps[step]; }, 2200);
        try {
          const res = await fetch(`/api/v1/ai-review/${encodeURIComponent(cfg.slug)}/generate`, {
            method: "POST", headers: { "Content-Type": "application/json", Accept: "application/json" },
            body: JSON.stringify({ rating, language }),
          });
          const body = await res.json().catch(() => null);
          if (mine !== seq) return;
          if (!res.ok || !body?.data?.review) throw new Error(res.status === 429 ? "Too many tries — please wait a minute." : "Couldn't write a review just now.");
          text.value = body.data.review; edited = false;
        } catch (e) {
          if (mine !== seq) return;
          err.textContent = `${e.message} You can type your own review, or tap the refresh button.`;
          err.style.display = "block";
        } finally {
          clearInterval(ticker);
          if (mine === seq) { busyText.textContent = "YOUR REVIEW"; setBusy(false); ready(); }
        }
      }

      document.querySelectorAll("[data-star]").forEach((btn) => btn.addEventListener("click", () => {
        rating = Number(btn.dataset.star);
        document.querySelectorAll("[data-star]").forEach((s) => {
          s.classList.toggle("on", Number(s.dataset.star) <= rating);
          s.setAttribute("aria-checked", String(Number(s.dataset.star) === rating));
        });
        if (!edited) write();
      }));
      document.querySelectorAll("[data-lang]").forEach((btn) => btn.addEventListener("click", () => {
        language = btn.dataset.lang;
        document.querySelectorAll("[data-lang]").forEach((l) => { l.classList.toggle("on", l === btn); l.setAttribute("aria-pressed", String(l === btn)); });
        if (rating) write();
      }));
      again.addEventListener("click", () => {
        const icon = again.querySelector("svg"); icon.classList.add("spin-icon");
        write().finally(() => icon.classList.remove("spin-icon"));
      });

      async function copy() {
        const value = text.value.trim();
        try { await navigator.clipboard.writeText(value); return true; } catch (e) {}
        // Older phones: copy from a selected field.
        const ta = document.createElement("textarea");
        ta.value = value; ta.setAttribute("readonly", ""); ta.style.position = "fixed"; ta.style.opacity = "0";
        document.body.appendChild(ta); ta.select(); ta.setSelectionRange(0, value.length);
        let ok = false; try { ok = document.execCommand("copy"); } catch (e) {}
        ta.remove();
        return ok;
      }
      function counted() {
        fetch(`/api/v1/ai-review/${encodeURIComponent(cfg.slug)}/copied`, { method: "POST", headers: { Accept: "application/json" }, keepalive: true }).catch(() => {});
      }
      let hideTimer;
      function overlay(message, redirecting) {
        clearTimeout(hideTimer);
        $("[data-overlay-text]").textContent = message;
        $("[data-loader]").hidden = !redirecting;
        $("[data-redirect-label]").hidden = !redirecting;
        $("[data-overlay]").classList.add("show");
        if (!redirecting) hideTimer = setTimeout(() => $("[data-overlay]").classList.remove("show"), 1800);
      }
      $("[data-overlay]").addEventListener("click", (e) => { if (e.target === e.currentTarget) e.currentTarget.classList.remove("show"); });

      copyBtn.addEventListener("click", async () => {
        const ok = await copy(); counted();
        overlay(ok ? "Paste it on the Google page." : "Select the text and copy it yourself, then paste it on Google.", false);
      });
      go.addEventListener("click", async () => {
        const ok = await copy(); counted();
        overlay(ok ? "Paste it on the Google page." : "Copy didn't work here — select the text first, then paste it on Google.", true);
        setTimeout(() => { location.href = cfg.googleUrl; }, ok ? 1200 : 2500);
      });

      document.body.classList.add("ready");
    })();
  </script>
</body>
</html>
