{{-- Which features this business has — its website on a subdomain, the
     digital visiting card, gold-rate posters (App\Support\BusinessFeatures).
     The dealer who set it up turns them on and off, a point each (returned
     when one is turned off); an admin does it free. The business only sees
     the sections of the features it has. Saved by resources/js/pages/manage.js. --}}
@php
    use App\Support\BusinessFeatures as F;
@endphp
@if ($canChangeFeatures)
  <div class="card p-5" data-features-panel hidden>
    <div class="flex flex-wrap items-start justify-between gap-3">
      <div>
        <h3 class="flex items-center gap-1.5 font-bold text-ink-900"><x-icon name="sliders-horizontal" :size="16" class="text-brand-600" /> Features for this business</h3>
        <p class="mt-0.5 text-sm text-ink-500">
          The business only sees what's turned on here.
          @if ($dealerPoints !== null)
            Each feature costs 1 point; turning one off gives the point back.
          @endif
        </p>
      </div>
      @if ($dealerPoints !== null)
        <span class="inline-flex items-center gap-1.5 rounded-lg border border-amber-200 bg-amber-50 px-3 py-1.5 text-sm font-semibold text-amber-700"><x-icon name="coins" :size="15" /> <span data-points-balance>{{ $dealerPoints }}</span> points</span>
      @endif
    </div>
    <div class="mt-4 grid gap-3 sm:grid-cols-3">
      @foreach (F::ALL as $key)
        <label class="flex cursor-pointer gap-3 rounded-xl border border-gray-200 p-3 transition has-[:checked]:border-brand-500 has-[:checked]:bg-brand-50/50">
          <input type="checkbox" class="mt-0.5 h-4 w-4 rounded border-gray-300" value="{{ $key }}" data-feature @checked(in_array($key, $features, true)) />
          <span>
            <span class="block text-sm font-semibold text-ink-900">{{ F::LABELS[$key] }}</span>
            <span class="mt-0.5 block text-xs text-ink-500">{{ F::BLURBS[$key] }}</span>
          </span>
        </label>
      @endforeach
    </div>
    <div class="mt-4 flex flex-wrap items-center justify-end gap-3">
      <span class="text-xs text-ink-500" data-features-summary></span>
      <button type="button" class="btn-primary px-4 py-2 text-sm" data-save-features disabled><x-icon name="save" :size="15" /> <span>Save features</span></button>
    </div>
  </div>
@endif
