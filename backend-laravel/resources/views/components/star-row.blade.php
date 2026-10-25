@props(['rating' => 0, 'size' => 16])
@php $filled = (int) round((float) $rating); @endphp
<span {{ $attributes->merge(['class' => 'inline-flex items-center gap-0.5 text-gold-400']) }}>
  @for ($i = 0; $i < 5; $i++)
    <x-icon name="star" :size="$size" :fill="$i < $filled ? 'currentColor' : 'none'" :stroke-width="$i < $filled ? 0 : 1.5" :class="$i < $filled ? 'text-gold-400' : 'text-gray-300'" />
  @endfor
</span>
