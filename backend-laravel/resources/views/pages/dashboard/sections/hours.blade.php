@php
    // Every day of the week, from what's saved or a 9–6 default (closed Sunday).
    $saved = collect($biz['hours'] ?? [])->keyBy('dayOfWeek');
    $hours = collect(range(0, 6))->map(fn ($day) => $saved->has($day)
        ? ['dayOfWeek' => $day, 'openTime' => $saved[$day]['openTime'], 'closeTime' => $saved[$day]['closeTime'], 'isClosed' => (bool) $saved[$day]['isClosed']]
        : ['dayOfWeek' => $day, 'openTime' => '09:00', 'closeTime' => '18:00', 'isClosed' => $day === 0]);
    $days = \App\Http\Controllers\Web\BusinessPageController::DAY_NAMES;
@endphp
<form class="card p-5 space-y-3" data-hours-form>
  <h3 class="font-bold text-ink-900 flex items-center gap-1.5"><x-icon name="clock" :size="16" class="text-brand-600" /> Opening hours</h3>
  <div class="divide-y divide-gray-100">
    @foreach ($hours as $h)
      <div class="flex flex-col gap-2 py-3 first:pt-0 last:pb-0 sm:flex-row sm:items-center sm:gap-3" data-day="{{ $h['dayOfWeek'] }}">
        <span class="w-24 shrink-0 text-sm font-medium text-ink-800">{{ $days[$h['dayOfWeek']] }}</span>
        <div class="flex flex-wrap items-center gap-3">
          <label class="flex items-center gap-1.5 text-sm text-ink-600">
            <input type="checkbox" class="h-4 w-4 accent-brand-600" data-closed @checked($h['isClosed']) /> Closed
          </label>
          <div class="flex items-center gap-2" data-times @if ($h['isClosed']) hidden @endif>
            <input type="time" value="{{ $h['openTime'] }}" data-open class="input !w-32 !py-1.5" />
            <span class="text-ink-400">–</span>
            <input type="time" value="{{ $h['closeTime'] }}" data-close class="input !w-32 !py-1.5" />
          </div>
        </div>
      </div>
    @endforeach
  </div>
  <button class="btn-primary px-5 py-2.5" data-save>Save hours</button>
</form>
