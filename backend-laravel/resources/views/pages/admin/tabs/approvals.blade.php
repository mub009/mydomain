@php
    $items = $pending['data'] ?? [];
    $meta = $pending['meta'] ?? ['page' => 1, 'totalPages' => 1];
@endphp
<div class="space-y-2">
  @foreach ($items as $b)
    <div class="card p-4 flex justify-between items-center gap-3">
      <div class="min-w-0">
        <p class="font-semibold text-sm text-ink-900">{{ $b['name'] }}</p>
        <p class="text-sm text-ink-500">{{ $b['city'] }}, {{ $b['state'] }}{{ ! empty($b['owner']) ? ' · '.($b['owner']['email'] ?? $b['owner']['phone'] ?? '') : '' }}</p>
      </div>
      <div class="flex gap-2 shrink-0">
        <button type="button" data-business-action="approve" data-id="{{ $b['id'] }}" class="btn-primary text-sm px-3 py-1.5"><x-icon name="check" :size="14" /> Approve</button>
        <button type="button" data-business-action="reject" data-id="{{ $b['id'] }}" class="btn-secondary text-sm px-3 py-1.5"><x-icon name="x" :size="14" /> Reject</button>
      </div>
    </div>
  @endforeach
  @if (count($items) === 0)
    <div class="card p-8 text-center text-sm text-ink-500">Nothing pending review.</div>
  @endif
  <x-pager :page="$meta['page']" :total-pages="$meta['totalPages']" />
</div>
