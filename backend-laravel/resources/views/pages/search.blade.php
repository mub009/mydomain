@extends('layouts.app')

@section('title', $heading)

@php
    use App\Http\Controllers\Web\SearchPageController as S;
    $selectClass = 'rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-semibold text-ink-700 focus:border-brand-500 focus:outline-none';
@endphp

@section('content')
  {{-- Breadcrumbs --}}
  <nav class="mb-2 flex flex-wrap items-center gap-1 text-xs text-ink-500">
    <a href="/" class="hover:text-brand-600">Home</a>
    @if ($city || $geo)
      <x-icon name="chevron-right" :size="12" class="text-ink-300" />
      <span>{{ $locationLabel }}</span>
    @endif
    @if ($category)
      <x-icon name="chevron-right" :size="12" class="text-ink-300" />
      <span class="text-ink-700">{{ $category['name'] }}{{ $city ? " in {$city}" : '' }}</span>
    @endif
    @if ($meta['total'] > 0)
      <x-icon name="chevron-right" :size="12" class="text-ink-300" />
      <span class="font-semibold text-brand-700">{{ $meta['total'] }}+ Listings</span>
    @endif
  </nav>

  <h1 class="text-xl font-extrabold text-ink-900 sm:text-2xl">{{ $heading }}</h1>

  {{-- Active filters — the location narrowing results must never be invisible --}}
  @if ($geo || $city || $filters['minRating'] || $filters['businessType'])
    <div class="mt-2 flex flex-wrap items-center gap-2">
      <span class="text-xs text-ink-500">Filtered by:</span>
      @if ($filters['businessType'])
        <a href="{{ S::urlWith(['businessType' => null]) }}" class="badge bg-violet-50 text-violet-700 hover:bg-violet-100">
          <x-icon name="briefcase" :size="11" /> {{ $filters['businessType'] === 'B2B' ? 'B2B businesses' : 'B2C businesses' }} <x-icon name="x" :size="11" />
        </a>
      @endif
      @if ($geo)
        <button type="button" data-clear-location class="badge bg-brand-50 text-brand-700 hover:bg-brand-100" title="Show results everywhere">
          <x-icon name="map-pin" :size="11" /> Within {{ $filters['radiusKm'] }} km of you <x-icon name="x" :size="11" />
        </button>
      @endif
      @if ($city)
        <button type="button" data-clear-location class="badge bg-brand-50 text-brand-700 hover:bg-brand-100" title="Show results everywhere">
          <x-icon name="map-pin" :size="11" /> {{ $city }} <x-icon name="x" :size="11" />
        </button>
      @endif
      @if ($filters['minRating'])
        <a href="{{ S::urlWith(['minRating' => null]) }}" class="badge bg-brand-50 text-brand-700 hover:bg-brand-100">
          {{ $filters['minRating'] }}★ &amp; above <x-icon name="x" :size="11" />
        </a>
      @endif
    </div>
  @endif

  {{-- Filter bar: each select reloads the page with the new value --}}
  <form method="GET" action="/search" class="mt-3 flex flex-wrap items-center gap-2" data-filters>
    @if ($filters['q'])
      <input type="hidden" name="q" value="{{ $filters['q'] }}" />
    @endif
    <select name="sort" class="{{ $selectClass }}">
      @foreach (S::SORT_OPTIONS as $value => $label)
        <option value="{{ $value }}" @selected($filters['sort'] === $value)>{{ $label }}</option>
      @endforeach
    </select>
    <select name="minRating" class="{{ $selectClass }}">
      @foreach (S::RATING_OPTIONS as $value => $label)
        <option value="{{ $value }}" @selected($filters['minRating'] === (string) $value)>{{ $label }}</option>
      @endforeach
    </select>
    <select name="category" class="{{ $selectClass }}">
      <option value="">All categories</option>
      @foreach ($categories as $c)
        <option value="{{ $c['slug'] }}" @selected($filters['category'] === $c['slug'])>{{ $c['name'] }}</option>
      @endforeach
    </select>
    <select name="businessType" class="{{ $selectClass }}">
      @foreach (S::BUSINESS_TYPE_OPTIONS as $value => $label)
        <option value="{{ $value }}" @selected($filters['businessType'] === (string) $value)>{{ $label }}</option>
      @endforeach
    </select>
    @if ($geo)
      <select name="radiusKm" class="{{ $selectClass }}">
        @foreach (S::RADIUS_OPTIONS as $km)
          <option value="{{ $km }}" @selected($filters['radiusKm'] === $km)>Within {{ $km }} km</option>
        @endforeach
      </select>
    @endif
    <button type="button" data-toggle-location class="inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-sm font-semibold transition-colors border-gray-300 bg-white text-ink-700 hover:bg-gray-50">
      <x-icon name="sliders-horizontal" :size="14" /> Change location
    </button>
  </form>

  <div class="card mt-3 p-4" data-location-panel hidden>
    <label class="mb-1.5 block text-xs font-semibold text-ink-700">Search in</label>
    <x-location-input :value="$city" />
    @if ($geo)
      <button type="button" data-clear-location class="mt-2 text-xs font-semibold text-brand-600 hover:underline">Clear “near me” and search by city instead</button>
    @endif
  </div>

  {{-- Results --}}
  <div class="mt-5">
    @if ($error)
      <p class="mb-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{{ $error }}</p>
    @endif

    <div class="space-y-3">
      @forelse ($results as $i => $b)
        @php
            $signal = S::signalBadge($b, $i);
            $area = $b['addressLine1'] ? explode(',', $b['addressLine1'])[0] : $b['city'];
            $whatsapp = 'https://wa.me/'.preg_replace('/[^0-9]/', '', $b['phone'] ?? '');
            $photo = $b['photoUrl'] ?? $b['logoUrl'];
        @endphp
        <div class="card group overflow-hidden">
          <div class="flex flex-col sm:flex-row">
            <a href="/business/{{ $b['slug'] }}" class="relative h-44 w-full shrink-0 overflow-hidden sm:h-auto sm:w-44 md:w-52">
              @if ($photo)
                <img src="{{ $photo }}" alt="{{ $b['name'] }}" loading="lazy" data-on-error="fallback" class="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105" />
              @endif
              <div class="flex h-full w-full items-center justify-center bg-brand-50 text-brand-300" @if ($photo) hidden @endif><x-icon name="image" :size="26" /></div>
            </a>

            <div class="min-w-0 flex-1 p-4">
              <div class="flex items-start justify-between gap-3">
                <a href="/business/{{ $b['slug'] }}" class="min-w-0">
                  <h3 class="truncate text-lg font-bold text-ink-900 transition-colors group-hover:text-brand-600">{{ $b['name'] }}</h3>
                </a>
                <div class="flex shrink-0 items-center gap-1.5">
                  @if (($b['businessType'] ?? null) === 'B2B')
                    <span class="badge bg-violet-50 text-violet-700"><x-icon name="briefcase" :size="11" /> B2B</span>
                  @endif
                  @if ($b['isVerified'])
                    <span class="badge bg-emerald-50 text-emerald-700"><x-icon name="shield-check" :size="11" /> Verified</span>
                  @endif
                </div>
              </div>

              <div class="mt-1.5 flex flex-wrap items-center gap-2">
                <span class="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-xs font-bold text-white {{ S::ratingTint($b['avgRating']) }}">
                  {{ $b['avgRating'] > 0 ? number_format($b['avgRating'], 1) : 'New' }}
                  <x-icon name="star" :size="10" class="fill-current" />
                </span>
                <span class="text-xs text-ink-500">{{ $b['reviewCount'] }} {{ $b['reviewCount'] === 1 ? 'Rating' : 'Ratings' }}</span>
                @if ($signal)
                  <span class="badge {{ $signal['tint'] }}"><x-icon :name="$signal['icon']" :size="10" /> {{ $signal['label'] }}</span>
                @endif
              </div>

              <p class="mt-1.5 flex items-center gap-1 text-sm text-ink-600">
                <x-icon name="map-pin" :size="13" class="shrink-0 text-ink-400" />
                <span class="truncate">{{ $area }}, {{ $b['city'] }}</span>
                @if ($b['distanceKm'] !== null)
                  <span class="shrink-0 text-ink-400">· {{ number_format($b['distanceKm'], 1) }} km</span>
                @endif
              </p>

              <div class="mt-2 flex flex-wrap gap-1.5">
                <span class="badge bg-gray-100 text-gray-600">{{ $b['categoryName'] }}</span>
                @if ($b['city'])
                  <span class="badge bg-gray-100 text-gray-600">{{ $b['city'] }}</span>
                @endif
              </div>

              <div class="mt-3 flex flex-wrap gap-2">
                <button type="button" data-show-number="{{ $b['phone'] }}" class="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-2 text-sm font-semibold text-white transition-colors hover:bg-emerald-700">
                  <x-icon name="phone" :size="14" /> <span>Show Number</span>
                </button>
                <a href="{{ $whatsapp }}" target="_blank" rel="noreferrer" class="inline-flex items-center gap-1.5 rounded-lg border border-emerald-200 bg-white px-3 py-2 text-sm font-semibold text-emerald-700 transition-colors hover:bg-emerald-50">
                  <x-icon name="message-square" :size="14" /> WhatsApp
                </a>
                <button type="button" data-enquiry="{{ $b['id'] }}" data-enquiry-name="{{ $b['name'] }}" class="inline-flex items-center gap-1.5 rounded-lg bg-sky-600 px-3 py-2 text-sm font-semibold text-white transition-colors hover:bg-sky-700">
                  <x-icon name="message-square" :size="14" /> Send Enquiry
                </button>
              </div>
            </div>
          </div>
        </div>
      @empty
        <div class="card py-14 text-center text-ink-500">
          <x-icon name="search" :size="30" class="mx-auto mb-3 text-gray-300" />
          <p class="font-semibold text-ink-700">
            No {{ $category ? mb_strtolower($category['name']) : 'businesses' }} found{{ $geo ? " within {$filters['radiusKm']} km of you" : ($city ? " in {$city}" : '') }}
          </p>

          {{-- The location filter is the usual reason, so lead with clearing it. --}}
          @if ($geo || $city)
            <p class="mx-auto mt-1 max-w-md text-sm">
              {{ $geo ? 'Your saved location is limiting these results.' : "Only listings in {$city} are being shown." }}
            </p>
            <div class="mt-4 flex flex-wrap justify-center gap-2">
              <button type="button" data-clear-location class="btn-primary px-4 py-2.5 text-sm">Search everywhere</button>
              @if ($geo && (int) $filters['radiusKm'] < 100)
                <a href="{{ S::urlWith(['radiusKm' => 100]) }}" class="btn-secondary px-4 py-2.5 text-sm">Widen to 100 km</a>
              @endif
            </div>
          @else
            <p class="mt-1 text-sm">
              Try a different category{{ $filters['q'] ? ' or search term' : '' }}.
              @if ($filters['q'])
                <a href="{{ S::urlWith(['q' => null]) }}" class="ml-1 font-semibold text-brand-600 hover:underline">Clear “{{ $filters['q'] }}”</a>
              @endif
            </p>
          @endif
        </div>
      @endforelse
    </div>

    <x-pager :page="$meta['page']" :total-pages="$meta['totalPages']" />
  </div>
@endsection

@push('scripts')
  @vite('resources/js/pages/search.js')
@endpush
