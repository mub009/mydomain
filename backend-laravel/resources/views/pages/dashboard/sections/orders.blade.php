@php
    use App\Support\Money;
    $flow = ['PENDING', 'CONFIRMED', 'PACKED', 'SHIPPED', 'DELIVERED'];
    $labels = ['PENDING' => 'New', 'CONFIRMED' => 'Confirmed', 'PACKED' => 'Packed', 'SHIPPED' => 'Out for delivery', 'DELIVERED' => 'Delivered', 'CANCELLED' => 'Cancelled'];
    $styles = [
        'PENDING' => 'bg-amber-50 text-amber-700', 'CONFIRMED' => 'bg-blue-50 text-blue-700', 'PACKED' => 'bg-indigo-50 text-indigo-700',
        'SHIPPED' => 'bg-violet-50 text-violet-700', 'DELIVERED' => 'bg-emerald-50 text-emerald-700', 'CANCELLED' => 'bg-red-50 text-red-700',
    ];
    $filters = ['' => 'All'] + array_intersect_key($labels, array_flip($flow)) + ['CANCELLED' => 'Cancelled'];
    $items = $orders['data'] ?? [];
    $summary = $orders['summary'] ?? null;
    $meta = $orders['meta'] ?? ['page' => 1, 'totalPages' => 1, 'total' => 0];
    $status = request('status', '');
    $search = request('search');
    // The step a shop would normally move an order to next, or null at the
    // end of the line (delivered or cancelled).
    $next = function (string $s) use ($flow) {
        $i = array_search($s, $flow, true);

        return $i === false || $i === count($flow) - 1 ? null : $flow[$i + 1];
    };
    $filterUrl = fn ($value) => '?'.http_build_query(array_filter(['section' => 'Orders', 'status' => $value, 'search' => $search]));
@endphp
{{-- Orders placed on the shop, with the whole fulfilment flow in one screen. --}}
<div class="space-y-3">
  <div class="card p-4">
    <h3 class="flex items-center gap-1.5 font-bold text-ink-900"><x-icon name="shopping-bag" :size="16" class="text-brand-600" /> Orders</h3>
    <p class="mt-0.5 text-xs text-ink-500">Every order placed on your shop page. Move an order along as you confirm, pack and deliver it.</p>

    @if ($summary)
      <div class="mt-3 grid gap-2 sm:grid-cols-4">
        @foreach ([
            ['Orders today', (string) $summary['todayCount'], 'receipt', null],
            ['Total orders', (string) $summary['total'], 'shopping-bag', null],
            ['Revenue', Money::format($summary['revenueCents']), 'trending-up', 'Excludes cancelled'],
            ['Awaiting you', (string) ($summary['byStatus']['PENDING'] ?? 0), 'receipt', null],
        ] as [$label, $value, $icon, $hint])
          <div class="rounded-lg border border-gray-200 p-3">
            <p class="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-ink-500"><span class="text-brand-600"><x-icon :name="$icon" :size="14" /></span>{{ $label }}</p>
            <p class="mt-1 text-lg font-bold text-ink-900">{{ $value }}</p>
            @if ($hint)
              <p class="text-[10px] text-ink-400">{{ $hint }}</p>
            @endif
          </div>
        @endforeach
      </div>
    @endif

    <div class="mt-3 flex flex-wrap gap-1.5">
      @foreach ($filters as $value => $label)
        <a href="{{ $filterUrl($value) }}" @class([
            'rounded-full px-3 py-1.5 text-xs font-semibold transition-colors',
            'bg-brand-600 text-white' => $status === $value,
            'bg-gray-100 text-ink-600 hover:bg-gray-200' => $status !== $value,
        ])>{{ $label }}{{ $value && ! empty($summary['byStatus'][$value]) ? " ({$summary['byStatus'][$value]})" : '' }}</a>
      @endforeach
    </div>

    <form class="mt-3 flex gap-2" method="GET">
      <input type="hidden" name="section" value="Orders" />
      @if ($status)
        <input type="hidden" name="status" value="{{ $status }}" />
      @endif
      <div class="relative flex-1">
        <x-icon name="search" :size="15" class="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input class="input pl-9" name="search" value="{{ $search }}" placeholder="Order number, customer name or phone…" />
      </div>
      <button class="btn-secondary px-4 py-2 text-sm">Search</button>
      @if ($search)
        <a href="?{{ http_build_query(array_filter(['section' => 'Orders', 'status' => $status])) }}" class="btn-ghost px-3 py-2 text-sm">Clear</a>
      @endif
    </form>
    @if ($orders === null)
      <p class="mt-3 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">Could not load your orders.</p>
    @endif
  </div>

  @if (count($items) === 0)
    <div class="card p-8 text-center">
      <span class="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-gray-100 text-gray-400"><x-icon name="shopping-bag" :size="22" /></span>
      <p class="mt-3 font-semibold text-ink-900">{{ $status || $search ? 'No orders match those filters' : 'No orders yet' }}</p>
      <p class="mt-1 text-sm text-ink-500">{{ $status || $search ? 'Try clearing the filters.' : 'Once your shop is open and a customer checks out, their order shows up here.' }}</p>
    </div>
  @else
    <div class="space-y-2">
      @foreach ($items as $order)
        @php $nextStatus = $next($order['status']); @endphp
        <div class="card overflow-hidden">
          <div class="flex flex-wrap items-center gap-3 p-3.5">
            <div class="min-w-[11rem] flex-1">
              <p class="flex items-center gap-2 text-sm font-bold text-ink-900">{{ $order['orderNumber'] }} <span class="badge {{ $styles[$order['status']] ?? '' }}">{{ $labels[$order['status']] ?? $order['status'] }}</span></p>
              <p class="mt-0.5 text-xs text-ink-500">{{ $order['customerName'] }} · <a href="tel:{{ $order['customerPhone'] }}" class="hover:text-brand-600">{{ $order['customerPhone'] }}</a></p>
              <p class="mt-0.5 text-[11px] text-ink-400"><span data-local-datetime="{{ $order['placedAt'] }}">{{ $order['placedAt'] }}</span> · {{ count($order['items']) }} item{{ count($order['items']) === 1 ? '' : 's' }}</p>
            </div>
            <p class="text-right text-sm font-bold text-ink-900">{{ Money::format($order['totalCents'], $order['currency']) }}</p>
            <div class="flex items-center gap-1.5">
              @if ($nextStatus)
                <button type="button" data-order-status="{{ $nextStatus }}" data-order="{{ $order['id'] }}" data-number="{{ $order['orderNumber'] }}" class="btn-primary px-3 py-1.5 text-xs disabled:opacity-50">Mark {{ mb_strtolower($labels[$nextStatus]) }}</button>
              @endif
              @if (! in_array($order['status'], ['CANCELLED', 'DELIVERED'], true))
                <button type="button" data-order-status="CANCELLED" data-order="{{ $order['id'] }}" data-number="{{ $order['orderNumber'] }}" class="btn-secondary px-3 py-1.5 text-xs disabled:opacity-50">Cancel</button>
              @endif
              <button type="button" data-order-expand="{{ $order['id'] }}" class="rounded-lg p-2 text-ink-400 hover:bg-gray-100 hover:text-ink-700" aria-label="Show order details">
                <span data-when="closed"><x-icon name="chevron-down" :size="16" /></span>
                <span data-when="open" hidden><x-icon name="chevron-up" :size="16" /></span>
              </button>
            </div>
          </div>

          <div class="grid gap-4 border-t border-gray-100 bg-gray-50/60 p-4 sm:grid-cols-2" data-order-details="{{ $order['id'] }}" hidden>
            <div>
              <h4 class="text-xs font-bold uppercase tracking-wide text-ink-500">Items</h4>
              <ul class="mt-2 space-y-2">
                @foreach ($order['items'] as $item)
                  <li class="flex items-center gap-2.5">
                    @if (! empty($item['imageUrl']))
                      <img src="{{ $item['imageUrl'] }}" alt="" class="h-9 w-9 rounded-md object-cover" />
                    @endif
                    <span class="flex-1 text-sm text-ink-800">{{ $item['quantity'] }} × {{ $item['name'] }}</span>
                    <span class="text-sm font-semibold text-ink-900">{{ Money::format($item['lineTotalCents'], $order['currency']) }}</span>
                  </li>
                @endforeach
              </ul>
              <dl class="mt-3 space-y-1 border-t border-gray-200 pt-2 text-sm">
                <div class="flex justify-between text-ink-500"><dt>Subtotal</dt><dd>{{ Money::format($order['subtotalCents'], $order['currency']) }}</dd></div>
                <div class="flex justify-between text-ink-500"><dt>Delivery</dt><dd>{{ $order['deliveryFeeCents'] === 0 ? 'Free' : Money::format($order['deliveryFeeCents'], $order['currency']) }}</dd></div>
                <div class="flex justify-between font-bold text-ink-900"><dt>Total ({{ ($order['paymentMethod'] ?? 'COD') === 'COD' ? 'cash on delivery' : 'paid online' }})</dt><dd>{{ Money::format($order['totalCents'], $order['currency']) }}</dd></div>
              </dl>
            </div>
            <div>
              <h4 class="text-xs font-bold uppercase tracking-wide text-ink-500">Deliver to</h4>
              <p class="mt-2 text-sm text-ink-800">{{ $order['customerName'] }}</p>
              <p class="text-sm text-ink-600">{{ implode(', ', array_filter([$order['addressLine1'] ?? null, $order['addressLine2'] ?? null, $order['city'] ?? null, $order['postalCode'] ?? null])) }}</p>
              @if (! empty($order['customerEmail']))
                <p class="mt-1 text-sm text-ink-600">{{ $order['customerEmail'] }}</p>
              @endif
              @if (! empty($order['notes']))
                <p class="mt-2 rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-800"><strong>Note:</strong> {{ $order['notes'] }}</p>
              @endif
              <a href="tel:{{ $order['customerPhone'] }}" class="btn-secondary mt-3 inline-flex px-3 py-2 text-sm"><x-icon name="phone" :size="14" /> Call {{ $order['customerPhone'] }}</a>
            </div>
          </div>
        </div>
      @endforeach
    </div>

    <div class="flex flex-wrap items-center justify-between gap-3">
      <p class="text-xs text-ink-500">{{ $meta['total'] }} order{{ $meta['total'] === 1 ? '' : 's' }}</p>
      <x-pager :page="$meta['page']" :total-pages="$meta['totalPages']" />
    </div>
  @endif
</div>
