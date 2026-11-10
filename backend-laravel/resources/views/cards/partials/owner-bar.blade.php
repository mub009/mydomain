{{-- Shown on the public card (/card/<slug>) only to someone signed in who
     manages the business (CardPageController::show): change the card's colour
     and its image (another ready-made design for the category) right here. Saved through the card API, then the page reloads so the
     card, its buttons and text all wear the new colour. Self-contained: the
     card page has none of the app's CSS or scripts. --}}
@php
    $c = $colour ?? null;
    $on = ! $c ? 'original' : (! $c['tint'] ? ($c['saturation'] === 0 ? 'mono' : 'original')
        : (collect($swatches)->first(fn ($s) => $s[3] && strcasecmp($s[3], $c['tint']) === 0)[0] ?? 'custom'));
@endphp
<div id="mk-owner-bar" role="region" aria-label="Change your card colour and design">
  <style>
    #mk-owner-bar{position:fixed;left:50%;bottom:12px;transform:translateX(-50%);z-index:2147483000;width:min(560px,calc(100% - 24px));box-sizing:border-box;
      background:#fff;color:#111827;border-radius:16px;box-shadow:0 10px 30px rgba(0,0,0,.25);padding:10px 12px;font:13px/1.3 system-ui,-apple-system,"Segoe UI",Roboto,sans-serif}
    #mk-owner-bar *{box-sizing:border-box}
    #mk-owner-bar .top{display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:8px}
    #mk-owner-bar b{font-size:13px}
    #mk-owner-bar .note{font-size:11px;color:#6b7280;font-weight:600}
    #mk-owner-bar .links{display:flex;align-items:center;gap:6px}
    #mk-owner-bar a.edit{font-size:12px;font-weight:600;color:#047857;text-decoration:none;white-space:nowrap}
    #mk-owner-bar button.x{border:0;background:#f3f4f6;border-radius:999px;width:24px;height:24px;cursor:pointer;color:#374151;font-size:14px;line-height:1}
    #mk-owner-bar .row{display:flex;gap:8px;overflow-x:auto;padding:2px 2px 4px}
    #mk-owner-bar .sw{flex:0 0 auto;width:34px;height:34px;border-radius:999px;border:2px solid #fff;box-shadow:0 0 0 2px transparent,0 1px 3px rgba(0,0,0,.3);cursor:pointer;padding:0;position:relative}
    #mk-owner-bar .sw[aria-checked="true"]{box-shadow:0 0 0 2px #059669,0 1px 3px rgba(0,0,0,.3)}
    #mk-owner-bar .sw input{position:absolute;inset:0;opacity:0;width:100%;height:100%;cursor:pointer}
    #mk-owner-bar .own{background:#fff;border:2px dashed #9ca3af;display:flex;align-items:center;justify-content:center;color:#6b7280;font-size:18px}
    #mk-owner-bar .lbl{font-size:11px;font-weight:700;color:#6b7280;text-transform:uppercase;letter-spacing:.04em;margin:4px 2px 4px}
    #mk-owner-bar .ds{flex:0 0 auto;width:46px;height:76px;border-radius:8px;border:2px solid #e5e7eb;padding:0;overflow:hidden;cursor:pointer;background:#f3f4f6;position:relative}
    #mk-owner-bar .ds img{display:block;width:100%;height:100%;object-fit:cover;object-position:top}
    #mk-owner-bar .ds[aria-checked="true"]{border-color:#059669;box-shadow:0 0 0 2px #a7f3d0}
    #mk-owner-bar .ds[aria-checked="true"]::after{content:"✓";position:absolute;top:2px;right:2px;width:16px;height:16px;border-radius:999px;background:#059669;color:#fff;font-size:10px;line-height:16px;text-align:center}
    #mk-owner-bar[data-busy] .row{opacity:.5;pointer-events:none}
    #mk-owner-bar .pk{flex:0 0 auto;display:flex;align-items:center;gap:6px;border:1px solid #d1d5db;background:#fff;border-radius:999px;padding:5px 10px 5px 5px;font:600 12px system-ui,sans-serif;color:#111827;cursor:pointer}
    #mk-owner-bar .pk img{width:26px;height:26px;border-radius:999px;object-fit:cover;background:#f3f4f6}
    #mk-owner-bar .arr{display:none}
    #mk-owner-bar[data-arranging] .arr{display:block}
    #mk-owner-bar[data-arranging] .main{display:none}
    #mk-owner-bar .arr p{margin:0 0 8px;font-size:12px;color:#4b5563}
    #mk-owner-bar .tools{display:flex;flex-wrap:wrap;gap:6px}
    #mk-owner-bar .tools button{border:1px solid #d1d5db;background:#fff;border-radius:10px;min-width:40px;height:38px;padding:0 12px;font:600 14px system-ui,sans-serif;color:#111827;cursor:pointer}
    #mk-owner-bar .tools button.go{background:#059669;border-color:#059669;color:#fff}
    #mk-owner-bar .tools button.big{font-size:20px;line-height:1}
    #mk-owner-bar[data-busy] .tools{opacity:.5;pointer-events:none}
    .spot.pic[data-arranging]{outline:2px dashed #059669;outline-offset:2px;cursor:move;touch-action:none;z-index:5}
    @media print{#mk-owner-bar{display:none}}
  </style>
  <div class="top">
    <span><b>Your card</b> <span class="note" data-status>Only you see this bar</span></span>
    <span class="links">
      <a class="edit" href="{{ $manageUrl }}">Edit card →</a>
      <button type="button" class="x" data-close aria-label="Hide this bar">×</button>
    </span>
  </div>
  <div class="main">
  <p class="lbl">Colour</p>
  <div class="row" role="radiogroup" aria-label="Card colour">
    @foreach ($swatches as [$key, $label, $bg, $tint, $sat])
      <button type="button" role="radio" class="sw" title="{{ $label }}" aria-label="{{ $label }}" aria-checked="{{ $on === $key ? 'true' : 'false' }}"
              style="background: {{ $bg }}" data-tint="{{ $tint ?? '' }}" data-saturation="{{ $sat }}"></button>
    @endforeach
    <label role="radio" class="sw own" title="Your own colour" aria-checked="{{ $on === 'custom' ? 'true' : 'false' }}"
           @if ($on === 'custom') style="background: {{ $c['tint'] }};border-style:solid;border-color:#fff" @endif>
      @unless ($on === 'custom')+@endunless
      <input type="color" value="{{ $on === 'custom' ? $c['tint'] : '#2563eb' }}" aria-label="Pick your own colour" data-custom />
    </label>
  </div>
  @if (count($designs ?? []) > 1)
    {{-- The card's image: another ready-made design (as "Use this design" in the dashboard). --}}
    <p class="lbl">Design</p>
    <div class="row" role="radiogroup" aria-label="Card design">
      @foreach ($designs as $d)
        <button type="button" role="radio" class="ds" title="{{ $d['name'] }}" aria-label="{{ $d['name'] }}" aria-checked="{{ $d['inUse'] ? 'true' : 'false' }}" data-design="{{ $d['id'] }}">
          <img src="{{ $d['imageUrl'] }}" alt="" loading="lazy" />
        </button>
      @endforeach
    </div>
  @endif
  {{-- Pictures on the card (logo, free images): move and zoom each one. Filled in by the script. --}}
  <div data-pictures hidden>
    <p class="lbl">Arrange pictures</p>
    <div class="row" data-picture-list></div>
  </div>
  </div>
  <div class="arr">
    <p><b data-arrange-name>Picture</b> — drag it to move, − / + to zoom.</p>
    <div class="tools">
      <button type="button" class="big" data-zoom="-1" aria-label="Zoom out">−</button>
      <button type="button" class="big" data-zoom="1" aria-label="Zoom in">+</button>
      <button type="button" data-arrange-reset>Reset</button>
      <button type="button" data-arrange-cancel>Cancel</button>
      <button type="button" class="go" data-arrange-save>Save</button>
    </div>
  </div>
  <script>
    (function () {
      var bar = document.getElementById("mk-owner-bar");
      var status = bar.querySelector("[data-status]");
      var current = @json($c);
      bar.querySelector("[data-close]").addEventListener("click", function () { bar.remove(); });

      function put(body) {
        bar.setAttribute("data-busy", "");
        status.textContent = "Saving…";
        // Saved with this page's owner pass, so it works even where the browser isn't signed in here.
        body.owner = @json($ownerToken);
        fetch(@json(url('/api/v1/cards/'.$slug.'/owner')), {
          method: "POST",
          headers: { "Content-Type": "application/json", Accept: "application/json" },
          body: JSON.stringify(body)
        })
          .then(function (r) { if (!r.ok) throw new Error(); location.reload(); })
          .catch(function () {
            bar.removeAttribute("data-busy");
            status.textContent = "Couldn't save — try again";
            status.style.color = "#b91c1c";
          });
      }

      function save(tint, saturation) {
        var colour = tint || saturation !== 100 ? {
          tint: tint, hue: 0, saturation: saturation,
          strength: current && current.tint ? current.strength : 60,
          brightness: current ? current.brightness : 100,
          // Keeps where the colour goes (areas marked in the dashboard).
          areas: current && current.areas ? current.areas : []
        } : null;
        put({ imageColour: colour });
      }

      bar.querySelectorAll("button.sw").forEach(function (b) {
        b.addEventListener("click", function () { save(b.dataset.tint || null, Number(b.dataset.saturation)); });
      });
      bar.querySelector("[data-custom]").addEventListener("change", function (e) { save(e.target.value, 100); });
      bar.querySelectorAll("[data-design]").forEach(function (b) {
        b.addEventListener("click", function () {
          if (b.getAttribute("aria-checked") === "true") return;
          put({ templateId: b.dataset.design });
        });
      });

      // --- Arrange a picture: drag to move, − / + to zoom (saved as the box's "fit") ---
      var boxes = Array.prototype.slice.call(document.querySelectorAll(".spot.pic[data-arrange]"));
      if (!boxes.length) return;
      var list = bar.querySelector("[data-picture-list]");
      bar.querySelector("[data-pictures]").hidden = false;
      boxes.forEach(function (box) {
        var chip = document.createElement("button");
        chip.type = "button";
        chip.className = "pk";
        var thumb = document.createElement("img");
        thumb.src = box.querySelector("img").src;
        thumb.alt = "";
        chip.appendChild(thumb);
        chip.appendChild(document.createTextNode(box.dataset.arrangeLabel));
        chip.addEventListener("click", function () { start(box); });
        list.appendChild(chip);
      });

      var box = null, img = null, fit = null, saved = "", drag = null;
      var MIN = {{ \App\Support\Cards\ImageCard::FIT_MIN }}, MAX = {{ \App\Support\Cards\ImageCard::FIT_MAX }};

      // Where the picture sits now, in percent of its box: its own fit, or how it is shown (cover / contain).
      function fitNow() {
        var st = img.style;
        if (st.position === "absolute" && st.width.slice(-1) === "%") {
          return { l: parseFloat(st.left), t: parseFloat(st.top), w: parseFloat(st.width), h: parseFloat(st.height) };
        }
        var bw = box.clientWidth, bh = box.clientHeight, iw = img.naturalWidth || bw, ih = img.naturalHeight || bh;
        var cover = getComputedStyle(img).objectFit === "cover";
        var k = cover ? Math.max(bw / iw, bh / ih) : Math.min(bw / iw, bh / ih);
        var w = iw * k / bw * 100, h = ih * k / bh * 100;
        return { l: (100 - w) / 2, t: (100 - h) / 2, w: w, h: h };
      }
      // As the server keeps it: bigger than the box, its edges never come inside; smaller, it stays within.
      function place(v, size) { return size >= 100 ? Math.min(0, Math.max(100 - size, v)) : Math.min(100 - size, Math.max(0, v)); }
      function show() {
        fit.l = place(fit.l, fit.w);
        fit.t = place(fit.t, fit.h);
        img.style.cssText = "position:absolute;left:" + fit.l + "%;top:" + fit.t + "%;width:" + fit.w + "%;height:" + fit.h + "%;max-width:none;object-fit:cover";
      }
      function start(b) {
        box = b;
        img = box.querySelector("img");
        saved = img.getAttribute("style") || "";
        fit = fitNow();
        box.setAttribute("data-arranging", "");
        bar.setAttribute("data-arranging", "");
        bar.querySelector("[data-arrange-name]").textContent = box.dataset.arrangeLabel;
        show();
      }
      function stop() {
        box.removeAttribute("data-arranging");
        bar.removeAttribute("data-arranging");
        box = img = fit = null;
      }
      function zoom(dir) {
        var f = dir > 0 ? 1.15 : 1 / 1.15;
        var w = fit.w * f, h = fit.h * f;
        if (Math.min(w, h) < MIN || Math.max(w, h) > MAX) return;
        var cx = fit.l + fit.w / 2, cy = fit.t + fit.h / 2;
        fit = { l: cx - w / 2, t: cy - h / 2, w: w, h: h };
        show();
      }
      bar.querySelectorAll("[data-zoom]").forEach(function (b) {
        b.addEventListener("click", function () { zoom(Number(b.dataset.zoom)); });
      });
      bar.querySelector("[data-arrange-cancel]").addEventListener("click", function () {
        img.setAttribute("style", saved);
        stop();
      });
      bar.querySelector("[data-arrange-reset]").addEventListener("click", function () {
        put({ spotFit: { id: box.dataset.arrange, fit: null } });
      });
      bar.querySelector("[data-arrange-save]").addEventListener("click", function () {
        var r = function (v) { return Math.round(v * 100) / 100; };
        put({ spotFit: { id: box.dataset.arrange, fit: { l: r(fit.l), t: r(fit.t), w: r(fit.w), h: r(fit.h) } } });
      });
      document.addEventListener("pointerdown", function (e) {
        if (!box || !box.contains(e.target)) return;
        e.preventDefault();
        drag = { x: e.clientX, y: e.clientY, l: fit.l, t: fit.t };
        box.setPointerCapture && box.setPointerCapture(e.pointerId);
      });
      document.addEventListener("pointermove", function (e) {
        if (!drag) return;
        fit.l = drag.l + (e.clientX - drag.x) / box.clientWidth * 100;
        fit.t = drag.t + (e.clientY - drag.y) / box.clientHeight * 100;
        show();
      });
      document.addEventListener("pointerup", function () { drag = null; });
      // The mouse wheel zooms too.
      document.addEventListener("wheel", function (e) {
        if (!box || !box.contains(e.target)) return;
        e.preventDefault();
        zoom(e.deltaY < 0 ? 1 : -1);
      }, { passive: false });
    })();
  </script>
</div>
