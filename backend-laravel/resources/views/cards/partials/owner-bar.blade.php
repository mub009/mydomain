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
    @media print{#mk-owner-bar{display:none}}
  </style>
  <div class="top">
    <span><b>Your card</b> <span class="note" data-status>Only you see this bar</span></span>
    <span class="links">
      <a class="edit" href="{{ $manageUrl }}">Edit card →</a>
      <button type="button" class="x" data-close aria-label="Hide this bar">×</button>
    </span>
  </div>
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
    })();
  </script>
</div>
