@php
    use App\Support\Money;
    $labels = ['PENDING' => 'New', 'CONFIRMED' => 'Confirmed', 'PACKED' => 'Packed', 'SHIPPED' => 'Out for delivery', 'DELIVERED' => 'Delivered', 'CANCELLED' => 'Cancelled'];
    $items = $customers['data'] ?? [];
    $meta = $customers['meta'] ?? ['page' => 1, 'totalPages' => 1, 'total' => 0];
    $search = request('search');
@endphp
{{-- Who buys from this shop. Guests never create an account, so rows are
     grouped by phone number — the one identity every order carries. --}}
<div class="space-y-3">
  <div class="card p-4">
    <div class="flex flex-wrap items-start justify-between gap-3">
      <div>
        <h3 class="flex items-center gap-1.5 font-bold text-ink-900"><x-icon name="users" :size="16" class="text-brand-600" /> Customers</h3>
        <p class="mt-0.5 text-xs text-ink-500">Everyone who has ordered from your shop, with what they have spent. Sorted by biggest spender first.</p>
      </div>
      <button type="button" data-export-customers @disabled($meta['total'] === 0) class="btn-secondary px-3 py-2 text-sm disabled:opacity-50"><x-icon name="download" :size="14" /> <span>Export CSV</span></button>
    </div>

    <form class="mt-3 flex gap-2" method="GET">
      <input type="hidden" name="section" value="Customers" />
      <div class="relative flex-1">
        <x-icon name="search" :size="15" class="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input class="input pl-9" name="search" value="{{ $search }}" placeholder="Search by name or phone…" />
      </div>
      <button class="btn-secondary px-4 py-2 text-sm">Search</button>
      @if ($search)
        <a href="?section=Customers" class="btn-ghost px-3 py-2 text-sm">Clear</a>
      @endif
    </form>
    @if ($customers === null)
      <p class="mt-3 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">Could not load your customers.</p>
    @endif
  </div>

  @if (count($items) === 0)
    <div class="card p-8 text-center">
      <span class="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-gray-100 text-gray-400"><x-icon name="users" :size="22" /></span>
      <p class="mt-3 font-semibold text-ink-900">{{ $search ? 'Nobody matched that search' : 'No customers yet' }}</p>
      <p class="mt-1 text-sm text-ink-500">{{ $search ? 'Try a different name or phone number.' : 'As soon as someone orders from your shop, they appear here.' }}</p>
    </div>
  @else
    <div class="card overflow-x-auto">
      <table class="w-full min-w-[46rem] text-sm">
        <thead>
          <tr class="border-b border-gray-200 text-left text-xs uppercase tracking-wide text-ink-500">
            <th class="px-4 py-3 font-semibold">Customer</th>
            <th class="px-4 py-3 font-semibold">Where</th>
            <th class="px-4 py-3 text-right font-semibold">Orders</th>
            <th class="px-4 py-3 text-right font-semibold">Total spent</th>
            <th class="px-4 py-3 font-semibold">Last order</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-gray-100">
          @foreach ($items as $c)
            <tr class="hover:bg-gray-50/70">
              <td class="px-4 py-3">
                <p class="font-semibold text-ink-900">{{ $c['name'] ?: '—' }}</p>
                <p class="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-ink-500">
                  <a href="tel:{{ $c['phone'] }}" class="inline-flex items-center gap-1 hover:text-brand-600"><x-icon name="phone" :size="11" /> {{ $c['phone'] }}</a>
                  @if (! empty($c['email']))
                    <a href="mailto:{{ $c['email'] }}" class="inline-flex items-center gap-1 hover:text-brand-600"><x-icon name="mail" :size="11" /> {{ $c['email'] }}</a>
                  @endif
                </p>
              </td>
              <td class="px-4 py-3 text-ink-600">
                <p>{{ $c['city'] ?: '—' }}</p>
                @if (! empty($c['address']))
                  <p class="text-xs text-ink-400">{{ $c['address'] }}</p>
                @endif
              </td>
              <td class="px-4 py-3 text-right font-semibold text-ink-900">{{ $c['orderCount'] }}</td>
              <td class="px-4 py-3 text-right font-bold text-ink-900">{{ Money::format($c['totalSpentCents'], $c['currency'] ?? 'INR') }}</td>
              <td class="px-4 py-3">
                <p class="text-ink-700" data-local-date="{{ $c['lastOrderAt'] }}">{{ $c['lastOrderAt'] }}</p>
                <p class="text-xs text-ink-400">{{ $c['lastOrderNumber'] }}{{ ! empty($c['lastOrderStatus']) ? ' · '.($labels[$c['lastOrderStatus']] ?? $c['lastOrderStatus']) : '' }}</p>
              </td>
            </tr>
          @endforeach
        </tbody>
      </table>
    </div>

    <div class="flex flex-wrap items-center justify-between gap-3">
      <p class="text-xs text-ink-500">{{ $meta['total'] }} customer{{ $meta['total'] === 1 ? '' : 's' }}</p>
      <x-pager :page="$meta['page']" :total-pages="$meta['totalPages']" />
    </div>
  @endif
</div>
