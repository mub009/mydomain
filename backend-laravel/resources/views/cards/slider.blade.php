{{-- Multi card view (CardPageController::show): the public /card/<slug>
     link showing the business's card and then its other ready-made designs,
     one per slide, swiped sideways. Each slide is the real card page
     (/card/<slug>?design=<id>&embed=1) in an iframe, so its actions work
     exactly as on a single card. "Download PDF" follows the card on screen. --}}
<!doctype html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <meta name="color-scheme" content="only light" />
  <title>{{ $b['name'] }}{{ $b['category'] ? ' — '.$b['category'] : '' }}</title>
  <meta name="description" content="{{ \Illuminate\Support\Str::limit($b['description'] ?: $b['name'].' — '.$b['tagline'], 160) }}" />
  <meta property="og:title" content="{{ $b['name'] }}" />
  <meta property="og:description" content="{{ $b['tagline'] }}" />
  @if ($image)
    <meta property="og:image" content="{{ $image }}" />
  @endif
  <link rel="canonical" href="{{ $b['cardUrl'] }}" />
  <style>
    *{box-sizing:border-box}
    :root{color-scheme:only light}
    html,body{margin:0;padding:0;height:100%}
    body{background:#111827;color:#fff;font-family:system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;-webkit-font-smoothing:antialiased;overflow:hidden}
    .track{display:flex;height:100vh;height:100dvh;overflow-x:auto;overflow-y:hidden;scroll-snap-type:x mandatory;scroll-behavior:smooth;scrollbar-width:none;overscroll-behavior-x:contain}
    .track::-webkit-scrollbar{display:none}
    .slide{flex:0 0 100%;height:100%;scroll-snap-align:center;scroll-snap-stop:always}
    .slide iframe{display:block;width:100%;height:100%;border:0;background:#111827}
    .bar{position:fixed;left:0;right:0;bottom:0;display:flex;flex-direction:column;align-items:center;gap:8px;padding:10px 16px calc(12px + env(safe-area-inset-bottom));background:linear-gradient(to top,rgba(17,24,39,.92),rgba(17,24,39,0));pointer-events:none}
    .bar > *{pointer-events:auto}
    .controls{display:flex;align-items:center;gap:10px}
    .dots{display:flex;gap:6px}
    .dot{width:8px;height:8px;border-radius:999px;border:0;padding:0;background:rgba(255,255,255,.4);cursor:pointer;transition:width .2s,background .2s}
    .dot[aria-current="true"]{width:20px;background:#fff}
    .btn{display:inline-flex;align-items:center;gap:6px;border:0;border-radius:999px;padding:9px 16px;font:600 13px/1 inherit;font-family:inherit;color:#111827;background:#fff;text-decoration:none;cursor:pointer;box-shadow:0 6px 18px -6px rgba(0,0,0,.5)}
    .btn svg{width:15px;height:15px}
    .nav{position:fixed;top:50%;transform:translateY(-50%);width:40px;height:40px;border-radius:999px;border:0;display:flex;align-items:center;justify-content:center;color:#fff;background:rgba(0,0,0,.45);cursor:pointer;backdrop-filter:blur(4px)}
    .nav[disabled]{opacity:0;pointer-events:none}
    .nav.prev{left:12px}.nav.next{right:12px}
    .count{font-size:12px;color:rgba(255,255,255,.75)}
    .powered{font-size:11px;color:rgba(255,255,255,.6)}
    .powered a{color:inherit}
    @media (max-width:640px){.nav{display:none}}
  </style>
</head>
<body>
  <div class="track" data-track>
    @foreach ($slides as $i => $s)
      <section class="slide" aria-roledescription="slide" aria-label="Card {{ $i + 1 }} of {{ count($slides) }}">
        <iframe src="{{ $s['src'] }}" title="{{ $b['name'] }} — card {{ $i + 1 }}" @if ($i > 1) loading="lazy" @endif></iframe>
      </section>
    @endforeach
  </div>

  <button type="button" class="nav prev" aria-label="Previous card" data-prev disabled>
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="m15 18-6-6 6-6"/></svg>
  </button>
  <button type="button" class="nav next" aria-label="Next card" data-next>
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="m9 18 6-6-6-6"/></svg>
  </button>

  <div class="bar">
    <div class="controls">
      <div class="dots" role="tablist">
        @foreach ($slides as $i => $s)
          <button type="button" class="dot" role="tab" aria-label="Show card {{ $i + 1 }}" aria-current="{{ $i === 0 ? 'true' : 'false' }}" data-dot="{{ $i }}"></button>
        @endforeach
      </div>
      <span class="count" data-count>1 / {{ count($slides) }}</span>
    </div>
    <a class="btn" href="{{ $slides[0]['pdf'] }}" data-pdf download>
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="m7 10 5 5 5-5"/><path d="M12 15V3"/></svg>
      Download PDF
    </a>
    <p class="powered">Digital card by <a href="{{ rtrim((string) config('app.url'), '/') ?: '/' }}" target="_blank" rel="noopener">Markkito</a></p>
  </div>

  <script>
    (() => {
      const pdfs = @json(array_column($slides, 'pdf'));
      const track = document.querySelector("[data-track]");
      const dots = [...document.querySelectorAll("[data-dot]")];
      const prev = document.querySelector("[data-prev]");
      const next = document.querySelector("[data-next]");
      const pdf = document.querySelector("[data-pdf]");
      const count = document.querySelector("[data-count]");
      let current = 0;

      const go = (i) => track.scrollTo({ left: Math.max(0, Math.min(pdfs.length - 1, i)) * track.clientWidth });
      const show = (i) => {
        if (i === current) return;
        current = i;
        dots.forEach((d, j) => d.setAttribute("aria-current", String(j === i)));
        prev.disabled = i === 0;
        next.disabled = i === pdfs.length - 1;
        pdf.href = pdfs[i];
        count.textContent = `${i + 1} / ${pdfs.length}`;
      };

      track.addEventListener("scroll", () => show(Math.round(track.scrollLeft / Math.max(1, track.clientWidth))), { passive: true });
      dots.forEach((d, i) => d.addEventListener("click", () => go(i)));
      prev.addEventListener("click", () => go(current - 1));
      next.addEventListener("click", () => go(current + 1));
      // Swipes on a card inside its frame (cards/image.blade.php, embedded).
      addEventListener("message", (e) => {
        if (e.origin !== location.origin) return;
        if (e.data?.markkitoCard === "next") go(current + 1);
        if (e.data?.markkitoCard === "prev") go(current - 1);
      });
      document.addEventListener("keydown", (e) => {
        if (e.key === "ArrowLeft") go(current - 1);
        if (e.key === "ArrowRight") go(current + 1);
      });
      // Keep the card on screen in place when the phone turns.
      addEventListener("resize", () => track.scrollTo({ left: current * track.clientWidth, behavior: "instant" }));
    })();
  </script>
</body>
</html>
