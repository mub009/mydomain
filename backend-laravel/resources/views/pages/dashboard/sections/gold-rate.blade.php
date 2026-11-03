{{-- Gold Rate (a feature the dealer gives the business): the posters the
     admin designed for this business, drawn with today's rates and its own
     logo, ready to download and share. Driven by resources/js/pages/gold-posters.js;
     the drawing is resources/js/lib/gold-rate-render.js, as in the admin editor. --}}
@php
    use Illuminate\Support\Carbon;
    $gold = $goldRate ?? ['templates' => [], 'rates' => [], 'updatedAt' => null];
@endphp
<div class="space-y-5" data-gold-posters>
  <div class="card p-5">
    <div class="flex flex-wrap items-start justify-between gap-3">
      <div>
        <h3 class="flex items-center gap-1.5 font-bold text-ink-900"><x-icon name="coins" :size="16" class="text-amber-600" /> Today's gold rates</h3>
        <p class="mt-0.5 text-sm text-ink-500">
          Your posters are drawn with these rates.
          @if ($gold['updatedAt'])
            Updated {{ Carbon::parse($gold['updatedAt'])->timezone(config('app.timezone'))->format('j M Y, g:i a') }}.
          @endif
        </p>
      </div>
    </div>
    <div class="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
      @foreach ($gold['rates'] as $purity => $rate)
        <div class="rounded-xl border border-amber-100 bg-amber-50/60 px-3 py-2.5">
          <p class="text-[11px] font-semibold uppercase tracking-wide text-amber-800">{{ $purity }}</p>
          <p class="mt-0.5 text-lg font-bold tabular-nums text-ink-900">{{ $rate !== null ? '₹'.number_format((float) $rate, 2) : '—' }}</p>
        </div>
      @endforeach
    </div>
  </div>

  <div class="card p-5">
    <h3 class="font-bold text-ink-900">Your posters</h3>
    @if (count($gold['templates']))
      <p class="mt-0.5 text-sm text-ink-500">Download a poster with today's rates and share it on WhatsApp, Instagram or your shop's screen.</p>
      <div class="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
        @foreach ($gold['templates'] as $t)
          <div class="overflow-hidden rounded-xl border border-gray-200 bg-white">
            <div class="aspect-square bg-gray-100">
              <img src="{{ $t['thumbUrl'] }}" alt="{{ $t['name'] }}" loading="lazy" class="h-full w-full object-contain" />
            </div>
            <div class="space-y-2 border-t border-gray-100 p-3">
              <p class="truncate text-sm font-semibold text-ink-900">{{ $t['name'] }}</p>
              <button type="button" class="btn-primary w-full px-3 py-1.5 text-xs" data-download-poster="{{ $t['id'] }}"><x-icon name="download" :size="13" /> <span>Download</span></button>
            </div>
          </div>
        @endforeach
      </div>
    @else
      <p class="mt-3 rounded-md bg-gray-50 px-3 py-6 text-center text-sm text-ink-500">No gold-rate posters yet. They're designed for your business by Markkito — ask your dealer.</p>
    @endif
  </div>
</div>
<script type="application/json" id="gold-posters-data">@json($gold)</script>
