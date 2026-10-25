@props(['name', 'size' => 24, 'strokeWidth' => 2, 'fill' => 'none'])
@php
    static $icons = null;
    $icons ??= require resource_path('icons/lucide.php');
@endphp
<svg xmlns="http://www.w3.org/2000/svg" width="{{ $size }}" height="{{ $size }}" viewBox="0 0 24 24" fill="{{ $fill }}" stroke="currentColor" stroke-width="{{ $strokeWidth }}" stroke-linecap="round" stroke-linejoin="round" {{ $attributes->merge(['aria-hidden' => 'true']) }}>{!! $icons[$name] ?? '' !!}</svg>
