@extends('layouts.app')

@section('content')
  {{-- Search hero --}}
  <section class="mb-7">
    <h1 class="text-2xl sm:text-[28px] font-extrabold text-ink-900 mb-4">
      Search across local <span class="text-brand-600">Products &amp; Services</span>
    </h1>
    <form action="/search" method="GET" class="flex flex-col sm:flex-row gap-2.5" data-home-search>
      <x-location-input :value="$city" class="sm:w-64" />
      <div class="flex items-center gap-2 h-[52px] rounded-lg border border-gray-300 bg-white pl-3.5 pr-1.5 flex-1 focus-within:ring-2 focus-within:ring-brand-500/40 focus-within:border-brand-500">
        <x-icon name="search" :size="18" class="text-gray-400 shrink-0" />
        <input name="q" data-search-field placeholder="{{ $placeholderTerms->isNotEmpty() ? 'Search for '.$placeholderTerms[0].'…' : 'Search for restaurants, plumbers, salons…' }}" class="w-full text-sm text-ink-900 placeholder:text-gray-400 focus:outline-none" />
        <button type="submit" class="btn-primary h-10 px-5 shrink-0">
          <x-icon name="search" :size="15" />
          <span class="hidden sm:inline">Search</span>
        </button>
      </div>
    </form>
  </section>

  @include('partials.promo-carousel')

  {{-- Category icon grid --}}
  @if (count($categories) > 0)
    <section class="mb-8">
      <div class="grid grid-cols-3 sm:grid-cols-5 lg:grid-cols-8 gap-3">
        @foreach ($categories as $c)
          @php $look = \App\Support\CategoryIcons::for($c['name']); @endphp
          <a href="/search?category={{ urlencode($c['slug']) }}" class="flex flex-col items-center gap-2 group">
            <span class="flex h-14 w-14 items-center justify-center rounded-2xl border transition-all border-gray-200 group-hover:border-brand-300 {{ $look['tint'] }}">
              <x-icon :name="$look['icon']" :size="24" />
            </span>
            <span class="text-xs font-medium text-center leading-tight text-ink-700">{{ $c['name'] }}</span>
          </a>
        @endforeach
      </div>
    </section>
  @endif

  {{-- Curated subcategory showcase --}}
  <section class="mb-8">
    <h2 class="text-lg font-bold text-ink-900 mb-3">Explore popular services</h2>
    <div class="grid grid-cols-1 lg:grid-cols-2 gap-4">
      @foreach (\App\Support\CategoryIcons::SHOWCASE as $group)
        <div class="card p-5">
          <h3 class="font-bold text-ink-900 mb-3">{{ $group['title'] }}</h3>
          <div class="grid grid-cols-3 gap-3">
            @foreach ($group['items'] as $item)
              @php $look = \App\Support\CategoryIcons::for($item['label']); @endphp
              <a href="/search?q={{ urlencode($item['query']) }}" class="text-left group">
                <div class="aspect-[4/3] w-full rounded-lg overflow-hidden bg-gray-100 relative">
                  <img src="https://picsum.photos/seed/{{ $item['seed'] }}/300/220" alt="{{ $item['label'] }}" loading="lazy" data-on-error="fallback" class="h-full w-full object-cover group-hover:scale-105 transition-transform duration-200" />
                  <div class="h-full w-full flex items-center justify-center {{ $look['tint'] }}" hidden><x-icon :name="$look['icon']" :size="28" /></div>
                </div>
                <p class="text-sm font-medium text-ink-800 mt-2 group-hover:text-brand-600 transition-colors">{{ $item['label'] }}</p>
              </a>
            @endforeach
          </div>
        </div>
      @endforeach
    </div>
  </section>

  {{-- Results --}}
  <section id="results">
    <div class="flex items-center justify-between mb-4">
      <h2 class="text-lg font-bold text-ink-900 flex items-center gap-1.5">
        <x-icon name="trending-up" :size="18" class="text-brand-600" />
        {{ $geo ? 'Businesses near you' : 'Top rated businesses' }}
      </h2>
      @if ($meta['total'] > 0)
        <span class="text-sm text-ink-500">{{ $meta['total'] }} results</span>
      @endif
    </div>

    @if ($error)
      <p class="text-red-600 mb-4">{{ $error }}</p>
    @endif

    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      @forelse ($results as $b)
        <a href="/business/{{ $b['slug'] }}" class="card group p-4 hover:shadow-card-hover hover:-translate-y-0.5 transition-all">
          <div class="flex items-start justify-between gap-2 mb-2">
            <span class="badge bg-brand-50 text-brand-700">{{ $b['categoryName'] }}</span>
            @if ($b['isVerified'])
              <span title="Verified" class="text-emerald-600"><x-icon name="shield-check" :size="16" /></span>
            @endif
          </div>
          <h3 class="font-bold text-base text-ink-900 group-hover:text-brand-600 transition-colors">{{ $b['name'] }}</h3>
          <p class="text-sm text-ink-500 mb-3 flex items-center gap-1">
            <x-icon name="map-pin" :size="13" />
            {{ $b['city'] }}, {{ $b['state'] }}
            @if ($b['distanceKm'] !== null)
              <span class="text-ink-400">· {{ number_format($b['distanceKm'], 1) }} km away</span>
            @endif
          </p>
          <x-star-rating :rating="$b['avgRating']" :count="$b['reviewCount']" />
        </a>
      @empty
        <div class="col-span-full text-center py-16 text-ink-500">
          <x-icon name="search" :size="32" class="mx-auto mb-3 text-gray-300" />
          No businesses found. Try a different search.
        </div>
      @endforelse
    </div>
    <x-pager :page="$meta['page']" :total-pages="$meta['totalPages']" fragment="results" />
  </section>

  <script type="application/json" id="home-data">@json(['placeholderTerms' => $placeholderTerms])</script>
@endsection

@push('scripts')
  @vite('resources/js/pages/home.js')
@endpush
