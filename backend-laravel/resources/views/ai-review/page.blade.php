{{-- The public AI Google Review page (App\Http\Controllers\Web\AiReviewPageController):
     the AI writes the customer a review as soon as it opens; they pick their
     stars and language, can rewrite or edit it, then copy it and go to the
     business's Google page to paste and post it. Self-contained like the
     visiting card: no app CSS or JS. $b is escaped by Blade. --}}
<!doctype html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
  <meta name="color-scheme" content="only light" />
  <meta name="robots" content="noindex" />
  <meta name="format-detection" content="telephone=no" />
  <title>Review {{ $b['name'] }}</title>
  <meta property="og:title" content="Review {{ $b['name'] }} on Google" />
  @if ($b['logoUrl'])<meta property="og:image" content="{{ $b['logoUrl'] }}" />@endif
  <style>
    :root{--brand:#0f9e68;--brand-dark:#0d7f56;--brand-soft:#f0fdf6;--ink:#0f172a;--muted:#64748b;--line:#e2e8f0;--star:#f5b301;--bg:#f1f5f9;color-scheme:only light}
    *{box-sizing:border-box}
    html,body{margin:0;padding:0}
    body{min-height:100vh;background:var(--bg);color:var(--ink);font-family:system-ui,-apple-system,"Segoe UI",Roboto,"Noto Sans","Noto Sans Malayalam","Noto Sans Devanagari",sans-serif;-webkit-font-smoothing:antialiased;line-height:1.5}
    button{font-family:inherit}
    .page{max-width:480px;margin:0 auto;padding:20px 16px calc(28px + env(safe-area-inset-bottom))}
    .card{background:#fff;border-radius:20px;box-shadow:0 10px 30px -12px rgba(15,23,42,.18);padding:22px 18px}
    .head{display:flex;align-items:center;justify-content:space-between;margin-bottom:14px}
    .head h1{font-size:18px;margin:0;font-weight:800}
    .head span{font-size:11px;color:var(--muted)}
    .biz{display:flex;align-items:center;gap:14px}
    .logo{width:64px;height:64px;border-radius:16px;flex-shrink:0;overflow:hidden;background:var(--brand-soft);display:flex;align-items:center;justify-content:center;font-weight:800;font-size:22px;color:var(--brand-dark);border:1px solid var(--line)}
    .logo img{width:100%;height:100%;object-fit:cover;display:block}
    .biz h2{margin:0;font-size:19px;line-height:1.2}
    .biz p{margin:3px 0 0;font-size:13px;color:var(--muted)}
    .verified{display:inline-flex;align-items:center;gap:5px;margin-top:6px;font-size:11px;font-weight:700;color:var(--brand-dark);background:var(--brand-soft);padding:3px 8px;border-radius:999px}
    .label{display:block;margin:20px 0 8px;font-size:12px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:.05em}
    .stars{display:flex;gap:6px}
    .stars button{background:none;border:0;padding:2px;cursor:pointer;color:#cbd5e1;-webkit-tap-highlight-color:transparent}
    .stars button.on{color:var(--star)}
    .stars svg{width:36px;height:36px;display:block}
    .langs{display:flex;flex-wrap:wrap;gap:8px}
    .langs button{border:1px solid var(--line);background:#fff;border-radius:999px;padding:7px 14px;font-size:14px;cursor:pointer;color:var(--ink)}
    .langs button.on{background:var(--brand);border-color:var(--brand);color:#fff;font-weight:600}
    .box{position:relative}
    textarea{width:100%;min-height:150px;resize:vertical;border:1.5px solid var(--line);border-radius:14px;padding:14px;font:inherit;font-size:16px;color:var(--ink);background:#fff;line-height:1.55}
    textarea:focus{outline:none;border-color:var(--brand)}
    .busy{position:absolute;inset:0;border-radius:14px;background:rgba(255,255,255,.92);display:none;align-items:center;justify-content:center;gap:10px;font-size:13px;font-weight:800;letter-spacing:.08em;color:var(--brand-dark)}
    .box.loading .busy{display:flex}
    .spin{width:18px;height:18px;border-radius:50%;border:2.5px solid var(--brand-soft);border-top-color:var(--brand);animation:spin .8s linear infinite}
    @keyframes spin{to{transform:rotate(360deg)}}
    .row{display:flex;justify-content:space-between;align-items:center;margin-top:8px;font-size:12px;color:var(--muted)}
    .again{display:inline-flex;align-items:center;gap:6px;background:none;border:0;color:var(--brand-dark);font-weight:700;font-size:13px;cursor:pointer;padding:6px 0}
    .again:disabled{opacity:.5}
    .error{display:none;margin-top:10px;font-size:13px;color:#b91c1c;background:#fef2f2;border-radius:10px;padding:8px 10px}
    .actions{display:grid;gap:10px;margin-top:18px}
    .btn{display:flex;align-items:center;justify-content:center;gap:8px;width:100%;padding:15px;border-radius:14px;font-size:16px;font-weight:700;cursor:pointer;border:1.5px solid var(--brand);-webkit-tap-highlight-color:transparent;transition:transform .1s}
    .btn:active{transform:scale(.98)}
    .btn:disabled{opacity:.55;cursor:default}
    .btn.primary{background:var(--brand);color:#fff}
    .btn.ghost{background:#fff;color:var(--brand-dark)}
    .steps{margin:18px 0 0;padding:14px 14px 14px 32px;background:#f8fafc;border-radius:12px;font-size:13px;color:#334155}
    .steps li+li{margin-top:4px}
    .powered{text-align:center;font-size:11px;color:var(--muted);margin-top:16px}
    .powered a{color:inherit}
    .toast{position:fixed;inset:0;background:rgba(15,23,42,.55);display:none;align-items:center;justify-content:center;padding:24px;z-index:10}
    .toast.show{display:flex}
    .toast div{background:#fff;border-radius:18px;padding:24px 22px;text-align:center;max-width:320px;box-shadow:0 20px 50px -10px rgba(0,0,0,.4)}
    .toast b{display:block;font-size:18px;margin:8px 0 4px}
    .toast p{margin:0;font-size:14px;color:var(--muted)}
    .toast .tick{width:52px;height:52px;border-radius:50%;background:var(--brand);color:#fff;display:inline-flex;align-items:center;justify-content:center}
    .toast small{display:block;margin-top:12px;font-size:12px;color:var(--brand-dark);font-weight:700}
  </style>
</head>
<body>
  <div class="page">
    <div class="head"><h1>Share your feedback</h1><span>Takes 30 seconds</span></div>
    <main class="card">
      <div class="biz">
        <div class="logo">
          @if ($b['logoUrl'])<img src="{{ $b['logoUrl'] }}" alt="{{ $b['name'] }} logo" />@else{{ $b['initials'] }}@endif
        </div>
        <div>
          <h2>{{ $b['name'] }}</h2>
          @if ($b['tagline'])<p>{{ $b['tagline'] }}</p>@endif
          <span class="verified"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 6 9 17l-5-5"/></svg> Verified business</span>
        </div>
      </div>

      <span class="label" id="stars-label">Your rating</span>
      <div class="stars" role="radiogroup" aria-labelledby="stars-label" data-stars>
        @for ($i = 1; $i <= 5; $i++)
          <button type="button" role="radio" aria-checked="{{ $i === 5 ? 'true' : 'false' }}" aria-label="{{ $i }} star{{ $i > 1 ? 's' : '' }}" data-star="{{ $i }}" class="on">
            <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 2.5l2.9 6.1 6.6.8-4.9 4.6 1.3 6.6L12 17.3l-5.9 3.3 1.3-6.6L2.5 9.4l6.6-.8z"/></svg>
          </button>
        @endfor
      </div>

      @if (count($languages) > 1)
        <span class="label">Language</span>
        <div class="langs" data-langs>
          @foreach ($languages as $i => $l)
            <button type="button" data-lang="{{ $l['code'] }}" class="{{ $i === 0 ? 'on' : '' }}" aria-pressed="{{ $i === 0 ? 'true' : 'false' }}">{{ $l['label'] }}</button>
          @endforeach
        </div>
      @endif

      <span class="label">Your review</span>
      <div class="box loading" data-box>
        <textarea data-review aria-label="Your review — you can change it" placeholder="Your review"></textarea>
        <div class="busy" aria-live="polite"><span class="spin"></span> <span data-busy-text>WRITING YOUR REVIEW…</span></div>
      </div>
      <div class="row">
        <span>You can edit it before posting.</span>
        <button type="button" class="again" data-again>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 12a9 9 0 1 1-3-6.7L21 8"/><path d="M21 3v5h-5"/></svg>
          Write another
        </button>
      </div>
      <p class="error" data-error role="alert"></p>

      <div class="actions">
        <button type="button" class="btn primary" data-go disabled>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
          Copy &amp; post on Google
        </button>
        <button type="button" class="btn ghost" data-copy disabled>Copy review</button>
      </div>

      <ol class="steps">
        <li>Tap <b>Copy &amp; post on Google</b>.</li>
        <li>On Google, choose your stars.</li>
        <li>Long-press the box, tap <b>Paste</b>, then <b>Post</b>.</li>
      </ol>
    </main>
    <p class="powered">Powered by <a href="{{ rtrim((string) config('app.url'), '/') ?: '/' }}" target="_blank" rel="noopener">Markkito</a></p>
  </div>

  <div class="toast" data-toast role="dialog" aria-modal="true" aria-labelledby="toast-title">
    <div>
      <span class="tick"><svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 6 9 17l-5-5"/></svg></span>
      <b id="toast-title">Review copied!</b>
      <p data-toast-text>Paste it on the Google page.</p>
      <small data-toast-redirect hidden>Opening Google…</small>
    </div>
  </div>

  <script type="application/json" id="ai-review-data">@json(['slug' => $slug, 'googleUrl' => $googleUrl, 'language' => $languages[0]['code']])</script>
  <script>
    (() => {
      const cfg = JSON.parse(document.getElementById("ai-review-data").textContent);
      const $ = (s) => document.querySelector(s);
      const text = $("[data-review]"), box = $("[data-box]"), err = $("[data-error]");
      const go = $("[data-go]"), copyBtn = $("[data-copy]"), again = $("[data-again]");
      let rating = 5, language = cfg.language, edited = false, seq = 0;

      const ready = () => { const has = text.value.trim().length > 0; go.disabled = copyBtn.disabled = !has; };
      text.addEventListener("input", () => { edited = true; ready(); });

      async function write() {
        const mine = ++seq;
        box.classList.add("loading"); again.disabled = true; err.style.display = "none";
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
          err.textContent = `${e.message} You can type your own review, or tap “Write another”.`;
          err.style.display = "block";
        } finally {
          clearInterval(ticker);
          if (mine === seq) { box.classList.remove("loading"); again.disabled = false; ready(); }
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
        write();
      }));
      again.addEventListener("click", write);

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
      function toast(message, redirecting) {
        $("[data-toast-text]").textContent = message;
        $("[data-toast-redirect]").hidden = !redirecting;
        $("[data-toast]").classList.add("show");
        if (!redirecting) setTimeout(() => $("[data-toast]").classList.remove("show"), 1800);
      }
      $("[data-toast]").addEventListener("click", (e) => { if (e.target === e.currentTarget) e.currentTarget.classList.remove("show"); });

      copyBtn.addEventListener("click", async () => {
        const ok = await copy(); counted();
        toast(ok ? "Paste it on the Google page." : "Select the text and copy it yourself, then paste it on Google.", false);
      });
      go.addEventListener("click", async () => {
        const ok = await copy(); counted();
        toast(ok ? "Paste it on the Google page." : "Copy didn't work here — select the text first, then paste it on Google.", true);
        setTimeout(() => { location.href = cfg.googleUrl; }, ok ? 1200 : 2500);
      });

      write();
    })();
  </script>
</body>
</html>
