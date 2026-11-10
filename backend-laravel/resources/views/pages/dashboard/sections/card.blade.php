{{-- The business's digital visiting card: its design (picked from the
     ready-made designs), filled from the listing; publish it and hand out its
     link and QR code (behind "More details"). Its colour is changed on the
     card page itself (cards/partials/owner-bar). Driven by
     resources/js/pages/card-manager.js. --}}
@if (! $card)
  <p class="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">Could not load the visiting card.</p>
@else
  @php
      $base = "/dashboard/businesses/{$biz['id']}";
      $hasImage = (bool) $card['imageUrl'];
  @endphp
  <div class="space-y-5" data-card-manager>
    {{-- Status and actions; the link, QR code and Multi card view sit behind "More details". --}}
    <div class="card p-5">
      <div class="space-y-3">
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
          Your card's buttons and details come from your listing —
          <a href="{{ $base }}?section=Contact" class="font-semibold text-brand-700 hover:underline">edit them in Contact</a>.
          @if ($hasImage)
            Pick its colour below. You can also change the colour or design from your card link while signed in — a bar shows at the bottom, only for you.
          @endif
        </p>
        @unless ($card['listingLive'])
          <p class="rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-800">Your card goes live once your listing is approved.</p>
        @endunless
        <div class="flex flex-wrap gap-2">
          @if ($card['isPublished'])
            @if ($card['live'])
              <a href="{{ $card['publicUrl'] }}" target="_blank" rel="noopener" class="btn-primary px-4 py-2 text-sm"><x-icon name="external-link" :size="15" /> Open card</a>
              <a href="https://wa.me/?text={{ rawurlencode($biz['name'].' — '.$card['publicUrl']) }}" target="_blank" rel="noopener" class="btn-secondary px-4 py-2 text-sm"><x-icon name="message-square" :size="15" /> Share on WhatsApp</a>
            @endif
            <button type="button" class="btn-secondary px-4 py-2 text-sm !text-red-700" data-publish-card="0"><x-icon name="eye-off" :size="15" /> Unpublish</button>
          @else
            <button type="button" class="btn-primary px-4 py-2 text-sm" data-publish-card="1" @disabled(! $hasImage) title="{{ $hasImage ? '' : 'Pick a card design first' }}"><x-icon name="send" :size="15" /> Publish card</button>
          @endif
          <button type="button" class="btn-secondary px-4 py-2 text-sm" data-preview-card><x-icon name="eye" :size="15" /> Preview</button>
          <a href="{{ $base }}/card.pdf" class="btn-secondary px-4 py-2 text-sm"><x-icon name="download" :size="15" /> Download PDF</a>
        </div>
        @if ($hasImage)
          {{-- The card's colour, picked right here (the same choices as the bar on the card link). --}}
          @php
              $c = $card['imageColour'] ?? null;
              $swatches = \App\Support\Cards\ImageColour::SWATCHES;
              $on = ! $c ? 'original' : (! ($c['tint'] ?? null) ? (($c['saturation'] ?? 100) === 0 ? 'mono' : 'original')
                  : (collect($swatches)->first(fn ($s) => $s[3] && strcasecmp($s[3], $c['tint']) === 0)[0] ?? 'custom'));
          @endphp
          <div class="rounded-lg border border-gray-200 p-3" data-card-colour>
            <p class="mb-2 flex items-center gap-1.5 text-sm font-semibold text-ink-900"><x-icon name="palette" :size="15" class="text-brand-600" /> Card colour</p>
            <div class="flex flex-wrap items-center gap-2" role="radiogroup" aria-label="Card colour">
              @foreach ($swatches as [$key, $label, $bg, $tint, $sat])
                <button type="button" role="radio" title="{{ $label }}" aria-label="{{ $label }}" aria-checked="{{ $on === $key ? 'true' : 'false' }}"
                        @class(['h-9 w-9 rounded-full border-2 border-white shadow ring-2 transition', 'ring-brand-600' => $on === $key, 'ring-transparent hover:ring-gray-300' => $on !== $key])
                        style="background: {{ $bg }}" data-colour-tint="{{ $tint ?? '' }}" data-colour-saturation="{{ $sat }}"></button>
              @endforeach
              <label title="Your own colour" @class(['relative flex h-9 w-9 cursor-pointer items-center justify-center rounded-full border-2 text-lg text-ink-500 ring-2', 'border-white ring-brand-600' => $on === 'custom', 'border-dashed border-gray-400 ring-transparent' => $on !== 'custom'])
                     @if ($on === 'custom') style="background: {{ $c['tint'] }}" @endif>
                @unless ($on === 'custom')+@endunless
                <input type="color" class="absolute inset-0 h-full w-full cursor-pointer opacity-0" value="{{ $on === 'custom' ? $c['tint'] : '#2563eb' }}" aria-label="Pick your own colour" data-colour-custom />
              </label>
            </div>
            <p class="mt-1.5 text-xs text-ink-500" data-colour-status>Tap a colour — your card changes straight away.</p>
          </div>
        @endif
        @if ($card['viewCount'] > 0)
          <p class="text-xs text-ink-500">Opened {{ number_format($card['viewCount']) }} {{ $card['viewCount'] === 1 ? 'time' : 'times' }}.</p>
        @endif
      </div>

      {{-- More details: the card link, its QR code and the Multi card view. --}}
      <details class="group mt-4 rounded-lg border border-gray-200" data-card-more>
        <summary class="flex cursor-pointer list-none items-center justify-between gap-2 px-4 py-3 text-sm font-semibold text-ink-900 [&::-webkit-details-marker]:hidden">
          <span class="flex items-center gap-1.5"><x-icon name="qr-code" :size="15" class="text-brand-600" /> More details — card link &amp; QR code</span>
          <x-icon name="chevron-down" :size="16" class="text-ink-500 transition-transform group-open:rotate-180" />
        </summary>
        <div class="flex flex-col gap-5 border-t border-gray-100 p-4 md:flex-row">
          <div class="min-w-0 flex-1 space-y-3">
            <div class="rounded-lg border border-gray-200 bg-gray-50 p-3">
              <p class="mb-1 text-[11px] font-semibold uppercase tracking-wide text-ink-500">Card link</p>
              <div class="flex items-center gap-2">
                <input readonly value="{{ $card['publicUrl'] }}" class="input min-w-0 flex-1 bg-white font-mono text-xs" data-card-url />
                <button type="button" class="btn-secondary shrink-0 px-3 py-2 text-sm" data-copy-card><x-icon name="copy" :size="14" /> <span>Copy</span></button>
              </div>
            </div>
            {{-- Multi card view: the link shows other ready-made designs after the card, as a slider. --}}
            @if (count($card['extraDesigns'] ?? []))
              <div class="rounded-lg border border-gray-200 p-3" data-multi-view>
                <label class="flex cursor-pointer items-start justify-between gap-3">
                  <span>
                    <span class="flex items-center gap-1.5 text-sm font-semibold text-ink-900"><x-icon name="layout-grid" :size="15" class="text-brand-600" /> Multi card view</span>
                    <span class="mt-0.5 block text-xs text-ink-500">People who open your link can swipe through your card and the designs you pick below, and download any of them as a PDF.</span>
                  </span>
                  <input type="checkbox" class="mt-1 h-5 w-5 shrink-0 accent-brand-600" data-multi-toggle @checked($card['multiView']) />
                </label>
                <div class="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-4" data-multi-designs @if (! $card['multiView']) hidden @endif>
                  @foreach ($card['extraDesigns'] as $d)
                    <label class="relative cursor-pointer overflow-hidden rounded-lg border border-gray-200 bg-gray-50 has-[:checked]:border-brand-500 has-[:checked]:ring-2 has-[:checked]:ring-brand-200">
                      <img src="{{ $d['imageUrl'] }}" alt="" loading="lazy" class="aspect-[3/5] w-full object-cover object-top" />
                      <input type="checkbox" class="absolute right-1.5 top-1.5 h-4 w-4 accent-brand-600" value="{{ $d['id'] }}" data-multi-design @checked($d['selected']) />
                      <span class="block truncate bg-white px-2 py-1 text-[11px] font-semibold text-ink-700">{{ $d['name'] }}</span>
                    </label>
                  @endforeach
                </div>
                <p class="mt-2 text-xs" data-multi-status></p>
              </div>
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
      </details>
    </div>

    {{-- What the card shows from the listing, to update right here. The card
         itself is seen with "Preview" or "Open card" above. --}}
    @if (count($card['cardDetails'] ?? []))
      @include('pages.dashboard.partials.card-missing')
    @endif

    {{-- Ready-made image designs made by the admin for this category --}}
    @if (count($card['imageTemplates']))
      <div class="card p-5">
        <div class="mb-4">
          <h3 class="font-bold text-ink-900">Ready-made designs</h3>
          <p class="mt-0.5 text-sm text-ink-500">Designed for {{ $biz['category']['name'] ?? 'your category' }}, with the actions already placed — they use your phone, WhatsApp and address automatically.</p>
        </div>
        <div class="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          @foreach ($card['imageTemplates'] as $t)
            <div @class(['overflow-hidden rounded-xl border bg-white', 'border-brand-500 ring-2 ring-brand-200' => $t['inUse'], 'border-gray-200' => ! $t['inUse']])>
              <div class="relative aspect-[3/5] bg-gray-100">
                <img src="{{ $t['imageUrl'] }}" alt="{{ $t['name'] }}" loading="lazy" class="h-full w-full object-cover object-top" />
                <span class="absolute left-2 top-2 flex gap-1">
                  @if ($t['inUse'])<span class="badge bg-brand-600 text-white"><x-icon name="check" :size="11" /> In use</span>@endif
                </span>
              </div>
              <div class="space-y-2 border-t border-gray-100 p-3">
                <div>
                  <p class="truncate text-sm font-semibold text-ink-900">{{ $t['name'] }}</p>
                  <p class="text-[11px] text-ink-500">{{ $t['actionCount'] }} {{ $t['actionCount'] === 1 ? 'action' : 'actions' }}</p>
                </div>
                @if ($t['inUse'])
                  <span class="block text-xs font-semibold text-brand-700">Selected</span>
                @else
                  <button type="button" class="btn-primary w-full px-3 py-1.5 text-xs" data-use-template="{{ $t['id'] }}" data-name="{{ $t['name'] }}">Use this design</button>
                @endif
              </div>
            </div>
          @endforeach
        </div>
      </div>
    @endif
  </div>

  @php
      $cardData = [
          'publicUrl' => $card['publicUrl'],
          'slug' => $biz['slug'],
          'imageUrl' => $card['imageUrl'],
          'imageWidth' => $card['imageWidth'],
          'imageHeight' => $card['imageHeight'],
          'hotspots' => $card['hotspots'],
          'previewHtml' => $card['imagePreviewHtml'],
          'templateId' => $card['templateId'],
          'imageColour' => $card['imageColour'],
          'imageColourDefaults' => $card['imageColourDefaults'],
      ];
  @endphp
  <script type="application/json" id="card-data">@json($cardData)</script>
@endif
