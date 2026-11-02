{{-- The business's digital visiting card: pick a design, preview it with
     the business's own details, publish it, and hand out its link and QR
     code. Choosing a design changes only the look — the details come from
     the Contact section. Driven by resources/js/pages/card-manager.js. --}}
@if (! $card)
  <p class="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">Could not load the visiting card.</p>
@else
  @php
      $current = collect($card['templates'])->firstWhere('id', $card['templateId']);
      $base = "/dashboard/businesses/{$biz['id']}";
  @endphp
  <div class="space-y-5" data-card-manager>
    {{-- Status, link and QR --}}
    <div class="card p-5">
      <div class="flex flex-col gap-5 md:flex-row">
        <div class="min-w-0 flex-1 space-y-3">
          <div class="flex flex-wrap items-center gap-2">
            <h3 class="flex items-center gap-1.5 font-bold text-ink-900"><x-icon name="layout-template" :size="16" class="text-brand-600" /> Digital visiting card</h3>
            @if ($card['live'])
              <span class="badge bg-emerald-50 text-emerald-700">Live</span>
            @elseif ($card['isPublished'])
              <span class="badge bg-amber-50 text-amber-700">Published — waiting for listing approval</span>
            @else
              <span class="badge bg-gray-100 text-gray-600">Not published</span>
            @endif
          </div>
          <p class="text-sm text-ink-500">
            Design: <span class="font-semibold text-ink-900">{{ $current['name'] ?? '—' }}</span>.
            Name, logo, phone, WhatsApp, address and social links come from your listing —
            <a href="{{ $base }}?section=Contact" class="font-semibold text-brand-700 hover:underline">edit them in Contact</a>.
          </p>
          @unless ($card['listingLive'])
            <p class="rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-800">Your card goes live once your listing is approved.</p>
          @endunless
          <div class="rounded-lg border border-gray-200 bg-gray-50 p-3">
            <p class="mb-1 text-[11px] font-semibold uppercase tracking-wide text-ink-500">Card link</p>
            <div class="flex items-center gap-2">
              <input readonly value="{{ $card['publicUrl'] }}" class="input min-w-0 flex-1 bg-white font-mono text-xs" data-card-url />
              <button type="button" class="btn-secondary shrink-0 px-3 py-2 text-sm" data-copy-card><x-icon name="copy" :size="14" /> <span>Copy</span></button>
            </div>
          </div>
          <div class="flex flex-wrap gap-2">
            @if ($card['isPublished'])
              @if ($card['live'])
                <a href="{{ $card['publicUrl'] }}" target="_blank" rel="noopener" class="btn-primary px-4 py-2 text-sm"><x-icon name="external-link" :size="15" /> Open card</a>
                <a href="https://wa.me/?text={{ rawurlencode($biz['name'].' — '.$card['publicUrl']) }}" target="_blank" rel="noopener" class="btn-secondary px-4 py-2 text-sm"><x-icon name="message-square" :size="15" /> Share on WhatsApp</a>
              @endif
              <button type="button" class="btn-secondary px-4 py-2 text-sm !text-red-700" data-publish-card="0"><x-icon name="eye-off" :size="15" /> Unpublish</button>
            @else
              <button type="button" class="btn-primary px-4 py-2 text-sm" data-publish-card="1"><x-icon name="send" :size="15" /> Publish card</button>
            @endif
            <button type="button" class="btn-secondary px-4 py-2 text-sm" data-preview-template="{{ $card['templateId'] }}"><x-icon name="eye" :size="15" /> Preview</button>
            <a href="{{ $base }}/card.pdf" class="btn-secondary px-4 py-2 text-sm" data-download-pdf><x-icon name="download" :size="15" /> Download PDF</a>
            <a href="{{ $base }}/card.pdf?inline=1" target="_blank" rel="noopener" class="btn-secondary px-4 py-2 text-sm"><x-icon name="printer" :size="15" /> View / print PDF</a>
          </div>
          @if ($card['viewCount'] > 0)
            <p class="text-xs text-ink-500">Opened {{ number_format($card['viewCount']) }} {{ $card['viewCount'] === 1 ? 'time' : 'times' }}.</p>
          @endif
        </div>
        <div class="flex shrink-0 flex-col items-center gap-2 md:w-48">
          <div class="rounded-xl border border-gray-200 bg-white p-2">
            <img alt="QR code for the card link" class="h-40 w-40" data-card-qr />
          </div>
          <button type="button" class="btn-secondary w-full px-3 py-2 text-sm" data-download-qr><x-icon name="download" :size="14" /> Download QR</button>
          <p class="text-center text-[11px] text-ink-500">Print it on your counter, flyers or packaging.</p>
        </div>
      </div>
    </div>

    {{-- AI background: made for this business, worn over any design --}}
    <div class="card p-5" data-ai-background>
      <div class="flex flex-col gap-4 sm:flex-row sm:items-start">
        <div class="relative h-28 w-full shrink-0 overflow-hidden rounded-xl border border-gray-200 bg-gradient-to-br from-violet-100 to-sky-100 sm:w-48">
          @if ($card['backgroundImageUrl'])
            <img src="{{ $card['backgroundImageUrl'] }}" alt="Your card background" class="h-full w-full object-cover" />
          @else
            <span class="flex h-full items-center justify-center text-violet-500"><x-icon name="sparkles" :size="28" /></span>
          @endif
        </div>
        <div class="min-w-0 flex-1 space-y-2">
          <div>
            <h3 class="flex items-center gap-1.5 font-bold text-ink-900"><x-icon name="sparkles" :size="16" class="text-violet-600" /> AI background</h3>
            <p class="mt-0.5 text-sm text-ink-500">
              @if ($card['backgroundImageUrl'])
                Your card uses its own background, whichever design you pick.
              @else
                Let AI paint a background made for {{ $biz['name'] }} — from your category, city and description, in your design's colours.
              @endif
              Your name and contact details are printed over it, never inside the picture.
            </p>
          </div>
          <div class="flex flex-col gap-2 sm:flex-row">
            <input maxlength="200" class="input min-w-0 flex-1" placeholder="Optional style ideas, e.g. warm spices on a wooden table" data-ai-hint />
            <button type="button" class="btn-primary shrink-0 px-4 py-2 text-sm" data-generate-background><x-icon name="sparkles" :size="15" /> <span>{{ $card['backgroundImageUrl'] ? 'Generate another' : 'Generate with AI' }}</span></button>
          </div>
          <div class="flex flex-wrap items-center gap-3 text-xs">
            @if ($card['backgroundImageUrl'])
              <button type="button" class="font-semibold text-red-700 hover:underline" data-remove-background>Remove — use the design's own background</button>
            @endif
            @if ($card['aiProvider'] === 'builtin')
              <span class="text-ink-400">AI image service not set up — a built-in pattern in your colours is made instead.</span>
            @endif
          </div>
        </div>
      </div>
    </div>

    {{-- Designs --}}
    <div class="card p-5">
      <div class="mb-4">
        <h3 class="font-bold text-ink-900">Choose a design</h3>
        <p class="mt-0.5 text-sm text-ink-500">
          {{ count($card['templates']) }} designs for {{ $biz['category']['name'] ?? 'your category' }}, shown with your details. Switch any time — nothing you entered changes.
        </p>
      </div>
      @if (empty($card['templates']))
        <p class="rounded-md bg-gray-50 px-3 py-6 text-center text-sm text-ink-500">No designs are available yet. Please check back soon.</p>
      @else
        <div class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          @foreach ($card['templates'] as $t)
            @php $selected = $t['id'] === $card['templateId']; @endphp
            <div @class(['overflow-hidden rounded-xl border bg-white transition', 'border-brand-500 ring-2 ring-brand-200' => $selected, 'border-gray-200 hover:shadow-md' => ! $selected])>
              <button type="button" class="relative block h-72 w-full overflow-hidden bg-gray-100 text-left" data-preview-template="{{ $t['id'] }}" title="Preview {{ $t['name'] }}">
                {{-- Half-size render of the real card; pointer events off so the tile is one button. --}}
                <iframe srcdoc="{{ $t['previewHtml'] }}" data-template-frame="{{ $t['id'] }}" sandbox="" loading="lazy" tabindex="-1" aria-hidden="true" class="pointer-events-none absolute left-0 top-0 origin-top-left border-0" style="width:200%;height:200%;transform:scale(.5)"></iframe>
                <span class="absolute left-2 top-2 flex gap-1">
                  @if ($selected)<span class="badge bg-brand-600 text-white"><x-icon name="check" :size="11" /> In use</span>@endif
                  @if ($t['isPremium'])<span class="badge bg-amber-100 text-amber-800">@if ($t['locked'])<x-icon name="lock" :size="11" />@endif Premium</span>@endif
                </span>
              </button>
              <div class="flex items-center justify-between gap-2 border-t border-gray-100 p-3">
                <div class="min-w-0">
                  <p class="truncate text-sm font-semibold text-ink-900">{{ $t['name'] }}</p>
                  <p class="text-[11px] capitalize text-ink-500">{{ $t['layout'] }} layout · {{ $t['design']['fonts']['heading'] }}</p>
                </div>
                @if ($selected)
                  <span class="text-xs font-semibold text-brand-700">Selected</span>
                @elseif ($t['locked'])
                  <span class="text-right text-[11px] text-amber-700">Needs a paid plan</span>
                @else
                  <button type="button" class="btn-primary shrink-0 px-3 py-1.5 text-xs" data-use-template="{{ $t['id'] }}">Use this</button>
                @endif
              </div>
            </div>
          @endforeach
        </div>
      @endif
    </div>
  </div>

  @php
      $cardData = [
          'publicUrl' => $card['publicUrl'],
          'slug' => $biz['slug'],
          'templates' => collect($card['templates'])->map(fn ($t) => ['id' => $t['id'], 'name' => $t['name'], 'locked' => $t['locked']])->values(),
          'templateId' => $card['templateId'],
      ];
  @endphp
  <script type="application/json" id="card-data">@json($cardData)</script>
@endif
