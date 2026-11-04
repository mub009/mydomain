{{-- The dealer's commission report (App\Support\Commission): what they
     collected for features sold and renewed, the admin's commission on it,
     what the admin has recorded receiving, and what is still due. --}}
@php
    $r = $commissionReport ?? null;
    $inr = fn (?int $v) => $v === null ? '—' : ($v < 0 ? '−' : '').'₹'.number_format(abs($v));
@endphp

@if (! $r)
  <p class="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">Could not load the commission report.</p>
@else
  @php $s = $r['summary']; @endphp
  <div class="space-y-4">
    <div class="grid grid-cols-2 gap-3 lg:grid-cols-4">
      <div class="card p-4">
        <p class="text-[11px] font-semibold uppercase tracking-wide text-ink-500">Collected</p>
        <p class="mt-1 text-2xl font-bold tabular-nums text-ink-900">{{ $inr($s['collected']) }}</p>
        <p class="mt-0.5 text-xs text-ink-500">Price of features you sold and renewed</p>
      </div>
      <div class="card p-4">
        <p class="text-[11px] font-semibold uppercase tracking-wide text-ink-500">Commission</p>
        <p class="mt-1 text-2xl font-bold tabular-nums text-ink-900">{{ $inr($s['commission']) }}</p>
        <p class="mt-0.5 text-xs text-ink-500">Admin's share · you keep {{ $inr($s['earnings']) }}</p>
      </div>
      <div class="card p-4">
        <p class="text-[11px] font-semibold uppercase tracking-wide text-ink-500">Paid to admin</p>
        <p class="mt-1 text-2xl font-bold tabular-nums text-emerald-700">{{ $inr($s['paid']) }}</p>
        <p class="mt-0.5 text-xs text-ink-500">Recorded by the admin</p>
      </div>
      <div @class(['card p-4', 'ring-2 ring-amber-300' => $s['due'] > 0])>
        <p class="text-[11px] font-semibold uppercase tracking-wide text-ink-500">Due to admin</p>
        <p @class(['mt-1 text-2xl font-bold tabular-nums', 'text-amber-700' => $s['due'] > 0, 'text-ink-900' => $s['due'] <= 0])>{{ $inr($s['due']) }}</p>
        <p class="mt-0.5 text-xs text-ink-500">Commission minus what you've paid</p>
      </div>
    </div>

    <div class="grid gap-4 lg:grid-cols-[1fr_20rem]">
      <div class="card overflow-hidden">
        <div class="border-b border-gray-100 px-5 py-3">
          <h2 class="font-semibold text-ink-900">Sales and renewals</h2>
          <p class="text-xs text-ink-500">Each feature you sold or renewed, at the price and commission of that day. Refunds take them back off.</p>
        </div>
        <div class="overflow-x-auto">
          <table class="w-full min-w-[560px] text-sm">
            <thead>
              <tr class="border-b border-gray-100 text-left text-[11px] font-semibold uppercase tracking-wide text-ink-500">
                <th class="px-5 py-2">Date</th>
                <th class="py-2 pr-3">Business · feature</th>
                <th class="py-2 pr-3 text-right">Collected</th>
                <th class="px-5 py-2 text-right">Commission</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-gray-100">
              @forelse ($r['sales'] as $t)
                <tr>
                  <td class="whitespace-nowrap px-5 py-2.5 text-xs text-ink-500">{{ \Illuminate\Support\Carbon::parse($t['date'])->format('j M Y') }}</td>
                  <td class="py-2.5 pr-3">
                    <span class="font-medium text-ink-900">{{ $t['business'] ?? 'Deleted business' }}</span>
                    <span class="text-ink-500">· {{ $t['featureLabel'] ?? 'All features' }}</span>
                    @if ($t['type'] === 'FEATURE_RENEWED')<span class="ml-1 rounded bg-amber-50 px-1.5 text-[10px] font-semibold text-amber-700">Renewal</span>@endif
                    @if (in_array($t['type'], ['FEATURE_REMOVED', 'BUSINESS_DELETED'], true))<span class="ml-1 rounded bg-gray-100 px-1.5 text-[10px] font-semibold text-gray-600">Refund</span>@endif
                  </td>
                  <td class="py-2.5 pr-3 text-right tabular-nums text-ink-700">{{ $inr($t['price']) }}</td>
                  <td class="px-5 py-2.5 text-right font-semibold tabular-nums text-ink-900">{{ $inr($t['commission']) }}</td>
                </tr>
              @empty
                <tr><td colspan="4" class="px-5 py-10 text-center text-sm text-ink-500">No sales with a price or commission yet.</td></tr>
              @endforelse
            </tbody>
          </table>
        </div>
        @if ($r['salesMeta']['totalPages'] > 1)
          <div class="border-t border-gray-100 px-5 py-3">
            <x-pager :page="$r['salesMeta']['page']" :total-pages="$r['salesMeta']['totalPages']" />
          </div>
        @endif
      </div>

      <div class="card overflow-hidden">
        <div class="border-b border-gray-100 px-5 py-3">
          <h2 class="font-semibold text-ink-900">Payments to admin</h2>
          <p class="text-xs text-ink-500">Commission the admin has recorded receiving from you.</p>
        </div>
        <ul class="divide-y divide-gray-100">
          @forelse ($r['payments'] as $p)
            <li class="flex items-start justify-between gap-3 px-5 py-2.5">
              <span class="min-w-0">
                <span class="block text-sm font-medium text-ink-900">{{ \Illuminate\Support\Carbon::parse($p['paidOn'])->format('j M Y') }}</span>
                @if ($p['note'])<span class="block truncate text-xs text-ink-500">{{ $p['note'] }}</span>@endif
              </span>
              <span class="shrink-0 font-semibold tabular-nums text-emerald-700">{{ $inr($p['amount']) }}</span>
            </li>
          @empty
            <li class="px-5 py-8 text-center text-sm text-ink-500">No payments recorded yet.</li>
          @endforelse
        </ul>
      </div>
    </div>
  </div>
@endif
