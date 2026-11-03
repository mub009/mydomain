{{-- The business's digital visiting card: upload its own card artwork (a
     JPG), drag actions — Call, WhatsApp, Directions, … — onto it, publish
     it, and hand out its link and QR code. Driven by
     resources/js/pages/card-manager.js; the actions are stored as
     percent-of-image rectangles (App\Support\Cards\ImageCard). --}}
@if (! $card)
  <p class="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">Could not load the visiting card.</p>
@else
  @php
      $base = "/dashboard/businesses/{$biz['id']}";
      $hasImage = (bool) $card['imageUrl'];
      $currentImageTemplate = collect($card['imageTemplates'])->firstWhere('inUse', true);
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
            @if ($card['canEdit'])
              Upload your own card design and place tap-to-act buttons on it. Actions left empty use your listing's details —
            @else
              Your card's buttons and details come from your listing —
            @endif
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
              <button type="button" class="btn-primary px-4 py-2 text-sm" data-publish-card="1" @disabled(! $hasImage) title="{{ $hasImage ? '' : 'Upload your card image first' }}"><x-icon name="send" :size="15" /> Publish card</button>
            @endif
            <button type="button" class="btn-secondary px-4 py-2 text-sm" data-preview-card><x-icon name="eye" :size="15" /> Preview</button>
            <a href="{{ $base }}/card.pdf" class="btn-secondary px-4 py-2 text-sm"><x-icon name="download" :size="15" /> Download PDF</a>
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

    @unless ($card['canEdit'])
      {{-- Business owners: the card as it looks, and what their listing still needs for it.
           The design itself is set up by their dealer or an admin. --}}
      <div class="card p-5">
        <div class="mb-4">
          <h3 class="flex items-center gap-1.5 font-bold text-ink-900"><x-icon name="image" :size="16" class="text-brand-600" /> Your card</h3>
          <p class="mt-0.5 text-sm text-ink-500">Your card shows your listing's details. To change the design itself, pick a ready-made design below or ask your dealer.</p>
        </div>
        <div class="grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
          <div class="min-w-0">
            @if ($card['imagePreviewHtml'])
              <div class="mx-auto w-full max-w-[360px] overflow-hidden rounded-xl border border-gray-200 bg-gray-50">
                <iframe sandbox="" title="Your card" class="block h-[600px] w-full border-0" data-card-readonly-preview></iframe>
              </div>
            @else
              <p class="rounded-md bg-gray-50 px-3 py-6 text-center text-sm text-ink-500">Your card design isn't set up yet. Pick a ready-made design below, or ask your dealer.</p>
            @endif
          </div>
          <div>
            @if (count($card['missingDetails']))
              <div class="rounded-xl border border-amber-200 bg-amber-50 p-4">
                <p class="flex items-center gap-1.5 text-sm font-bold text-amber-900"><x-icon name="alert-triangle" :size="15" /> Missing on your listing</p>
                <p class="mt-1 text-xs text-amber-800">Your card has a place for these, but your listing doesn't have them yet. Add them and they appear on your card automatically.</p>
                <ul class="mt-3 space-y-1.5">
                  @foreach ($card['missingDetails'] as $m)
                    <li class="flex items-center justify-between gap-2 rounded-lg bg-white px-3 py-2 text-sm">
                      <span class="font-semibold text-ink-900">{{ $m['label'] }}</span>
                      <a href="{{ $base }}?section={{ urlencode($m['section']) }}" class="shrink-0 text-xs font-semibold text-brand-700 hover:underline">Add in {{ $m['section'] }} →</a>
                    </li>
                  @endforeach
                </ul>
              </div>
            @elseif ($card['imagePreviewHtml'])
              <div class="rounded-xl border border-emerald-200 bg-emerald-50 p-4">
                <p class="flex items-center gap-1.5 text-sm font-bold text-emerald-900"><x-icon name="check-circle-2" :size="15" /> Your card has everything it needs</p>
                <p class="mt-1 text-xs text-emerald-800">Every button and detail on it is filled from your listing.</p>
              </div>
            @endif
            @if ($hasImage)
              <div class="mt-4">@include('pages.dashboard.partials.card-colour')</div>
            @endif
          </div>
        </div>
      </div>
    @else
    {{-- The editor: the card image with its actions, and the palette to drag them from --}}
    <div class="card p-5" data-card-editor>
      <div class="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 class="flex items-center gap-1.5 font-bold text-ink-900"><x-icon name="image" :size="16" class="text-brand-600" /> Card design & actions</h3>
          <p class="mt-0.5 text-sm text-ink-500">Upload your card as a JPG — or start from a ready-made design below — then click on it to add actions over the buttons or icons in the design.</p>
        </div>
        <div class="flex flex-wrap items-center gap-2">
          <span class="hidden text-xs font-semibold text-amber-700" data-dirty-note>Unsaved changes</span>
          <button type="button" class="btn-primary px-4 py-2 text-sm" data-save-card disabled><x-icon name="save" :size="15" /> <span>Save card</span></button>
        </div>
      </div>

      @if ($card['imageFromTemplate'])
        <p class="mb-4 rounded-md bg-sky-50 px-3 py-2 text-xs text-sky-800">
          Your card uses the ready-made design <span class="font-semibold">{{ $currentImageTemplate['name'] ?? '' }}</span>, linked to your listing's details. Changes you save here make it your own copy.
        </p>
      @elseif ($card['canResetImage'])
        <p class="mb-4 flex flex-wrap items-center gap-2 rounded-md bg-gray-50 px-3 py-2 text-xs text-ink-600">
          You've customised your design.
          <button type="button" class="font-semibold text-brand-700 hover:underline" data-reset-image>Go back to the original design</button>
        </p>
      @endif

      <x-hotspot-editor subject="your card" :replaceable="false" :palette="false" />

      @if ($hasImage)
        <div class="mt-5 max-w-md">@include('pages.dashboard.partials.card-colour')</div>
      @endif
    </div>
    @endunless

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
          'actions' => $card['actions'],
          'fonts' => $card['fonts'],
          'listingDefaults' => $card['listingDefaults'],
          'previewHtml' => $card['imagePreviewHtml'],
          'templateId' => $card['templateId'],
          'canEdit' => $card['canEdit'],
          'imageColour' => $card['imageColour'],
          'imageColourDefaults' => $card['imageColourDefaults'],
      ];
  @endphp
  <script type="application/json" id="card-data">@json($cardData)</script>
@endif
