@props(['title', 'subtitle'])
@php
    $highlights = [
        ['search-check', 'Search thousands of trusted local businesses'],
        ['calendar-check-2', 'Book services and appointments in real time'],
        ['shield-check', 'Read verified reviews before you decide'],
    ];
@endphp
<div class="max-w-4xl mx-auto py-4 sm:py-8">
  <div class="grid grid-cols-1 lg:grid-cols-2 rounded-2xl overflow-hidden shadow-card border border-gray-200 bg-white">
    {{-- Brand panel --}}
    <div class="relative hidden lg:flex flex-col justify-between p-8 bg-gradient-to-br from-brand-800 via-brand-700 to-brand-600 text-white overflow-hidden">
      <div class="absolute inset-0 opacity-10 pointer-events-none [background-image:radial-gradient(circle_at_20%_20%,white,transparent_35%),radial-gradient(circle_at_80%_75%,white,transparent_30%)]"></div>

      <a href="/" class="relative flex items-center gap-2">
        <span class="flex h-9 w-9 items-center justify-center rounded-lg bg-white/15 backdrop-blur-sm"><x-icon name="building-2" :size="20" stroke-width="2.25" /></span>
        <span class="text-xl font-extrabold tracking-tight">Markkito</span>
      </a>

      <div class="relative">
        <h2 class="text-2xl font-extrabold leading-snug">Everything local, in one place.</h2>
        <ul class="mt-6 space-y-3">
          @foreach ($highlights as [$icon, $text])
            <li class="flex items-start gap-3 text-sm text-brand-50/95">
              <span class="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-white/15"><x-icon :name="$icon" :size="15" /></span>
              <span class="pt-1">{{ $text }}</span>
            </li>
          @endforeach
        </ul>
      </div>

      <div class="relative rounded-xl bg-white/10 backdrop-blur-sm p-4">
        <div class="flex items-center gap-0.5 text-gold-400 mb-1.5">
          @for ($i = 0; $i < 5; $i++)
            <x-icon name="star" :size="13" fill="currentColor" stroke-width="0" />
          @endfor
        </div>
        <p class="text-sm text-brand-50/95 leading-relaxed">“Found and booked a great electrician in minutes. So much easier than searching around.”</p>
        <p class="text-xs text-brand-100/80 mt-2">— A happy Markkito customer</p>
      </div>
    </div>

    {{-- Form panel --}}
    <div class="p-6 sm:p-8 flex flex-col justify-center">
      <div class="lg:hidden flex items-center gap-2 mb-6">
        <span class="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-600 text-white"><x-icon name="building-2" :size="20" stroke-width="2.25" /></span>
        <span class="text-xl font-extrabold tracking-tight text-ink-900">Mark<span class="text-brand-600">kito</span></span>
      </div>

      <h1 class="text-2xl font-extrabold text-ink-900">{{ $title }}</h1>
      <p class="text-sm text-ink-500 mt-1 mb-6">{{ $subtitle }}</p>

      {{ $slot }}

      <div class="mt-5 text-sm text-ink-500 text-center">{{ $footer }}</div>
    </div>
  </div>
</div>
