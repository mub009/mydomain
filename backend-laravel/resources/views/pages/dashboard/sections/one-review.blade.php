{{-- One Review (a feature the dealer gives the business, App\Support\OneReview):
     the page's link and QR code, and which review and social links it shows,
     each with how often it was tapped. The links themselves are edited in
     Reviews & QR and Contact. Driven by resources/js/pages/one-review-manager.js. --}}
@php $o = $oneReview ?? null; @endphp

@if (! $o)
  <p class="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">Could not load the One Review page.</p>
@else
  @php
      $active = collect($o['links'])->whereNotNull('href');
      $missing = collect($o['links'])->whereNull('href');
      // Where each link is set up.
      $editIn = ['GOOGLE' => 'Reviews & QR', 'FACEBOOK' => 'Reviews & QR', 'FACEBOOK_PAGE' => 'Reviews & QR', 'INSTAGRAM' => 'Reviews & QR', 'YOUTUBE' => 'Reviews & QR',
          'TIKTOK' => 'Reviews & QR', 'X' => 'Reviews & QR', 'LINKEDIN' => 'Reviews & QR', 'SNAPCHAT' => 'Reviews & QR', 'THREADS' => 'Reviews & QR', 'PINTEREST' => 'Reviews & QR', 'TELEGRAM' => 'Reviews & QR',
          'AI_REVIEW' => 'AI Google Review', 'WHATSAPP' => 'Contact', 'CALL' => 'Contact', 'WEBSITE' => 'Contact', 'DIRECTIONS' => 'Contact'];
  @endphp
  <div class="space-y-5" data-one-review>
    @if (! $o['published'])
      <p class="rounded-xl border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-900">Your One Review page goes live once your listing is published.</p>
    @endif

    <div class="grid gap-5 lg:grid-cols-[1fr_auto]">
      <div class="card p-5">
        <h3 class="flex items-center gap-1.5 font-bold text-ink-900"><x-icon name="qr-code" :size="16" class="text-brand-600" /> Your One Review page</h3>
        <p class="mt-0.5 text-sm text-ink-500">One QR code for everything: customers scan it and tap the icon for Google, Facebook, Instagram, YouTube, TikTok and your other social media.</p>

        <div class="mt-4 flex items-center gap-2 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2">
          <span class="min-w-0 flex-1 truncate font-mono text-sm text-ink-800">{{ $o['url'] }}</span>
          <button type="button" class="shrink-0 rounded-md px-2 py-1 text-xs font-semibold text-brand-700 hover:bg-brand-50" data-copy-url><x-icon name="copy" :size="14" /> <span>Copy</span></button>
        </div>
        <div class="mt-3 flex flex-wrap gap-2">
          @if ($o['live'])
            <a href="{{ $o['url'] }}" target="_blank" rel="noopener" class="btn-secondary px-3 py-2 text-sm"><x-icon name="external-link" :size="15" /> Open page</a>
          @endif
          <a href="https://wa.me/?text={{ rawurlencode('Thank you for visiting us! Review us and follow us here: '.$o['url']) }}" target="_blank" rel="noopener" class="btn-secondary px-3 py-2 text-sm"><x-icon name="message-square" :size="15" /> Send on WhatsApp</a>
          <button type="button" class="btn-secondary px-3 py-2 text-sm" data-download-qr><x-icon name="download" :size="15" /> Download QR</button>
        </div>

        <dl class="mt-5 grid grid-cols-2 gap-3">
          <div class="rounded-xl bg-gray-50 px-3 py-2.5">
            <dt class="text-[11px] font-semibold uppercase tracking-wide text-ink-500">Page opened</dt>
            <dd class="mt-0.5 text-xl font-bold tabular-nums text-ink-900">{{ number_format($o['views']) }}</dd>
          </div>
          <div class="rounded-xl bg-gray-50 px-3 py-2.5">
            <dt class="text-[11px] font-semibold uppercase tracking-wide text-ink-500">Links tapped</dt>
            <dd class="mt-0.5 text-xl font-bold tabular-nums text-ink-900">{{ number_format($active->sum('taps')) }}</dd>
          </div>
        </dl>
      </div>

      <div class="card flex flex-col items-center justify-center p-5">
        <img alt="QR code for your One Review page" class="h-44 w-44" data-qr />
        <p class="mt-2 text-center text-xs font-semibold text-ink-700">Scan to review &amp; follow us</p>
      </div>
    </div>

    <div class="card p-5">
      <h3 class="font-bold text-ink-900">Links on your page</h3>
      <p class="mt-0.5 text-sm text-ink-500">Shown in this order. Only the links you've set up appear to customers.</p>
      <ul class="mt-4 divide-y divide-gray-100">
        @foreach ($active as $l)
          <li class="flex items-center gap-3 py-2.5">
            <span class="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600"><x-icon name="check" :size="16" /></span>
            <span class="min-w-0 flex-1">
              <span class="block text-sm font-semibold text-ink-900">{{ $l['label'] }}</span>
              <span class="block truncate text-[11px] text-ink-500">{{ $l['href'] }}</span>
            </span>
            <span class="shrink-0 text-xs font-semibold tabular-nums text-ink-500">{{ number_format($l['taps']) }} {{ $l['taps'] === 1 ? 'tap' : 'taps' }}</span>
          </li>
        @endforeach
      </ul>

      @if ($missing->isNotEmpty())
        <p class="mt-5 text-xs font-semibold uppercase tracking-wide text-ink-500">Not set up yet</p>
        <ul class="mt-2 flex flex-wrap gap-2">
          @foreach ($missing as $l)
            @php $where = $editIn[$l['key']] ?? null; @endphp
            <li>
              @if ($where)
                <a href="?section={{ urlencode($where) }}" class="inline-flex items-center gap-1.5 rounded-lg border border-dashed border-gray-300 px-3 py-1.5 text-xs font-medium text-ink-600 hover:border-brand-500 hover:text-brand-700"><x-icon name="plus" :size="13" /> {{ $l['label'] }}</a>
              @else
                <span class="inline-flex rounded-lg border border-dashed border-gray-300 px-3 py-1.5 text-xs text-ink-500">{{ $l['label'] }}</span>
              @endif
            </li>
          @endforeach
        </ul>
      @endif
    </div>
  </div>
  <script type="application/json" id="one-review-data">@json(['url' => $o['url']])</script>
@endif
