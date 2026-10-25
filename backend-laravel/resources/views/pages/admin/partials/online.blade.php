@if ($failed)
  <p class="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">Could not load who is online.</p>
@elseif (count($visitors) === 0)
  <p class="text-sm text-ink-500">No one online right now.</p>
@else
  <div class="divide-y divide-gray-100">
    @foreach ($visitors as $v)
      @php
          $deviceIcon = match ($v['device'] ?? null) {
              'Mobile' => 'smartphone',
              'Tablet' => 'tablet',
              'Desktop' => 'monitor',
              default => 'laptop',
          };
      @endphp
      <div class="flex flex-col gap-1 py-3 first:pt-0 last:pb-0 sm:flex-row sm:items-center sm:justify-between">
        <div class="min-w-0">
          <p class="truncate font-mono text-sm font-semibold text-ink-900">{{ $v['path'] }}</p>
          <div class="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-ink-500">
            <span class="flex items-center gap-1"><x-icon name="globe" :size="12" class="text-ink-400" /> {{ $v['location'] ?? 'Unknown location' }}</span>
            <span class="flex items-center gap-1"><x-icon :name="$deviceIcon" :size="14" class="text-ink-400" /> {{ $v['browser'] ?? 'Unknown' }} · {{ $v['device'] ?? 'Unknown' }}</span>
            @if (! empty($v['loggedIn']))
              <span class="flex items-center gap-1 text-brand-600"><x-icon name="user" :size="12" /> Signed in</span>
            @endif
          </div>
        </div>
        <div class="shrink-0 text-right text-xs text-ink-400">
          <p class="font-mono">{{ $v['ip'] }}</p>
          <p data-time-ago="{{ $v['lastSeenAt'] }}"></p>
        </div>
      </div>
    @endforeach
  </div>
@endif
