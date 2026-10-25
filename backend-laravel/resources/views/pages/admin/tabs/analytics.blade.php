@php
    use App\Http\Controllers\Web\AdminPageController as A;
    $stats = $pageStats['pages'] ?? [];
    $maxViews = max(1, ...array_map(fn ($p) => $p['views'], $stats ?: [['views' => 1]]));
    $n = fn ($v) => number_format($v);
@endphp
<div class="space-y-4">
  {{-- Online now: refreshed every 15s by admin.js --}}
  <div class="card p-5">
    <div class="mb-3 flex items-center justify-between">
      <h3 class="flex items-center gap-1.5 font-bold text-ink-900"><x-icon name="radio" :size="16" class="text-emerald-600" /> Online now</h3>
      <span class="badge bg-emerald-50 text-emerald-700" data-online-count>{{ count($online['online'] ?? []) }} active</span>
    </div>
    <div data-online-list>
      @include('pages.admin.partials.online', ['visitors' => $online['online'] ?? [], 'failed' => $online === null])
    </div>
  </div>

  <div class="card p-5">
    <div class="mb-3 flex flex-wrap items-center justify-between gap-2">
      <h3 class="flex items-center gap-1.5 font-bold text-ink-900"><x-icon name="trending-up" :size="16" class="text-brand-600" /> Most visited pages</h3>
      <div class="flex gap-1 rounded-lg bg-gray-100 p-1">
        @foreach (A::PAGE_RANGES as $value => $label)
          <a href="/admin?tab=Analytics&range={{ $value }}" @class([
              'rounded-md px-2.5 py-1 text-xs font-semibold transition-colors',
              'bg-white text-brand-700 shadow-sm' => $range === $value,
              'text-ink-500 hover:text-ink-800' => $range !== $value,
          ])>{{ $label }}</a>
        @endforeach
      </div>
    </div>

    @if ($pageStats === null)
      <p class="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">Could not load page views.</p>
    @elseif (count($stats) === 0)
      <p class="text-sm text-ink-500">No page views recorded in this range yet.</p>
    @else
      <p class="mb-3 text-xs text-ink-500">{{ $n($pageStats['totalViews']) }} total views</p>
      <div class="space-y-2.5">
        @foreach ($stats as $p)
          <div>
            <div class="mb-1 flex items-center justify-between gap-2 text-sm">
              <span class="truncate font-mono text-ink-800">{{ $p['path'] }}</span>
              <span class="shrink-0 text-xs text-ink-500">{{ $n($p['views']) }} views · {{ $n($p['uniqueVisitors']) }} unique</span>
            </div>
            <div class="h-1.5 rounded-full bg-gray-100">
              <div class="h-1.5 rounded-full bg-brand-500" style="width: {{ ($p['views'] / $maxViews) * 100 }}%"></div>
            </div>
          </div>
        @endforeach
      </div>
    @endif
  </div>
</div>
