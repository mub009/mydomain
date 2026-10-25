@php
    $items = $qr['data'] ?? [];
    $meta = $qr['meta'] ?? ['page' => 1, 'totalPages' => 1, 'total' => 0];
    $summary = $qr['summary'] ?? ['unassigned' => 0, 'assigned' => 0];
    $tint = ['UNASSIGNED' => 'bg-gray-100 text-gray-600', 'ASSIGNED' => 'bg-emerald-50 text-emerald-700', 'DISABLED' => 'bg-red-50 text-red-700'];
    $channelLabels = [
        'GOOGLE' => 'Google review', 'INSTAGRAM' => 'Instagram', 'FACEBOOK' => 'Facebook', 'YOUTUBE' => 'YouTube',
        'WEBSITE' => 'Website', 'DIRECTIONS' => 'Directions to shop', 'MARKKITO_REVIEW' => 'Markkito review', 'MARKKITO' => 'Markkito business page',
    ];
@endphp
<div>
  <div class="mb-4 grid grid-cols-3 gap-3">
    <div class="card p-4"><p class="text-2xl font-extrabold leading-none text-ink-900">{{ $meta['total'] }}</p><p class="mt-1 text-xs text-ink-500">Boards issued</p></div>
    <div class="card p-4"><p class="text-2xl font-extrabold leading-none text-emerald-700">{{ $summary['assigned'] }}</p><p class="mt-1 text-xs text-ink-500">Attached to a shop</p></div>
    <div class="card p-4"><p class="text-2xl font-extrabold leading-none text-ink-900">{{ $summary['unassigned'] }}</p><p class="mt-1 text-xs text-ink-500">Awaiting activation</p></div>
  </div>

  <form method="GET" class="mb-4 flex flex-col gap-3 sm:flex-row" data-filter-form>
    <input type="hidden" name="tab" value="QR Boards" />
    <div class="flex flex-1 items-center gap-2 rounded-lg border border-gray-300 bg-white px-3">
      <x-icon name="search" :size="16" class="text-gray-400" />
      <input name="search" value="{{ request('search') }}" placeholder="Search by code or shop…" class="w-full py-2.5 text-sm focus:outline-none" data-live-search />
    </div>
    <select name="status" class="input sm:w-48" data-autosubmit>
      <option value="">All statuses</option>
      @foreach (['UNASSIGNED' => 'Unassigned', 'ASSIGNED' => 'Assigned', 'DISABLED' => 'Disabled'] as $value => $label)
        <option value="{{ $value }}" @selected(request('status') === $value)>{{ $label }}</option>
      @endforeach
    </select>
    <button type="button" data-generate-boards class="btn-primary whitespace-nowrap px-4 py-2.5"><x-icon name="plus" :size="16" /> Generate boards</button>
  </form>

  @if ($qr === null)
    <p class="mb-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">Could not load QR boards.</p>
  @endif

  <div class="card divide-y divide-gray-100">
    @forelse ($items as $board)
      <div class="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
        <div class="min-w-0">
          <div class="flex flex-wrap items-center gap-2">
            <p class="font-mono font-bold text-ink-900">{{ $board['code'] }}</p>
            <span class="badge {{ $tint[$board['status']] ?? '' }}">{{ mb_strtolower($board['status']) }}</span>
            <span class="badge bg-brand-50 text-brand-700">{{ ! empty($board['channel']) ? ($channelLabels[$board['channel']] ?? $board['channel']) : 'Shop default' }}</span>
            @if ($board['scanCount'] > 0)
              <span class="text-xs text-ink-400">{{ $board['scanCount'] }} scans</span>
            @endif
          </div>
          @if (! empty($board['business']))
            <p class="mt-0.5 truncate text-xs text-ink-600">{{ $board['business']['name'] }} · {{ $board['business']['city'] }}</p>
          @else
            <p class="mt-0.5 text-xs text-ink-400">Not attached yet</p>
          @endif
          @if (! empty($board['batchLabel']))
            <p class="mt-0.5 text-[11px] text-ink-400">Batch: {{ $board['batchLabel'] }}</p>
          @endif
        </div>
        <div class="flex flex-wrap items-center gap-2 sm:shrink-0">
          <button type="button" data-print-codes="{{ json_encode([$board['code']]) }}" data-purpose="{{ $board['channel'] ?? '' }}" class="btn-secondary px-3 py-1.5 text-sm"><x-icon name="qr-code" :size="14" /> View</button>
          <button type="button" data-qr-png="{{ $board['code'] }}" class="btn-secondary px-3 py-1.5 text-sm"><x-icon name="download" :size="14" /> PNG</button>
          @if ($board['status'] === 'ASSIGNED')
            <button type="button" data-qr-update="{{ $board['id'] }}" data-payload='{"businessId":null}' data-message="{{ $board['code'] }} released back to the unassigned pool." class="btn-secondary px-3 py-1.5 text-sm"><x-icon name="unlink" :size="14" /> Detach</button>
          @endif
          @if ($board['status'] !== 'DISABLED')
            <button type="button" data-qr-update="{{ $board['id'] }}" data-payload='{"status":"DISABLED"}' data-message="{{ $board['code'] }} marked disabled." class="btn-secondary px-3 py-1.5 text-sm">Disable</button>
          @else
            <button type="button" data-qr-update="{{ $board['id'] }}" data-payload='{"status":"UNASSIGNED"}' data-message="{{ $board['code'] }} marked unassigned." class="btn-secondary px-3 py-1.5 text-sm">Re-enable</button>
          @endif
        </div>
      </div>
    @empty
      <div class="p-8 text-center text-sm text-ink-500">No QR boards yet — click “Generate boards” to issue your first batch.</div>
    @endforelse
  </div>
  <x-pager :page="$meta['page']" :total-pages="$meta['totalPages']" />
</div>
