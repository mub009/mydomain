{{-- A digital visiting card, as a standalone document (App\Support\Cards\CardEngine::render).
     Self-contained — no app CSS or JS — so the same markup serves the public
     /card/<slug> page and the srcdoc previews in the pickers and editors.
     $design has been through CardEngine::normalizeDesign(), so every value
     printed into the <style> below is a known font, a #rrggbb colour or a
     fixed keyword; $b (the business's details) is escaped by Blade. --}}
@php
    $c = $design['colors'];
    // Buttons, icons and links in the primary colour, unless it would vanish into the card.
    $ink = \App\Support\Cards\CardEngine::readableOn($c['primary'], $c['surface'], [$c['accent'], $c['text']]);
    $radius = ['rounded' => '12px', 'pill' => '999px', 'square' => '3px', 'outline' => '12px', 'soft' => '14px'][$design['buttonStyle']];
@endphp
<!doctype html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <meta name="format-detection" content="telephone=no, date=no, address=no, email=no" />
  <title>{{ $b['name'] }}{{ $b['category'] ? ' — '.$b['category'] : '' }}</title>
  @unless ($preview)
    <meta name="description" content="{{ \Illuminate\Support\Str::limit($b['description'] ?: $b['name'].' — '.$b['tagline'], 160) }}" />
    <meta property="og:title" content="{{ $b['name'] }}" />
    <meta property="og:description" content="{{ $b['tagline'] }}" />
    @if ($b['logoUrl'])<meta property="og:image" content="{{ $b['logoUrl'] }}" />@endif
    <link rel="canonical" href="{{ $b['cardUrl'] }}" />
  @endunless
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link rel="stylesheet" href="{{ $fontUrl }}" />
  <style>
    :root{
      --primary:{{ $c['primary'] }};--accent:{{ $c['accent'] }};--bg:{{ $c['background'] }};--surface:{{ $c['surface'] }};
      --text:{{ $c['text'] }};--muted:{{ $c['muted'] }};--btn-text:{{ $c['buttonText'] }};--ink:{{ $ink }};
      --radius:{{ $radius }};--overlay:{{ $design['overlay'] }};
      --font-heading:"{{ $design['fonts']['heading'] }}",Georgia,serif;--font-body:"{{ $design['fonts']['body'] }}",system-ui,sans-serif;
    }
    *{box-sizing:border-box}
    html,body{margin:0;padding:0}
    body{background:var(--bg);color:var(--text);font-family:var(--font-body);line-height:1.5;-webkit-font-smoothing:antialiased;min-height:100vh}
    a{color:inherit;text-decoration:none}
    img{display:block;max-width:100%}
    h1,h2,h3{font-family:var(--font-heading);margin:0;line-height:1.15}
    .page{min-height:100vh;display:flex;justify-content:center;padding:24px 16px}
    .card{width:100%;max-width:420px;background:var(--surface);border-radius:24px;overflow:hidden;box-shadow:0 20px 50px -20px rgba(0,0,0,.35);position:relative}
    .hero-bg{position:absolute;inset:0;background-size:cover;background-position:center}
    .hero-bg::after{content:"";position:absolute;inset:0;background:rgba(0,0,0,var(--overlay))}
    .logo{width:96px;height:96px;border-radius:50%;background:var(--surface);display:flex;align-items:center;justify-content:center;overflow:hidden;border:4px solid var(--surface);box-shadow:0 8px 24px -8px rgba(0,0,0,.35);flex-shrink:0}
    .logo img{width:100%;height:100%;object-fit:cover}
    .logo .initials{font-family:var(--font-heading);font-size:34px;font-weight:700;color:var(--primary)}
    .name{font-size:26px;font-weight:700}
    .tagline{color:var(--muted);font-size:14px;margin-top:4px}
    .about{color:var(--muted);font-size:14px;margin:14px 0 0}
    .body{padding:22px}
    .actions{display:grid;grid-template-columns:repeat(2,1fr);gap:10px;margin-top:20px}
    .btn{display:flex;align-items:center;justify-content:center;gap:8px;padding:12px 10px;border-radius:var(--radius);font-weight:600;font-size:14px;border:2px solid var(--primary);background:var(--primary);color:var(--btn-text);transition:transform .15s,opacity .15s;cursor:pointer;font-family:var(--font-body)}
    .btn:hover{transform:translateY(-1px);opacity:.92}
    .btn.alt{background:var(--accent);border-color:var(--accent)}
    .btn.wide{grid-column:1/-1}
    .btn svg{flex-shrink:0}
    .btns-outline .btn{background:transparent;color:var(--ink);border-color:var(--ink)}
    .btns-outline .btn.alt{background:transparent;color:var(--accent)}
    .btns-soft .btn{background:color-mix(in srgb,var(--ink) 14%,transparent);border-color:transparent;color:var(--ink)}
    .btns-soft .btn.alt{background:color-mix(in srgb,var(--accent) 16%,transparent);color:var(--text)}
    .info{list-style:none;margin:22px 0 0;padding:0;display:grid;gap:12px}
    .info li{display:flex;gap:12px;align-items:flex-start;font-size:14px}
    .info .ico{width:34px;height:34px;border-radius:10px;display:flex;align-items:center;justify-content:center;background:color-mix(in srgb,var(--ink) 12%,transparent);color:var(--ink);flex-shrink:0}
    .info small{display:block;color:var(--muted);font-size:11px;text-transform:uppercase;letter-spacing:.06em}
    .info a,.info span{word-break:break-word}
    .social{display:flex;gap:10px;justify-content:center;margin-top:22px}
    .social a{width:40px;height:40px;border-radius:50%;display:flex;align-items:center;justify-content:center;background:color-mix(in srgb,var(--ink) 12%,transparent);color:var(--ink)}
    .footer{display:flex;gap:10px;margin-top:22px;padding-top:18px;border-top:1px solid color-mix(in srgb,var(--muted) 25%,transparent)}
    .footer .btn{flex:1;background:transparent;color:var(--text);border-color:color-mix(in srgb,var(--muted) 35%,transparent);border-width:1px}
    .powered{text-align:center;font-size:11px;color:var(--muted);margin-top:16px}
    .powered a{text-decoration:underline}
    @if ($preview)
      a,button{pointer-events:none}
      .page{padding:14px 10px}
    @endif
    @include('cards.layouts.'.$layout.'-css')
  </style>
</head>
<body class="layout-{{ $layout }}">
  <div class="page">
    <main class="card btns-{{ $design['buttonStyle'] }}">
      @include('cards.layouts.'.$layout)
    </main>
  </div>
  @unless ($preview)
    <script>
      // "Share": the phone's share sheet where there is one, else copy the link.
      document.querySelectorAll("[data-share]").forEach((btn) => btn.addEventListener("click", async () => {
        const url = location.href.split("#")[0];
        try {
          if (navigator.share) return await navigator.share({ title: document.title, url });
          await navigator.clipboard.writeText(url);
          btn.querySelector("span").textContent = "Link copied";
        } catch (e) {}
      }));
    </script>
  @endunless
</body>
</html>
