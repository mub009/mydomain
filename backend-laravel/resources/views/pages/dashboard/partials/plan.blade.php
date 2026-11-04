{{-- "Your plan": every feature the business can have (App\Support\BusinessFeatures)
     and whether it has it — active and until when (App\Support\FeaturePlans),
     expiring soon, expired (switched off until renewed) or not included —
     with who to ask to renew or add one. Shown on the business's menu. --}}
@php
    use App\Support\BusinessFeatures as F;
    $rows = collect(F::ALL)->map(function ($key) use ($biz) {
        $has = in_array($key, F::of($biz), true);
        $expiry = $has ? F::expiry($biz, $key) : null;
        $status = match (true) {
            ! $has => 'none',
            $expiry && ! $expiry->isFuture() => 'expired',
            $expiry && $expiry->lte(now()->addDays(30)) => 'soon',
            default => 'active',
        };

        return ['key' => $key, 'label' => F::LABELS[$key], 'blurb' => F::BLURBS[$key], 'expiry' => $expiry, 'status' => $status];
    });
    $activeCount = $rows->whereIn('status', ['active', 'soon'])->count();
    $attention = $rows->whereIn('status', ['expired', 'soon'])->count();
    $badge = [
        'active' => ['Active', 'bg-emerald-50 text-emerald-700 ring-emerald-200', 'check-circle-2'],
        'soon' => ['Expiring soon', 'bg-amber-50 text-amber-800 ring-amber-200', 'clock'],
        'expired' => ['Expired', 'bg-red-50 text-red-700 ring-red-200', 'alert-triangle'],
        'none' => ['Not included', 'bg-gray-50 text-ink-500 ring-gray-200', 'minus'],
    ];
@endphp
<div class="card p-5" data-plan-panel>
  <div class="flex flex-wrap items-start justify-between gap-3">
    <div>
      <h3 class="flex items-center gap-1.5 font-bold text-ink-900"><x-icon name="shield-check" :size="16" class="text-brand-600" /> Your plan</h3>
      <p class="mt-0.5 text-sm text-ink-500">{{ $activeCount }} of {{ $rows->count() }} features active{{ $attention ? ' · '.$attention.' need'.($attention === 1 ? 's' : '').' attention' : '' }}.</p>
    </div>
    @if ($attention && $planContact)
      <p class="max-w-xs text-right text-xs text-ink-500">To renew or add features, contact your dealer
        <b class="text-ink-900">{{ $planContact['name'] }}</b>@if ($planContact['phone']) · <a href="tel:{{ $planContact['phone'] }}" class="font-semibold text-brand-700">{{ $planContact['phone'] }}</a>@endif</p>
    @endif
  </div>

  <ul class="mt-4 divide-y divide-gray-100 rounded-xl border border-gray-100">
    @foreach ($rows as $r)
      @php [$label, $tint, $icon] = $badge[$r['status']]; @endphp
      <li class="flex flex-wrap items-center gap-3 px-4 py-3">
        <span class="min-w-0 flex-1">
          <span @class(['block text-sm font-semibold', 'text-ink-900' => $r['status'] !== 'none', 'text-ink-500' => $r['status'] === 'none'])>{{ $r['label'] }}</span>
          <span class="block text-xs text-ink-500">{{ $r['blurb'] }}</span>
        </span>
        <span class="text-right text-xs text-ink-500">
          @if ($r['status'] === 'none')
            —
          @elseif (! $r['expiry'])
            <b class="text-ink-700">Unlimited</b>
          @elseif ($r['status'] === 'expired')
            Expired on <b class="text-red-700">{{ $r['expiry']->format('j M Y') }}</b><br>Switched off until renewed
          @else
            Valid until <b class="{{ $r['status'] === 'soon' ? 'text-amber-800' : 'text-ink-700' }}">{{ $r['expiry']->format('j M Y') }}</b><br>{{ $r['expiry']->isToday() ? 'Ends today' : now()->startOfDay()->diffInDays($r['expiry']->copy()->startOfDay()).' days left' }}
          @endif
        </span>
        <span class="inline-flex shrink-0 items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold ring-1 {{ $tint }}"><x-icon :name="$icon" :size="12" /> {{ $label }}</span>
      </li>
    @endforeach
  </ul>
</div>
