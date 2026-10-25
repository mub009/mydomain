@php
    use App\Http\Controllers\Web\AdminPageController as A;
@endphp
{{-- Who registered listings, and how many. --}}
@if (! $report)
  <p class="text-sm text-red-700 bg-red-50 rounded-md px-3 py-2">Could not load the report.</p>
@else
  @php
      $rows = $report['items'];
      $totalPages = max(1, (int) ceil(count($rows) / A::REPORT_PAGE_SIZE));
      $pageItems = array_slice($rows, ($page - 1) * A::REPORT_PAGE_SIZE, A::REPORT_PAGE_SIZE);
  @endphp
  <div>
    <div class="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
      <div class="card p-4"><p class="text-2xl font-extrabold text-ink-900 leading-none">{{ $report['totalBusinesses'] }}</p><p class="text-xs text-ink-500 mt-1">Total businesses</p></div>
      <div class="card p-4"><p class="text-2xl font-extrabold text-violet-700 leading-none">{{ $report['dealerBusinessCount'] }}</p><p class="text-xs text-ink-500 mt-1">Registered by dealers</p></div>
      <div class="card p-4 border-brand-200 bg-brand-50/40"><p class="text-2xl font-extrabold text-brand-700 leading-none">{{ $report['registeredToday'] }}</p><p class="text-xs text-ink-500 mt-1">Registered today</p></div>
      <div class="card p-4"><p class="text-2xl font-extrabold text-ink-900 leading-none">{{ count($rows) }}</p><p class="text-xs text-ink-500 mt-1">Active dealers/admins</p></div>
    </div>

    <h3 class="font-bold text-ink-900 mb-3">Businesses registered by dealers</h3>
    <div class="card overflow-x-auto">
      <table class="w-full text-sm">
        <thead>
          <tr class="text-left text-xs uppercase tracking-wide text-ink-400 border-b border-gray-100">
            <th class="px-4 py-3 font-semibold">Created by</th>
            <th class="px-4 py-3 font-semibold hidden sm:table-cell">Role</th>
            <th class="px-4 py-3 font-semibold text-right">Businesses</th>
            <th class="px-4 py-3 font-semibold text-right">Today</th>
            <th class="px-4 py-3 font-semibold text-right hidden sm:table-cell">Published</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-gray-100">
          @foreach ($pageItems as $row)
            <tr>
              <td class="px-4 py-3">
                @if ($row['creator'])
                  <div class="min-w-0">
                    <p class="font-semibold text-ink-900 truncate">{{ $row['creator']['firstName'] }} {{ $row['creator']['lastName'] }}</p>
                    <p class="text-xs text-ink-500 truncate">{{ $row['creator']['email'] ?? $row['creator']['phone'] ?? '' }}</p>
                  </div>
                @else
                  <span class="text-ink-400">Unknown / removed user</span>
                @endif
              </td>
              <td class="px-4 py-3 hidden sm:table-cell">
                @if ($row['creator'])
                  <span class="badge {{ A::roleBadge($row['creator']['role']) }}">{{ A::label($row['creator']['role']) }}</span>
                @endif
              </td>
              <td class="px-4 py-3 text-right font-bold text-ink-900">{{ $row['businessCount'] }}</td>
              <td class="px-4 py-3 text-right font-semibold text-brand-700">{{ $row['todayCount'] > 0 ? "+{$row['todayCount']}" : '—' }}</td>
              <td class="px-4 py-3 text-right text-emerald-700 hidden sm:table-cell">{{ $row['publishedCount'] }}</td>
            </tr>
          @endforeach
          @if (count($rows) === 0)
            <tr><td colspan="5" class="px-4 py-8 text-center text-ink-500">No dealer-registered businesses yet.</td></tr>
          @endif
        </tbody>
      </table>
    </div>
    <x-pager :page="min($page, $totalPages)" :total-pages="$totalPages" />
  </div>
@endif
