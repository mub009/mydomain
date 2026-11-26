{{-- A dealer's QR boards: the ones they generated, and any they attached to a
     shop. Generate, print, download and share them; a board waits until it is
     attached to a shop, then a scan opens what it was set to. The sheet and
     buttons are lib/qr-boards.js. --}}
@php
    $items = $qr['data'] ?? [];
    $meta = $qr['meta'] ?? ['page' => 1, 'totalPages' => 1, 'total' => 0];
    $summary = $qr['summary'] ?? ['unassigned' => 0, 'assigned' => 0];
    $tint = ['UNASSIGNED' => 'bg-gray-100 text-gray-600', 'ASSIGNED' => 'bg-emerald-50 text-emerald-700', 'DISABLED' => 'bg-red-50 text-red-700'];
    $statusLabel = ['UNASSIGNED' => 'Waiting to be assigned', 'ASSIGNED' => 'Active', 'DISABLED' => 'Disabled'];
    $channelLabels = [
        'GOOGLE' => 'Google review', 'INSTAGRAM' => 'Instagram', 'FACEBOOK' => 'Facebook', 'YOUTUBE' => 'YouTube',
        'WEBSITE' => 'Website', 'DIRECTIONS' => 'Directions to shop', 'AI_REVIEW' => 'AI Google Review page', 'ONE_REVIEW' => 'One Review page', 'MARKKITO_REVIEW' => 'Markkito review', 'MARKKITO' => 'Markkito business page',
    ];
    $pageCodes = collect($items)->where('status', '!=', 'DISABLED')->pluck('code')->values()->all();
@endphp
<div data-dealer-qr>
  <div class="mb-4 grid grid-cols-3 gap-3">
    <div class="card p-4"><p class="text-2xl font-extrabold leading-none text-ink-900">{{ $summary['assigned'] + $summary['unassigned'] }}</p><p class="mt-1 text-xs text-ink-500">Your boards</p></div>
    <div class="card p-4"><p class="text-2xl font-extrabold leading-none text-emerald-700">{{ $summary['assigned'] }}</p><p class="mt-1 text-xs text-ink-500">Active at a shop</p></div>
    <div class="card p-4"><p class="text-2xl font-extrabold leading-none text-ink-900">{{ $summary['unassigned'] }}</p><p class="mt-1 text-xs text-ink-500">Waiting to be assigned</p></div>
  </div>

  <div data-qr-error></div>

  <form method="GET" class="mb-4 flex flex-col gap-3 sm:flex-row">
    <input type="hidden" name="tab" value="qr" />
    <div class="flex flex-1 items-center gap-2 rounded-lg border border-gray-300 bg-white px-3">
      <x-icon name="search" :size="16" class="text-gray-400" />
      <input name="search" value="{{ request('search') }}" placeholder="Search by number or shop…" class="w-full py-2.5 text-sm focus:outline-none" />
    </div>
    <select name="status" class="input sm:w-52" onchange="this.form.submit()">
      <option value="">All boards</option>
      @foreach ($statusLabel as $value => $label)
        <option value="{{ $value }}" @selected(request('status') === $value)>{{ $label }}</option>
      @endforeach
    </select>
    <button type="button" data-generate-boards class="btn-primary whitespace-nowrap px-4 py-2.5"><x-icon name="plus" :size="16" /> Generate boards</button>
  </form>

  @if ($qr === null)
    <p class="mb-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">Could not load your QR boards.</p>
  @endif

  @if (count($pageCodes) > 1)
    <div class="mb-3 flex justify-end">
      <button type="button" data-print-codes="{{ json_encode($pageCodes) }}" class="btn-secondary px-3 py-1.5 text-sm">
        <x-icon name="share-2" :size="14" /> Print, download or share these {{ count($pageCodes) }}
      </button>
    </div>
  @endif

  <div class="card divide-y divide-gray-100">
    @forelse ($items as $board)
      <div class="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between" data-board-row="{{ $board['code'] }}">
        <div class="min-w-0">
          <div class="flex flex-wrap items-center gap-2">
            <p class="font-mono font-bold text-ink-900">{{ $board['code'] }}</p>
            <span class="badge {{ $tint[$board['status']] ?? '' }}">{{ $statusLabel[$board['status']] ?? $board['status'] }}</span>
            @if ($board['status'] === 'ASSIGNED')
              <span class="badge bg-brand-50 text-brand-700">{{ ! empty($board['channel']) ? ($channelLabels[$board['channel']] ?? $board['channel']) : 'Shop default' }}</span>
            @endif
            @if ($board['scanCount'] > 0)
              <span class="text-xs text-ink-400">{{ $board['scanCount'] }} scans</span>
            @endif
          </div>
          @if (! empty($board['business']))
            <p class="mt-0.5 truncate text-xs text-ink-600">{{ $board['business']['name'] }} · {{ $board['business']['city'] }}</p>
          @else
            <p class="mt-0.5 text-xs text-ink-400">Not attached yet — scan it, or type the number, to attach it to a shop.</p>
          @endif
          @if (! empty($board['batchLabel']))
            <p class="mt-0.5 text-[11px] text-ink-400">Batch: {{ $board['batchLabel'] }}</p>
          @endif
        </div>
        <div class="flex flex-wrap items-center gap-2 sm:shrink-0">
          <button type="button" data-print-codes="{{ json_encode([$board['code']]) }}" data-purpose="{{ $board['channel'] ?? '' }}" class="btn-secondary px-3 py-1.5 text-sm"><x-icon name="qr-code" :size="14" /> View / share</button>
          <button type="button" data-qr-png="{{ $board['code'] }}" class="btn-secondary px-3 py-1.5 text-sm"><x-icon name="download" :size="14" /> PNG</button>
          @if ($board['status'] === 'UNASSIGNED')
            <a href="/qr/{{ $board['code'] }}" class="btn-secondary px-3 py-1.5 text-sm"><x-icon name="link-2" :size="14" /> Attach to a shop</a>
          @endif
        </div>
      </div>
    @empty
      <div class="p-8 text-center text-sm text-ink-500">No QR boards yet — click “Generate boards” to make your first batch.</div>
    @endforelse
  </div>
  <x-pager :page="$meta['page']" :total-pages="$meta['totalPages']" />
</div>
