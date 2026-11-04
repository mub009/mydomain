{{-- Admin: the commission report across dealers (App\Support\Commission) —
     what each dealer collected for features sold and renewed, the admin's
     commission on it, what they've paid and what's due. "Commission" on a
     dealer opens the dialog to record a payment (resources/js/pages/admin.js,
     [data-commission]). --}}
@php
    $c = $commissionReport ?? null;
    $inr = fn (?int $v) => $v === null ? '—' : ($v < 0 ? '−' : '').'₹'.number_format(abs($v));
@endphp

@if (! $c)
  <p class="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">Could not load the commission report.</p>
@else
  @php $t = $c['totals']; @endphp
  <div class="space-y-4">
    <div class="grid grid-cols-2 gap-3 lg:grid-cols-5">
      <div class="card p-4">
        <p class="text-[11px] font-semibold uppercase tracking-wide text-ink-500">Collected by dealers</p>
        <p class="mt-1 text-2xl font-bold tabular-nums text-ink-900">{{ $inr($t['collected']) }}</p>
      </div>
      <div class="card p-4">
        <p class="text-[11px] font-semibold uppercase tracking-wide text-ink-500">Commission</p>
        <p class="mt-1 text-2xl font-bold tabular-nums text-ink-900">{{ $inr($t['commission']) }}</p>
      </div>
      <div class="card p-4">
        <p class="text-[11px] font-semibold uppercase tracking-wide text-ink-500">Received</p>
        <p class="mt-1 text-2xl font-bold tabular-nums text-emerald-700">{{ $inr($t['paid']) }}</p>
      </div>
      <div @class(['card p-4', 'ring-2 ring-amber-300' => $t['due'] > 0])>
        <p class="text-[11px] font-semibold uppercase tracking-wide text-ink-500">Due from dealers</p>
        <p @class(['mt-1 text-2xl font-bold tabular-nums', 'text-amber-700' => $t['due'] > 0, 'text-ink-900' => $t['due'] <= 0])>{{ $inr($t['due']) }}</p>
      </div>
      <div class="card col-span-2 p-4 lg:col-span-1">
        <p class="text-[11px] font-semibold uppercase tracking-wide text-ink-500">Received this month</p>
        <p class="mt-1 text-2xl font-bold tabular-nums text-ink-900">{{ $inr($t['paidThisMonth']) }}</p>
      </div>
    </div>

    <form method="GET" class="flex flex-col gap-3 sm:flex-row" data-filter-form>
      <input type="hidden" name="tab" value="Commission" />
      <div class="flex flex-1 items-center gap-2 rounded-lg border border-gray-300 bg-white px-3">
        <x-icon name="search" :size="16" class="text-gray-400" />
        <input name="search" value="{{ request('search') }}" placeholder="Search dealers by name, mobile or email…" class="w-full py-2.5 text-sm focus:outline-none" data-live-search />
      </div>
      <select name="sort" class="input sm:w-48" data-autosubmit>
        @foreach (['due' => 'Most due first', 'commission' => 'Most commission', 'collected' => 'Most collected', 'name' => 'Name'] as $value => $label)
          <option value="{{ $value }}" @selected((request('sort') ?: 'due') === $value)>{{ $label }}</option>
        @endforeach
      </select>
      <label class="flex items-center gap-2 whitespace-nowrap rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm text-ink-700">
        <input type="checkbox" name="due" value="1" @checked(request()->boolean('due')) data-autosubmit-check /> Only with dues
      </label>
    </form>

    <div class="grid gap-4 xl:grid-cols-[1fr_20rem]">
      <div class="card overflow-hidden">
        <div class="overflow-x-auto">
          <table class="w-full min-w-[720px] text-sm">
            <thead>
              <tr class="border-b border-gray-100 text-left text-[11px] font-semibold uppercase tracking-wide text-ink-500">
                <th class="px-5 py-2.5">Dealer</th>
                <th class="py-2.5 pr-3 text-right">Collected</th>
                <th class="py-2.5 pr-3 text-right">Commission</th>
                <th class="py-2.5 pr-3 text-right">Paid</th>
                <th class="py-2.5 pr-3 text-right">Due</th>
                <th class="px-5 py-2.5"></th>
              </tr>
            </thead>
            <tbody class="divide-y divide-gray-100">
              @forelse ($c['dealers'] as $d)
                <tr>
                  <td class="px-5 py-3">
                    <span class="block font-semibold text-ink-900">{{ $d['firstName'] }} {{ $d['lastName'] }}</span>
                    <span class="block text-xs text-ink-500">{{ $d['phone'] ?? $d['email'] }}</span>
                  </td>
                  <td class="py-3 pr-3 text-right tabular-nums text-ink-700">{{ $inr($d['collected']) }}</td>
                  <td class="py-3 pr-3 text-right tabular-nums text-ink-900">{{ $inr($d['commission']) }}</td>
                  <td class="py-3 pr-3 text-right tabular-nums text-emerald-700">{{ $inr($d['paid']) }}</td>
                  <td @class(['py-3 pr-3 text-right font-bold tabular-nums', 'text-amber-700' => $d['due'] > 0, 'text-ink-500' => $d['due'] <= 0])>{{ $inr($d['due']) }}</td>
                  <td class="px-5 py-3 text-right">
                    <button type="button" data-commission="{{ json_encode(['id' => $d['id'], 'firstName' => $d['firstName'], 'lastName' => $d['lastName']]) }}" data-commission-reload
                      class="btn-secondary whitespace-nowrap px-3 py-1.5 text-xs"><x-icon name="receipt" :size="13" /> {{ $d['due'] > 0 ? 'Record payment' : 'Details' }}</button>
                  </td>
                </tr>
              @empty
                <tr><td colspan="6" class="px-5 py-10 text-center text-sm text-ink-500">No dealers found.</td></tr>
              @endforelse
            </tbody>
          </table>
        </div>
        @if ($c['meta']['totalPages'] > 1)
          <div class="border-t border-gray-100 px-5 py-3">
            <x-pager :page="$c['meta']['page']" :total-pages="$c['meta']['totalPages']" />
          </div>
        @endif
      </div>

      <div class="card overflow-hidden">
        <div class="border-b border-gray-100 px-5 py-3">
          <h2 class="font-semibold text-ink-900">Latest payments received</h2>
        </div>
        <ul class="divide-y divide-gray-100">
          @forelse ($c['recentPayments'] as $p)
            <li class="flex items-start justify-between gap-3 px-5 py-2.5">
              <span class="min-w-0">
                <span class="block truncate text-sm font-medium text-ink-900">{{ $p['dealer'] }}</span>
                <span class="block truncate text-xs text-ink-500">{{ \Illuminate\Support\Carbon::parse($p['paidOn'])->format('j M Y') }}{{ $p['note'] ? ' · '.$p['note'] : '' }}</span>
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
