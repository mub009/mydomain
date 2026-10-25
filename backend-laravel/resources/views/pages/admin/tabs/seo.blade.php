@php
    use Illuminate\Support\Carbon;
    $items = $seo['data'] ?? [];
    $meta = $seo['meta'] ?? ['page' => 1, 'totalPages' => 1, 'total' => 0];
    $summary = $meta['summary'] ?? ['total' => 0, 'indexed' => 0, 'waiting' => 0, 'overdue' => 0, 'queued' => 0, 'failing' => 0, 'indexedInTarget' => 0];
    $connected = $meta['googleConnected'] ?? false;
    $days = intdiv($meta['targetHours'] ?? 48, 24);
    $stages = [
        'INDEXED' => ['On Google', 'bg-emerald-50 text-emerald-700'],
        'WAITING' => ["Waiting (< {$days} days)", 'bg-amber-50 text-amber-700'],
        'OVERDUE' => ["Overdue (> {$days} days)", 'bg-red-50 text-red-700'],
    ];
    $kinds = ['LISTING' => 'Listing page', 'WEBSITE' => 'Website'];
    $inTargetRate = $summary['indexed'] > 0 ? (int) round(100 * $summary['indexedInTarget'] / $summary['indexed']) : null;
@endphp
{{-- Which business pages are in Google, measured against the two-day target. --}}
<div>
  @if (! $connected)
    <div class="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
      <p class="font-semibold">Google Search Console is not connected.</p>
      <p class="mt-0.5">Pages are tracked and listed in <a href="/sitemap.xml" target="_blank" class="underline">/sitemap.xml</a>, but nothing is submitted to Google or checked until
        <code>GOOGLE_SEARCH_CREDENTIALS</code> and <code>GOOGLE_SEARCH_PROPERTY</code> are set (see README “SEO and Google”).</p>
    </div>
  @endif

  <div class="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-5">
    <div class="card p-4"><p class="text-2xl font-extrabold leading-none text-ink-900">{{ $summary['total'] }}</p><p class="mt-1 text-xs text-ink-500">Pages tracked</p></div>
    <div class="card p-4"><p class="text-2xl font-extrabold leading-none text-emerald-700">{{ $summary['indexed'] }}</p><p class="mt-1 text-xs text-ink-500">On Google</p></div>
    <div class="card p-4"><p class="text-2xl font-extrabold leading-none text-amber-600">{{ $summary['waiting'] }}</p><p class="mt-1 text-xs text-ink-500">Waiting, inside {{ $days }} days</p></div>
    <div class="card p-4 {{ $summary['overdue'] > 0 ? 'border-red-200 bg-red-50/40' : '' }}"><p class="text-2xl font-extrabold leading-none text-red-600">{{ $summary['overdue'] }}</p><p class="mt-1 text-xs text-ink-500">Not on Google after {{ $days }} days</p></div>
    <div class="card p-4 col-span-2 sm:col-span-1"><p class="text-2xl font-extrabold leading-none text-brand-700">{{ $inTargetRate === null ? '—' : "{$inTargetRate}%" }}</p><p class="mt-1 text-xs text-ink-500">Indexed within {{ $days }} days</p></div>
  </div>
  @if ($summary['queued'] > 0 || $summary['failing'] > 0)
    <p class="mb-4 text-xs text-ink-500">
      {{ $summary['queued'] }} page(s) queued to send to Google.
      @if ($summary['failing'] > 0)
        <span class="text-red-600">{{ $summary['failing'] }} failed on the last attempt — see the rows marked in red.</span>
      @endif
    </p>
  @endif

  <form method="GET" class="mb-4 flex flex-col gap-3 sm:flex-row">
    <input type="hidden" name="tab" value="SEO" />
    <div class="flex flex-1 items-center gap-2 rounded-lg border border-gray-300 bg-white px-3">
      <x-icon name="search" :size="16" class="text-gray-400" />
      <input name="search" value="{{ request('search') }}" placeholder="Search by business, city or URL…" class="w-full py-2.5 text-sm focus:outline-none" data-live-search />
    </div>
    <select name="stage" class="input sm:w-48" data-autosubmit>
      <option value="">All pages</option>
      @foreach ($stages as $value => [$label])
        <option value="{{ $value }}" @selected(request('stage') === $value)>{{ $label }}</option>
      @endforeach
    </select>
    <select name="kind" class="input sm:w-40" data-autosubmit>
      <option value="">Listings & websites</option>
      @foreach ($kinds as $value => $label)
        <option value="{{ $value }}" @selected(request('kind') === $value)>{{ $label }}</option>
      @endforeach
    </select>
    <button type="button" data-seo-run class="btn-primary whitespace-nowrap px-4 py-2.5"><x-icon name="refresh-cw" :size="16" /> Sync with Google</button>
  </form>

  @if ($seo === null)
    <p class="mb-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">Could not load the SEO report.</p>
  @endif

  <div class="card overflow-x-auto">
    <table class="w-full text-sm">
      <thead>
        <tr class="text-left text-xs uppercase tracking-wide text-ink-400 border-b border-gray-100">
          <th class="px-4 py-3 font-semibold">Page</th>
          <th class="px-4 py-3 font-semibold hidden md:table-cell">Live since</th>
          <th class="px-4 py-3 font-semibold hidden md:table-cell">Sent to Google</th>
          <th class="px-4 py-3 font-semibold">Google</th>
          <th class="px-4 py-3 font-semibold text-right">Actions</th>
        </tr>
      </thead>
      <tbody class="divide-y divide-gray-100">
        @forelse ($items as $row)
          @php
              [$stageLabel, $stageTint] = $stages[$row['stage']];
              $live = Carbon::parse($row['createdAt']);
              $took = $row['indexedAt'] ? (int) round($live->diffInHours(Carbon::parse($row['indexedAt']))) : null;
          @endphp
          <tr class="align-top">
            <td class="px-4 py-3 max-w-xs">
              <p class="font-semibold text-ink-900 truncate">{{ $row['business']['name'] ?? '—' }}
                <span class="ml-1 badge bg-gray-100 text-gray-600 !py-0">{{ $kinds[$row['kind']] ?? $row['kind'] }}</span>
              </p>
              <a href="{{ $row['url'] }}" target="_blank" rel="noopener" class="block truncate text-xs text-brand-700 hover:underline">{{ $row['url'] }}</a>
            </td>
            <td class="px-4 py-3 hidden md:table-cell whitespace-nowrap text-ink-600" title="{{ $live->toDayDateTimeString() }}">{{ $live->diffForHumans() }}</td>
            <td class="px-4 py-3 hidden md:table-cell text-ink-600">
              @if ($row['submitError'])
                <span class="text-xs text-red-600">{{ \Illuminate\Support\Str::limit($row['submitError'], 90) }}</span>
              @elseif ($row['submittedAt'])
                <span class="whitespace-nowrap">{{ Carbon::parse($row['submittedAt'])->diffForHumans() }}</span>
                @if ($row['submitCount'] > 1)<span class="text-xs text-ink-400">({{ $row['submitCount'] }}×)</span>@endif
              @else
                <span class="text-xs text-ink-400">{{ $row['needsSubmit'] ? 'Queued' : 'Not yet' }}</span>
              @endif
            </td>
            <td class="px-4 py-3">
              <span class="badge {{ $stageTint }}">{{ $stageLabel }}</span>
              @if ($took !== null)
                <p class="mt-1 text-xs text-ink-500">Took {{ $took < 48 ? "{$took}h" : round($took / 24, 1).' days' }}</p>
              @endif
              @if ($row['coverageState'] && $row['indexStatus'] !== 'INDEXED')
                <p class="mt-1 text-xs {{ $row['indexStatus'] === 'ERROR' ? 'text-red-600' : 'text-ink-500' }}">{{ $row['coverageState'] }}</p>
              @endif
              @if ($row['checkedAt'])
                <p class="mt-0.5 text-[11px] text-ink-400">Checked {{ Carbon::parse($row['checkedAt'])->diffForHumans() }}</p>
              @else
                <p class="mt-0.5 text-[11px] text-ink-400">Not checked yet</p>
              @endif
            </td>
            <td class="px-4 py-3 text-right whitespace-nowrap">
              @if ($connected)
                <button type="button" class="btn-ghost px-2 py-1 text-xs" data-seo-check="{{ $row['id'] }}" title="Ask Google whether this page is indexed"><x-icon name="search-check" :size="14" /> Check</button>
                <button type="button" class="btn-ghost px-2 py-1 text-xs" data-seo-submit="{{ $row['id'] }}" title="Ask Google to crawl this page now"><x-icon name="send" :size="14" /> Resubmit</button>
              @else
                <span class="text-xs text-ink-400">—</span>
              @endif
            </td>
          </tr>
        @empty
          <tr><td colspan="5" class="px-4 py-8 text-center text-ink-500">No pages yet. Published listings and websites appear here.</td></tr>
        @endforelse
      </tbody>
    </table>
  </div>
  <x-pager :page="$meta['page']" :total-pages="$meta['totalPages']" />
</div>
