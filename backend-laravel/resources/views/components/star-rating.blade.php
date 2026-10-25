@props(['rating' => 0, 'count' => null, 'size' => 'md'])
@php
    $value = (float) $rating;
    $color = $value >= 4 ? 'bg-emerald-600' : ($value >= 3 ? 'bg-amber-500' : ($value > 0 ? 'bg-red-500' : 'bg-gray-400'));
    $pad = $size === 'sm' ? 'px-1.5 py-0.5 text-[11px]' : 'px-2 py-1 text-xs';
@endphp
<span {{ $attributes->merge(['class' => 'inline-flex items-center gap-1.5']) }}>
  <span class="badge text-white {{ $pad }} {{ $color }}">
    {{ number_format($value, 1) }}
    <x-icon name="star" :size="$size === 'sm' ? 11 : 13" fill="currentColor" stroke-width="0" />
  </span>
  @if ($count !== null)
    <span class="text-xs text-ink-500">({{ $count }})</span>
  @endif
</span>
