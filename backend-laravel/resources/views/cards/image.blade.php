{{-- An image card (App\Support\Cards\ImageCard::render): the business's own
     artwork, with each action it placed on it as a link over that spot.
     Positions are percentages of the image, so they stay put at any width.
     Self-contained like cards/card.blade.php: the same markup serves the
     public /card/<slug> page and the dashboard preview. $image went through
     CardEngine::safeUrl (no quotes or brackets), so it is safe in url(). --}}
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
    <meta property="og:image" content="{{ $image }}" />
    <link rel="canonical" href="{{ $b['cardUrl'] }}" />
  @endunless
  @if ($fontsUrl)
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link rel="stylesheet" href="{{ $fontsUrl }}" />
  @endif
  <style>
    *{box-sizing:border-box}
    html,body{margin:0;padding:0}
    body{min-height:100vh;background:#111827;color:#fff;font-family:system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;-webkit-font-smoothing:antialiased;overflow-x:hidden}
    .backdrop{position:fixed;inset:-40px;background:url('{{ $image }}') center/cover;filter:{{ $colourMatrix ? 'url(#card-colour) ' : '' }}blur(36px) brightness(.55);transform:scale(1.1)}
    .page{position:relative;min-height:100vh;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:20px 12px}
    .card{position:relative;width:100%;max-width:480px;container-type:inline-size;border-radius:18px;overflow:hidden;box-shadow:0 24px 60px -20px rgba(0,0,0,.6);background:#1f2937}
    .card > img{display:block;width:100%;height:auto;user-select:none;-webkit-user-drag:none;{{ $colourMatrix ? 'filter:url(#card-colour)' : '' }}}
    .spot{position:absolute;display:flex;align-items:center;justify-content:center;gap:6px;border-radius:10px;color:#fff;text-decoration:none;font-weight:600;font-size:13px;-webkit-tap-highlight-color:transparent;cursor:pointer;border:0;padding:0;font-family:inherit;background:transparent}
    .spot:focus-visible{outline:3px solid #facc15;outline-offset:2px}
    .spot.invisible:active{background:rgba(255,255,255,.25)}
    .spot.icon span{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0)}
    .spot.icon,.spot.button{background:rgba(17,24,39,.72);box-shadow:0 4px 14px -4px rgba(0,0,0,.5);backdrop-filter:blur(4px)}
    .spot.icon{border-radius:999px}
    .spot.icon:active,.spot.button:active{transform:scale(.97)}
    .spot svg{flex-shrink:0;width:1.35em;height:1.35em;max-height:70%}
    .spot span{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
    .spot.invisible svg,.spot.invisible span{display:none}
    /* Business details: text in its own font, or the logo / QR code. */
    .spot.detail{justify-content:flex-start;text-align:left;font-weight:500;line-height:1.2;border-radius:4px;padding:0 .15em;cursor:default}
    a.spot.detail{cursor:pointer}
    .spot.detail span{white-space:pre-line;overflow:hidden;display:-webkit-box;-webkit-box-orient:vertical;max-height:100%}
    .spot.pic{border-radius:4px;cursor:default;overflow:hidden}
    .spot.pic img{display:block;width:100%;height:100%;object-fit:contain}
    /* A brief glow on load shows where the invisible tap areas are. */
    .card.hint .spot.invisible{animation:hint 1.6s ease-out .4s 1}
    @keyframes hint{0%,100%{box-shadow:inset 0 0 0 0 rgba(250,204,21,0)}35%{box-shadow:inset 0 0 0 3px rgba(250,204,21,.9);background:rgba(250,204,21,.18)}}
    .powered{margin-top:14px;font-size:11px;color:rgba(255,255,255,.7)}
    .powered a{color:inherit}
    @if ($preview)
      .spot.inert,.powered a{pointer-events:none}
      .card.hint .spot.invisible{animation:none}
    @endif
    @if ($marks)
      {{-- The editor's preview outlines where the invisible tap areas are. --}}
      .card.hint .spot.invisible{box-shadow:inset 0 0 0 2px rgba(250,204,21,.85);background:rgba(250,204,21,.12)}
    @endif
  </style>
</head>
<body>
  @if ($colourMatrix)
    {{-- The business's recolouring of the image (App\Support\Cards\ImageColour): numbers only. --}}
    <svg width="0" height="0" style="position:absolute" aria-hidden="true"><filter id="card-colour" color-interpolation-filters="sRGB"><feColorMatrix type="matrix" values="{{ $colourMatrix }}" /></filter></svg>
  @endif
  <div class="backdrop" aria-hidden="true"></div>
  <div class="page">
    <main class="card hint">
      <img src="{{ $image }}" alt="{{ $b['name'] }} visiting card" @if ($ratio) style="aspect-ratio:1/{{ round($ratio, 5) }}" @endif />
      @foreach ($spots as $s)
        @php
            $box = sprintf('left:%s%%;top:%s%%;width:%s%%;height:%s%%', $s['x'], $s['y'], $s['w'], $s['h']);
            $external = $s['href'] && str_starts_with($s['href'], 'http');
            // In a preview, real links open in a new tab; stand-ins (#) and Share do nothing.
            $live = $s['href'] && $s['href'] !== '#';
            $inert = $preview && ($s['action'] === 'share' || ! $live);
        @endphp
        @if ($s['kind'] === 'image')
          <div class="spot pic" style="{{ $box }}"><img src="{{ $s['src'] }}" alt="{{ $s['action'] === 'qr' ? 'QR code for this card' : $b['name'].' logo' }}" /></div>
        @elseif ($s['kind'] === 'text')
          @if ($live && ! ($preview && $inert))
            <a class="spot detail" style="{{ $box }};{{ \App\Support\Cards\ImageCard::textStyle($s) }}" href="{{ $s['href'] }}" @if ($external || $preview) target="_blank" rel="noopener" @endif><span>{{ $s['display'] }}</span></a>
          @else
            <div class="spot detail" style="{{ $box }};{{ \App\Support\Cards\ImageCard::textStyle($s) }}"><span>{{ $s['display'] }}</span></div>
          @endif
        @elseif ($s['action'] === 'share')
          <button type="button" class="spot {{ $s['style'] }} {{ $inert ? 'inert' : '' }}" style="{{ $box }};{{ \App\Support\Cards\ImageCard::textStyle($s) }}" aria-label="{{ $s['text'] }}" data-share><x-icon :name="$s['icon']" :size="18" /> <span>{{ $s['text'] }}</span></button>
        @else
          <a class="spot {{ $s['style'] }} {{ $inert ? 'inert' : '' }}" style="{{ $box }};{{ \App\Support\Cards\ImageCard::textStyle($s) }}" href="{{ $s['href'] ?? '#' }}" aria-label="{{ $s['text'] }}" @if ($external || ($preview && $live)) target="_blank" rel="noopener" @endif><x-icon :name="$s['icon']" :size="18" /> <span>{{ $s['text'] }}</span></a>
        @endif
      @endforeach
    </main>
    @unless ($preview)
      <p class="powered">Digital card by <a href="{{ rtrim((string) config('app.url'), '/') ?: '/' }}" target="_blank" rel="noopener">Markkito</a></p>
    @endunless
  </div>
  @unless ($preview)
    <script>
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
