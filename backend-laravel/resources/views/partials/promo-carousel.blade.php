@php
    $slides = [
        ['title' => 'Discover trusted local businesses', 'subtitle' => 'Compare ratings, read reviews, and connect in minutes.', 'cta' => 'Explore now', 'to' => '/', 'seed' => 'storefront-street'],
        ['title' => 'Book services in a few taps', 'subtitle' => 'Real-time availability, instant confirmation.', 'cta' => 'Browse services', 'to' => '/', 'seed' => 'service-calendar'],
        ['title' => 'Grow your business with us', 'subtitle' => 'List your business and start receiving leads today.', 'cta' => 'List your business', 'to' => '/register', 'seed' => 'small-business-owner'],
    ];
    $tiles = [
        ['label' => 'B2B Directory', 'subtitle' => 'Find suppliers', 'icon' => 'briefcase', 'to' => '/b2b', 'class' => 'from-sky-900/90 via-sky-800/60', 'seed' => 'warehouse-logistics'],
        ['label' => 'Book a service', 'subtitle' => 'Instant scheduling', 'icon' => 'calendar-check-2', 'to' => '/', 'class' => 'from-violet-900/90 via-violet-800/60', 'seed' => 'technician-repair'],
        ['label' => 'Verified businesses', 'subtitle' => 'Ratings you can trust', 'icon' => 'shield-check', 'to' => '/', 'class' => 'from-amber-900/90 via-amber-800/60', 'seed' => 'modern-office-building'],
        ['label' => 'List your business', 'subtitle' => 'Reach new customers', 'icon' => 'store', 'to' => '/register', 'class' => 'from-brand-900/90 via-brand-800/60', 'seed' => 'shopkeeper-storefront'],
    ];
@endphp
<div class="grid grid-cols-2 sm:grid-cols-7 gap-3 mb-8">
  <a href="{{ $slides[0]['to'] }}" data-promo class="col-span-2 sm:col-span-3 relative overflow-hidden rounded-xl2 bg-brand-700 p-6 flex flex-col justify-between min-h-[160px] group">
    {{-- Crossfading, slowly-panning backgrounds --}}
    @foreach ($slides as $i => $s)
      <div aria-hidden="true" data-promo-bg class="absolute inset-0 transition-opacity duration-1000 ease-in-out {{ $i === 0 ? 'opacity-100' : 'opacity-0' }}">
        <img src="https://picsum.photos/seed/{{ $s['seed'] }}/500/300" alt="" loading="lazy" data-on-error="hide" class="absolute inset-0 h-full w-full object-cover animate-kenburns" />
      </div>
    @endforeach
    <div class="absolute inset-0 bg-gradient-to-r from-brand-900/90 via-brand-800/50 to-transparent"></div>

    @foreach ($slides as $i => $s)
      <div data-promo-text data-to="{{ $s['to'] }}" class="relative animate-slide-fade-up" @if ($i !== 0) hidden @endif>
        <h3 class="text-white text-xl font-extrabold leading-snug max-w-xs drop-shadow-sm">{{ $s['title'] }}</h3>
        <p class="text-white/85 text-sm mt-1.5 max-w-xs drop-shadow-sm">{{ $s['subtitle'] }}</p>
        <span class="mt-3 inline-flex items-center gap-1.5 text-sm font-semibold bg-white text-brand-700 rounded-lg px-3.5 py-2 w-fit group-hover:gap-2.5 transition-all">
          {{ $s['cta'] }} <x-icon name="arrow-right" :size="15" />
        </span>
      </div>
    @endforeach

    <div class="relative flex gap-1.5 mt-3">
      @foreach ($slides as $i => $s)
        <button type="button" data-promo-dot="{{ $i }}" aria-label="Go to slide {{ $i + 1 }}" class="h-1.5 rounded-full transition-all {{ $i === 0 ? 'w-5 bg-white' : 'w-1.5 bg-white/50 hover:bg-white/80' }}"></button>
      @endforeach
    </div>
  </a>

  @foreach ($tiles as $tile)
    <a href="{{ $tile['to'] }}" class="relative overflow-hidden rounded-xl2 bg-ink-900 p-4 flex flex-col justify-between min-h-[160px] group">
      <img src="https://picsum.photos/seed/{{ $tile['seed'] }}/500/300" alt="{{ $tile['label'] }}" loading="lazy" data-on-error="hide" class="absolute inset-0 h-full w-full object-cover transition-transform duration-500 group-hover:scale-110" />
      <div class="absolute inset-0 bg-gradient-to-t {{ $tile['class'] }} to-transparent"></div>
      <span class="relative flex h-9 w-9 items-center justify-center rounded-lg bg-white/20 text-white backdrop-blur-sm"><x-icon :name="$tile['icon']" :size="18" /></span>
      <div class="relative">
        <p class="text-white font-bold text-sm leading-tight drop-shadow-sm">{{ $tile['label'] }}</p>
        <p class="text-white/85 text-xs mt-0.5 drop-shadow-sm">{{ $tile['subtitle'] }}</p>
      </div>
      <x-icon name="chevron-right" :size="16" class="relative self-end text-white/80 group-hover:translate-x-0.5 transition-transform" />
    </a>
  @endforeach
</div>
