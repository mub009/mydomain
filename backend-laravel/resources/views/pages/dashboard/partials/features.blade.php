{{-- Which features this business has — its website on a subdomain, the
     digital visiting card, gold-rate posters, AI review, One Review
     (App\Support\BusinessFeatures). The dealer who set it up turns them on
     and off for the admin's price in points (App\Support\FeaturePlans); an
     admin does it free. A timed feature shows its end date and a Renew
     button; past that date it is switched off until renewed. The business
     only sees the sections of the features it has. Saved by
     resources/js/pages/manage.js. --}}
@php
    use App\Support\BusinessFeatures as F;
    use App\Support\FeaturePlans;
    // The prices of the dealer who set the business up (their pricing group).
    $plans = FeaturePlans::forUser($biz['createdById'] ?? null);
    $isDealerHere = $dealerPoints !== null;
@endphp
@if ($canChangeFeatures)
  <div class="card p-5" data-features-panel hidden>
    <div class="flex flex-wrap items-start justify-between gap-3">
      <div>
        <h3 class="flex items-center gap-1.5 font-bold text-ink-900"><x-icon name="sliders-horizontal" :size="16" class="text-brand-600" /> Features for this business</h3>
        <p class="mt-0.5 text-sm text-ink-500">
          The business only sees what's turned on here.
          @if ($isDealerHere)
            Each feature costs the points shown. Features with an end date need renewing and aren't refunded; unlimited ones give their points back when turned off.
          @else
            Free for admins. Features you add are unlimited.
          @endif
        </p>
      </div>
      @if ($isDealerHere)
        <span class="inline-flex items-center gap-1.5 rounded-lg border border-amber-200 bg-amber-50 px-3 py-1.5 text-sm font-semibold text-amber-700"><x-icon name="coins" :size="15" /> <span data-points-balance>{{ $dealerPoints }}</span> points</span>
      @endif
    </div>
    <div class="mt-4 grid gap-3 sm:grid-cols-3">
      @foreach (F::ALL as $key)
        @php
            $on = in_array($key, $features, true);
            $expiry = $on ? F::expiry($biz, $key) : null;
            $expired = $expiry && ! $expiry->isFuture();
            $soon = $expiry && ! $expired && $expiry->lte(now()->addDays(30));
            // A dealer can't switch off a paid timed feature before its end date.
            $locked = $isDealerHere && $expiry && ! $expired;
            $plan = $plans[$key];
        @endphp
        <div @class([
            'flex flex-col gap-2 rounded-xl border p-3 transition',
            'border-red-200 bg-red-50/40' => $expired,
            'border-gray-200 has-[:checked]:border-brand-500 has-[:checked]:bg-brand-50/50' => ! $expired,
        ])>
          <label class="flex cursor-pointer gap-3">
            <input type="checkbox" class="mt-0.5 h-4 w-4 rounded border-gray-300 disabled:cursor-not-allowed" value="{{ $key }}" data-feature
              data-cost="{{ $isDealerHere ? $plan['points'] : 0 }}" data-timed="{{ $plan['months'] ? 1 : 0 }}" @checked($on) @disabled($locked) />
            <span class="min-w-0">
              <span class="block text-sm font-semibold text-ink-900">{{ F::LABELS[$key] }}</span>
              <span class="mt-0.5 block text-xs text-ink-500">{{ F::BLURBS[$key] }}</span>
              @if ($isDealerHere)
                <span class="mt-1.5 inline-flex items-center gap-1 rounded-md bg-amber-50 px-1.5 py-0.5 text-[11px] font-semibold text-amber-700">
                  <x-icon name="coins" :size="11" /> {{ $plan['points'] }} {{ $plan['points'] === 1 ? 'point' : 'points' }} · {{ FeaturePlans::durationLabel($plan['months']) }}
                </span>
                @if ($plan['price'] !== null || $plan['commission'] !== null)
                  <span class="mt-1 block text-[11px] text-ink-700">
                    @if ($plan['price'] !== null)<b>{{ FeaturePlans::priceLabel($plan['price']) }}</b>@endif
                    @if ($plan['commission'] !== null)<span class="text-ink-500">{{ $plan['price'] !== null ? ' · ' : '' }}admin commission {{ FeaturePlans::priceLabel($plan['commission']) }}</span>@endif
                  </span>
                @endif
                @if ($plan['months'])
                  <span class="mt-0.5 block text-[11px] text-ink-500">
                    Renews for {{ $plan['renewalPoints'] }} {{ $plan['renewalPoints'] === 1 ? 'point' : 'points' }}{{ $plan['renewalPrice'] !== null ? ' · '.FeaturePlans::priceLabel($plan['renewalPrice']) : '' }}{{ $plan['renewalCommission'] !== null ? ' · admin commission '.FeaturePlans::priceLabel($plan['renewalCommission']) : '' }}
                  </span>
                @endif
              @endif
            </span>
          </label>
          @if ($expiry)
            <div class="flex flex-wrap items-center justify-between gap-2 border-t border-gray-100 pt-2">
              <span @class(['text-[11px] font-semibold', 'text-red-700' => $expired, 'text-amber-700' => $soon, 'text-ink-500' => ! $expired && ! $soon])>
                @if ($expired)
                  <x-icon name="alert-triangle" :size="12" class="-mt-0.5 inline" /> Expired {{ $expiry->format('j M Y') }} — switched off
                @else
                  Paid until {{ $expiry->format('j M Y') }}
                @endif
              </span>
              <button type="button" class="btn-secondary px-2.5 py-1 text-xs" data-renew-feature="{{ $key }}" data-renew-cost="{{ $isDealerHere ? $plan['renewalPoints'] : 0 }}" data-renew-label="{{ F::LABELS[$key] }}">
                <x-icon name="refresh-cw" :size="12" /> Renew{{ $isDealerHere ? ' · '.$plan['renewalPoints'].' pt'.($plan['renewalPoints'] === 1 ? '' : 's') : '' }}
              </button>
            </div>
          @endif
        </div>
      @endforeach
    </div>
    <div class="mt-4 flex flex-wrap items-center justify-end gap-3">
      <span class="text-xs text-ink-500" data-features-summary></span>
      <button type="button" class="btn-primary px-4 py-2 text-sm" data-save-features disabled><x-icon name="save" :size="15" /> <span>Save features</span></button>
    </div>
  </div>
@endif
