@php
    $items = $visitors['data'] ?? [];
    $meta = $visitors['meta'] ?? ['page' => 1, 'totalPages' => 1, 'total' => 0];
    $summary = $visitors['summary'] ?? ['located' => 0, 'todayCount' => 0];
@endphp
{{-- Numbers captured by the welcome popup. --}}
<div>
  <div class="grid grid-cols-3 gap-3 mb-4">
    <div class="card p-4"><p class="text-2xl font-extrabold text-ink-900 leading-none">{{ $meta['total'] }}</p><p class="text-xs text-ink-500 mt-1">Numbers captured</p></div>
    <div class="card p-4"><p class="text-2xl font-extrabold text-emerald-700 leading-none">{{ $summary['located'] }}</p><p class="text-xs text-ink-500 mt-1">Shared location</p></div>
    <div class="card p-4 border-brand-200 bg-brand-50/40"><p class="text-2xl font-extrabold text-brand-700 leading-none">{{ $summary['todayCount'] }}</p><p class="text-xs text-ink-500 mt-1">New today</p></div>
  </div>

  <form method="GET" class="flex flex-col sm:flex-row gap-3 mb-4" data-filter-form>
    <input type="hidden" name="tab" value="Visitors" />
    <div class="flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-3 flex-1">
      <x-icon name="search" :size="16" class="text-gray-400" />
      <input name="search" value="{{ request('search') }}" placeholder="Search by number or city…" class="w-full py-2.5 text-sm focus:outline-none" data-live-search />
    </div>
    <label class="flex items-center gap-2 text-sm text-ink-700 whitespace-nowrap">
      <input type="checkbox" name="located" value="1" @checked(request()->boolean('located')) data-autosubmit-check /> With location only
    </label>
  </form>

  @if ($visitors === null)
    <p class="text-sm text-red-700 bg-red-50 rounded-md px-3 py-2 mb-4">Could not load visitors.</p>
  @endif

  <div class="card divide-y divide-gray-100">
    @forelse ($items as $v)
      <div class="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
        <div class="min-w-0">
          <p class="font-semibold text-sm text-ink-900">+91 {{ $v['phone'] }}</p>
          <p class="text-xs text-ink-500 mt-0.5 flex items-center gap-1">
            @if ($v['latitude'] !== null && $v['longitude'] !== null)
              <x-icon name="map-pin" :size="11" class="text-emerald-600" />
              <a href="https://www.google.com/maps?q={{ $v['latitude'] }},{{ $v['longitude'] }}" target="_blank" rel="noreferrer" class="hover:text-brand-600 hover:underline">{{ number_format($v['latitude'], 4) }}, {{ number_format($v['longitude'], 4) }}</a>
              @if (! empty($v['city']))
                <span>· {{ $v['city'] }}</span>
              @endif
            @else
              <span class="text-ink-400">Location not shared</span>
            @endif
          </p>
          <p class="text-[11px] text-ink-400 mt-0.5">
            First seen <span data-local-date="{{ $v['createdAt'] }}">{{ $v['createdAt'] }}</span> · {{ $v['visitCount'] }} {{ $v['visitCount'] === 1 ? 'visit' : 'visits' }} · last <span data-local-datetime="{{ $v['lastSeenAt'] }}">{{ $v['lastSeenAt'] }}</span>
          </p>
        </div>
        <div class="flex flex-wrap items-center gap-2 sm:shrink-0">
          @if ($v['latitude'] !== null)
            <span class="badge bg-emerald-50 text-emerald-700">Located</span>
          @endif
          <a href="tel:+91{{ $v['phone'] }}" class="btn-secondary px-3 py-1.5 text-sm">Call</a>
        </div>
      </div>
    @empty
      <div class="p-8 text-center text-sm text-ink-500">No visitors captured yet.</div>
    @endforelse
  </div>
  <x-pager :page="$meta['page']" :total-pages="$meta['totalPages']" />
</div>
