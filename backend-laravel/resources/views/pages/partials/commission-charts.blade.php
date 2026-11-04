{{-- Commission charts: collected, commission and received per day, week or
     month (App\Support\Commission::timeline), drawn by
     resources/js/lib/commission-charts.js. $timeline is required. --}}
<div class="card p-5" data-commission-charts>
  <div class="flex flex-wrap items-start justify-between gap-3">
    <div>
      <h2 class="font-semibold text-ink-900">{{ $chartTitle ?? 'Commission over time' }}</h2>
      <p class="text-xs text-ink-500"><span data-range>Last 12 months</span> · hover a bar for the amounts</p>
    </div>
    <div class="inline-flex rounded-lg bg-gray-100 p-0.5" role="group" aria-label="Period">
      <button type="button" data-period="daily">Daily</button>
      <button type="button" data-period="weekly">Weekly</button>
      <button type="button" data-period="monthly">Monthly</button>
    </div>
  </div>

  {{-- The period's totals. --}}
  <dl class="mt-4 grid grid-cols-3 gap-3">
    @foreach (['collected' => ['Collected', '#2a78d6'], 'commission' => ['Commission', '#eb6834'], 'received' => ['Received', '#1baf7a']] as $key => [$label, $color])
      <div class="rounded-xl bg-gray-50 px-3 py-2.5">
        <dt class="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-ink-500"><span class="h-2.5 w-2.5 rounded-sm" style="background:{{ $color }}"></span>{{ $label }}</dt>
        <dd class="mt-0.5 text-lg font-bold tabular-nums text-ink-900" data-total="{{ $key }}">—</dd>
      </div>
    @endforeach
  </dl>

  <div class="mt-5 grid gap-6 xl:grid-cols-2">
    <div data-chart="collected">
      <p class="mb-2 text-sm font-semibold text-ink-900">{{ $collectedTitle ?? 'Collected' }}</p>
      <div class="relative">
        <div data-plot class="w-full"></div>
        <div data-tooltip hidden class="pointer-events-none absolute z-10 min-w-[10rem] rounded-lg border border-gray-200 bg-white px-3 py-2 shadow-lg"></div>
      </div>
    </div>
    <div data-chart="commission,received">
      <div class="mb-2 flex flex-wrap items-center justify-between gap-2">
        <p class="text-sm font-semibold text-ink-900">Commission and received</p>
        <p class="flex items-center gap-3 text-xs text-ink-500">
          <span class="flex items-center gap-1.5"><span class="h-2.5 w-2.5 rounded-sm" style="background:#eb6834"></span>Commission</span>
          <span class="flex items-center gap-1.5"><span class="h-2.5 w-2.5 rounded-sm" style="background:#1baf7a"></span>Received</span>
        </p>
      </div>
      <div class="relative">
        <div data-plot class="w-full"></div>
        <div data-tooltip hidden class="pointer-events-none absolute z-10 min-w-[10rem] rounded-lg border border-gray-200 bg-white px-3 py-2 shadow-lg"></div>
      </div>
    </div>
  </div>

  <details class="mt-4">
    <summary class="cursor-pointer text-xs font-semibold text-brand-700">Show as a table</summary>
    <div class="mt-2 overflow-x-auto" data-table></div>
  </details>
  <script type="application/json">@json($timeline)</script>
</div>
