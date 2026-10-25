@extends('layouts.app')

@section('title', \App\Support\Seo\SeoMeta::title($biz))
@section('description', \App\Support\Seo\SeoMeta::description($biz))

@push('head')
  @include('partials.seo-tags', ['url' => \App\Support\Seo\SeoTracker::listingUrl($biz['slug'])])
@endpush

@php
    use App\Http\Controllers\Web\BusinessPageController as P;
    $photos = $biz['photos'] ?? [];
    $services = $biz['services'] ?? [];
    $hours = $biz['hours'] ?? [];
    $category = $biz['category'] ?? null;
    $directionsUrl = "https://www.google.com/maps/dir/?api=1&destination={$biz['latitude']},{$biz['longitude']}";
    $whatsappUrl = 'https://wa.me/'.preg_replace('/[^0-9]/', '', $biz['phone'] ?? '');
    $show = fn (string ...$tabs) => in_array($tab, $tabs, true);
@endphp

@section('content')
  <div class="space-y-4" data-business-page>
    {{-- Breadcrumbs --}}
    <nav class="flex items-center gap-1.5 text-xs text-ink-500 flex-wrap">
      <a href="/" class="hover:text-brand-600">{{ $biz['city'] }}</a>
      <x-icon name="chevron-right" :size="12" />
      @if ($category)
        <a href="/search?category={{ urlencode($category['slug']) }}" class="hover:text-brand-600">{{ $category['name'] }} in {{ $biz['city'] }}</a>
        <x-icon name="chevron-right" :size="12" />
      @endif
      <span class="text-ink-700 font-medium">{{ $biz['name'] }}</span>
    </nav>

    {{-- Photo hero: one large lead image + a 2x2 grid --}}
    @if (count($photos) > 0)
      @php $rest = array_slice($photos, 1, 4); @endphp
      <div class="grid grid-cols-1 sm:grid-cols-2 gap-2 rounded-2xl overflow-hidden h-64 sm:h-80">
        <button type="button" data-tab-link="Photos" class="relative group h-full bg-gray-100">
          @include('partials.photo', ['url' => $photos[0]['url'], 'alt' => $photos[0]['caption'] ?? $biz['name']])
          <span class="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors"></span>
        </button>
        @if (count($rest) > 0)
          <div class="hidden sm:grid grid-cols-2 grid-rows-2 gap-2">
            @foreach ($rest as $i => $p)
              <button type="button" data-tab-link="Photos" class="relative group bg-gray-100 overflow-hidden">
                @include('partials.photo', ['url' => $p['url'], 'alt' => $p['caption'] ?? $biz['name']])
                <span class="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors"></span>
                @if ($i === count($rest) - 1 && count($photos) > 5)
                  <span class="absolute inset-0 flex items-center justify-center bg-black/45 text-white text-sm font-semibold">+{{ count($photos) - 5 }} more</span>
                @endif
              </button>
            @endforeach
          </div>
        @endif
      </div>
    @endif

    {{-- Header card --}}
    <div class="card p-5">
      <div class="flex flex-col sm:flex-row sm:items-start gap-4 justify-between">
        <div class="flex items-start gap-4 min-w-0">
          <div class="flex h-16 w-16 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-600 border border-brand-100 shadow-sm overflow-hidden">
            @if (! empty($biz['logoUrl']))
              <img src="{{ $biz['logoUrl'] }}" alt="{{ $biz['name'] }}" class="h-full w-full object-cover" />
            @else
              <x-icon name="building-2" :size="28" />
            @endif
          </div>
          <div class="min-w-0">
            <h1 class="text-2xl sm:text-3xl font-extrabold text-ink-900">{{ $biz['name'] }}</h1>
            <div class="flex items-center gap-2 mt-1.5 flex-wrap">
              <x-star-rating :rating="$biz['avgRating']" :count="$biz['reviewCount']" />
              @if (($biz['businessType'] ?? null) === 'B2B')
                <span class="badge bg-violet-50 text-violet-700"><x-icon name="briefcase" :size="12" /> B2B Supplier</span>
              @endif
              @if (! empty($biz['isVerified']))
                <span class="badge bg-emerald-50 text-emerald-700"><x-icon name="shield-check" :size="12" /> Verified</span>
              @endif
              {{-- Filled in by the page script from the visitor's own clock. --}}
              <span class="badge" data-open-badge hidden><span class="h-1.5 w-1.5 rounded-full"></span><span data-open-label></span></span>
            </div>
            <p class="text-ink-500 mt-1.5 flex items-center gap-1 text-sm">
              <x-icon name="map-pin" :size="14" /> {{ ! empty($biz['addressLine1']) ? "{$biz['addressLine1']}, " : '' }}{{ $biz['city'] }}, {{ $biz['state'] }}
            </p>
            <p class="text-xs mt-1 flex items-center gap-1 text-ink-500" data-open-detail hidden><x-icon name="clock" :size="12" /> <span></span></p>
          </div>
        </div>

        <div class="flex items-start gap-2 shrink-0">
          @if ($category)
            <span class="badge bg-gray-100 text-ink-700">{{ $category['name'] }}</span>
          @endif
          <button type="button" data-bookmark title="Save" class="flex h-8 w-8 items-center justify-center rounded-lg border transition-colors border-gray-300 text-ink-500 hover:bg-gray-50">
            <x-icon name="bookmark" :size="16" />
          </button>
        </div>
      </div>

      <div class="flex flex-wrap items-center gap-2 mt-4">
        <button type="button" data-show-number class="btn-primary px-4 py-2.5"><x-icon name="phone" :size="16" /> <span>Show Number</span></button>
        <a href="{{ $whatsappUrl }}" target="_blank" rel="noreferrer" class="btn-secondary px-4 py-2.5 !text-emerald-700 !border-emerald-300"><x-icon name="message-square" :size="16" /> WhatsApp</a>
        <button type="button" data-share class="btn-secondary px-3 py-2.5" title="Share"><x-icon name="share-2" :size="16" /></button>
      </div>
    </div>

    {{-- Tabs --}}
    <div class="border-b border-gray-200 flex gap-1 sticky top-16 bg-gray-50 z-10">
      @foreach (P::TABS as $t)
        <button type="button" data-tab-link="{{ $t }}" @class([
            'px-4 py-3 text-sm font-semibold border-b-2 -mb-px transition-colors',
            'border-brand-600 text-brand-600' => $tab === $t,
            'border-transparent text-ink-500 hover:text-ink-900' => $tab !== $t,
        ])>{{ $t }}</button>
      @endforeach
    </div>

    <div class="grid grid-cols-1 lg:grid-cols-3 gap-6 lg:gap-8">
      {{-- Main column. Each section lists the tabs it shows on. --}}
      <div class="lg:col-span-2 space-y-6">
        <p class="text-sm text-brand-700 bg-brand-50 rounded-md px-3 py-2" data-notice @if (! session('notice')) hidden @endif>{{ session('notice') }}</p>

        <div class="card p-5" data-tabs="Photos" @if (! $show('Photos')) hidden @endif>
          <h2 class="text-base font-bold text-ink-900 mb-3">Photos</h2>
          @if (count($photos) > 0)
            <div class="grid grid-cols-2 sm:grid-cols-3 gap-3">
              @foreach ($photos as $p)
                <div class="aspect-[4/3] rounded-lg overflow-hidden bg-gray-100">
                  @include('partials.photo', ['url' => $p['url'], 'alt' => $p['caption'] ?? $biz['name']])
                </div>
              @endforeach
            </div>
          @else
            <p class="text-sm text-ink-500">No photos uploaded yet.</p>
          @endif
        </div>

        @if (! empty($biz['description']))
          <div class="card p-5" data-tabs="Overview" @if (! $show('Overview')) hidden @endif>
            <h2 class="text-base font-bold text-ink-900 mb-2">About</h2>
            <p class="text-sm text-ink-700 leading-relaxed">{{ $biz['description'] }}</p>
          </div>
        @endif

        @if (count($hours) > 0)
          <div class="card p-5" data-tabs="Overview" @if (! $show('Overview')) hidden @endif>
            <h2 class="text-base font-bold text-ink-900 mb-3 flex items-center gap-1.5"><x-icon name="clock" :size="16" class="text-brand-600" /> Hours</h2>
            <ul class="text-sm text-ink-700 divide-y divide-gray-100">
              @foreach ($hours as $h)
                <li class="flex justify-between py-1.5">
                  <span>{{ P::DAY_NAMES[$h['dayOfWeek']] ?? '' }}</span>
                  <span class="{{ $h['isClosed'] ? 'text-ink-500' : 'font-medium' }}">{{ $h['isClosed'] ? 'Closed' : "{$h['openTime']} – {$h['closeTime']}" }}</span>
                </li>
              @endforeach
            </ul>
          </div>
        @endif

        @if (count($services) > 0)
          <div class="card p-5" data-tabs="Overview Services" @if (! $show('Overview', 'Services')) hidden @endif>
            <h2 class="text-base font-bold text-ink-900 mb-3 flex items-center gap-1.5"><x-icon name="calendar" :size="16" class="text-brand-600" /> Services &amp; booking</h2>
            <div class="space-y-2 mb-4">
              @foreach ($services as $s)
                <div class="border border-gray-100 rounded-lg p-3 flex justify-between items-center">
                  <div>
                    <p class="font-medium text-sm text-ink-900">{{ $s['name'] }}</p>
                    @if (! empty($s['description']))
                      <p class="text-xs text-ink-500 mt-0.5">{{ $s['description'] }}</p>
                    @endif
                    <p class="text-xs text-ink-500">{{ $s['durationMins'] }} mins</p>
                  </div>
                  <p class="font-bold text-sm text-brand-700 shrink-0 ml-3">{{ $s['priceCents'] > 0 ? $s['currency'].' '.number_format($s['priceCents'] / 100, 2) : 'Free' }}</p>
                </div>
              @endforeach
            </div>
            @if ($authUser)
              <form class="bg-gray-50 rounded-lg p-4 space-y-3" data-booking-form>
                <h3 class="text-sm font-semibold text-ink-900">Book a service</h3>
                <select required name="serviceId" class="input">
                  <option value="">Select a service</option>
                  @foreach ($services as $s)
                    <option value="{{ $s['id'] }}">{{ $s['name'] }}</option>
                  @endforeach
                </select>
                <input required type="datetime-local" name="scheduledAt" class="input" />
                <button class="btn-primary w-full py-2.5">Request booking</button>
              </form>
            @else
              <p class="text-sm text-ink-500">Log in to book a service.</p>
            @endif
          </div>
        @endif

        <div class="card p-5" data-tabs="Overview Reviews" @if (! $show('Overview', 'Reviews')) hidden @endif>
          <h2 class="text-base font-bold text-ink-900 mb-4 flex items-center gap-1.5"><x-icon name="message-square" :size="16" class="text-brand-600" /> Reviews &amp; Ratings</h2>

          <div class="flex items-center gap-4 mb-4">
            <div class="flex h-16 w-16 flex-col items-center justify-center rounded-xl bg-brand-600 text-white">
              <span class="text-xl font-extrabold leading-none">{{ number_format($biz['avgRating'], 1) }}</span>
              <x-icon name="star" :size="12" fill="currentColor" stroke-width="0" class="mt-0.5" />
            </div>
            <div>
              <p class="font-bold text-ink-900">{{ $biz['reviewCount'] }} Ratings</p>
              <p class="text-xs text-ink-500">Rating based on verified customer reviews</p>
            </div>
          </div>

          @if (count($ratingTrend) > 0)
            <div class="mb-5">
              <p class="text-xs font-semibold text-ink-700 mb-2 flex items-center gap-1"><x-icon name="trending-up" :size="13" /> Recent rating trend</p>
              <div class="flex gap-2 flex-wrap">
                @foreach ($ratingTrend as $r)
                  <span class="inline-flex items-center gap-1 rounded-full border border-gray-200 px-2.5 py-1 text-xs font-medium text-ink-700">
                    {{ number_format($r, 1) }} <x-icon name="star" :size="11" class="text-gold-400" fill="currentColor" stroke-width="0" />
                  </span>
                @endforeach
              </div>
            </div>
          @endif

          <div data-review-composer>
            @if (! $authUser && $wantsReview)
              <div class="mb-5 rounded-lg bg-brand-50 px-4 py-3">
                <p class="text-sm font-semibold text-brand-800">Sign in to leave your review</p>
                <p class="mt-0.5 text-xs text-brand-700/90">It takes a moment, and {{ $biz['name'] }} will see your rating straight away.</p>
                <a href="/login?next={{ urlencode("/business/{$biz['slug']}?review=1") }}" class="btn-primary mt-3 inline-flex px-4 py-2 text-sm">Log in to review</a>
              </div>
            @endif
            @if ($authUser)
              <form class="bg-gray-50 rounded-lg p-4 space-y-3 mb-5" data-review-form>
                <h3 class="text-sm font-semibold text-ink-900">Write a review</h3>
                <input type="hidden" name="rating" value="5" />
                <div class="flex items-center gap-1" data-star-picker>
                  @for ($n = 1; $n <= 5; $n++)
                    <button type="button" data-star="{{ $n }}" class="p-0.5 text-gold-400" aria-label="{{ $n }} star">
                      <x-icon name="star" :size="22" fill="currentColor" stroke-width="0" />
                    </button>
                  @endfor
                </div>
                <input name="title" placeholder="Title (optional)" class="input" />
                <textarea name="comment" placeholder="Share your experience" class="input min-h-20"></textarea>
                <button class="btn-primary px-5 py-2">Submit review</button>
              </form>
            @endif
          </div>

          @if (count($reviews) > 0)
            <div class="flex items-center gap-2 mb-3" data-review-sort>
              @foreach (['relevant' => 'Relevant', 'latest' => 'Latest', 'high' => 'High to Low'] as $key => $label)
                <button type="button" data-sort="{{ $key }}" @class([
                    'text-xs font-medium rounded-md px-3 py-1.5 border transition-colors',
                    'bg-brand-50 border-brand-200 text-brand-700' => $key === 'relevant',
                    'border-gray-200 text-ink-600 hover:bg-gray-50' => $key !== 'relevant',
                ])>{{ $label }}</button>
              @endforeach
            </div>
          @endif

          <div class="space-y-3" data-review-list>
            @forelse ($reviews as $i => $r)
              <div class="border-b border-gray-100 pb-3 last:border-0" data-review data-index="{{ $i }}" data-rating="{{ $r['rating'] }}" data-created="{{ $r['createdAt'] }}">
                <div class="flex justify-between items-start gap-2">
                  <div class="flex items-center gap-2">
                    <span class="flex h-8 w-8 items-center justify-center rounded-full bg-brand-100 text-brand-700 text-xs font-bold">{{ mb_strtoupper(mb_substr($r['user']['firstName'] ?? 'U', 0, 1)) }}</span>
                    <p class="font-semibold text-sm text-ink-900">{{ $r['user']['firstName'] ?? '' }} {{ $r['user']['lastName'] ?? '' }}</p>
                  </div>
                  <span class="text-xs text-ink-400">{{ \Illuminate\Support\Carbon::parse($r['createdAt'])->format('d M Y') }}</span>
                </div>
                <div class="mt-1.5"><x-star-row :rating="$r['rating']" :size="14" /></div>
                @if (! empty($r['title']))
                  <p class="font-medium text-sm text-ink-800 mt-1">“{{ $r['title'] }}”</p>
                @endif
                @if (! empty($r['comment']))
                  <p class="text-sm text-ink-700 mt-1">{{ $r['comment'] }}</p>
                @endif
                @if (! empty($r['ownerReply']))
                  <div class="mt-2 bg-brand-50 rounded-md p-2.5 text-sm text-ink-700"><span class="font-semibold text-brand-700">Owner reply: </span>{{ $r['ownerReply'] }}</div>
                @endif
                <div class="flex items-center gap-4 mt-2 text-xs text-ink-500">
                  <span class="flex items-center gap-1"><x-icon name="thumbs-up" :size="13" /> Helpful</span>
                  <button type="button" data-share class="flex items-center gap-1 hover:text-brand-600"><x-icon name="share-2" :size="13" /> Share</button>
                </div>
              </div>
            @empty
              <p class="text-sm text-ink-500">No reviews yet — be the first to leave one.</p>
            @endforelse
          </div>
          @if ($reviewMeta['total'] > 0)
            <x-pager data-pager :page="$reviewMeta['page']" :total-pages="$reviewMeta['totalPages']" />
          @endif
        </div>
      </div>

      {{-- Sidebar --}}
      <div class="space-y-4">
        <div class="card p-5 space-y-4">
          <div>
            <h3 class="font-bold text-ink-900 mb-1.5">Contact</h3>
            <button type="button" data-show-number class="flex items-center gap-2 text-sm text-brand-600 font-medium hover:underline"><x-icon name="phone" :size="15" /> <span>Show Number</span></button>
          </div>

          <div class="border-t border-gray-100 pt-4">
            <h3 class="font-bold text-ink-900 mb-1.5">Address</h3>
            <p class="text-sm text-ink-600 leading-relaxed">{{ $address }}</p>
            <div class="flex items-center gap-4 mt-2 text-sm">
              <a href="{{ $directionsUrl }}" target="_blank" rel="noreferrer" class="flex items-center gap-1 text-brand-600 font-medium hover:underline"><x-icon name="navigation" :size="14" /> Get Directions</a>
              <button type="button" data-copy-address="{{ $address }}" class="flex items-center gap-1 text-brand-600 font-medium hover:underline"><x-icon name="copy" :size="14" /> <span>Copy</span></button>
            </div>
          </div>

          <div class="border-t border-gray-100 pt-4 space-y-3 text-sm">
            @if (! empty($biz['email']))
              <a href="mailto:{{ $biz['email'] }}" class="flex items-center gap-2 text-ink-700 hover:text-brand-600"><x-icon name="mail" :size="15" class="text-brand-600" /> Send Enquiry by Email</a>
            @endif
            <button type="button" data-share class="flex items-center gap-2 text-ink-700 hover:text-brand-600"><x-icon name="share-2" :size="15" class="text-brand-600" /> Share</button>
            @if (! empty($biz['website']))
              <a href="{{ $biz['website'] }}" target="_blank" rel="noreferrer" class="flex items-center gap-2 text-ink-700 hover:text-brand-600"><x-icon name="globe" :size="15" class="text-brand-600" /> Visit our Website</a>
            @endif
          </div>
        </div>

        @if ($category)
          <div class="card p-5">
            <h3 class="font-bold text-ink-900 mb-3">Also listed in</h3>
            <div class="flex flex-wrap gap-2">
              <a href="/search?category={{ urlencode($category['slug']) }}" class="badge bg-gray-100 text-ink-700 hover:bg-gray-200">{{ $category['name'] }}</a>
            </div>
          </div>
        @endif

        <form class="card p-5 space-y-3" data-lead-form>
          <h3 class="font-bold text-ink-900">Send an enquiry</h3>
          <p class="text-xs text-ink-500 -mt-2">The business will contact you directly.</p>
          <input required name="name" placeholder="Your name" class="input" />
          <input required name="phone" placeholder="Phone number" class="input" />
          <input name="email" placeholder="Email (optional)" class="input" />
          <textarea name="message" placeholder="Message" class="input min-h-20"></textarea>
          <button class="btn-primary w-full py-2.5">Send enquiry</button>
        </form>
      </div>
    </div>
  </div>

  @php
      $pageData = [
          'id' => $biz['id'],
          'slug' => $biz['slug'],
          'name' => $biz['name'],
          'phone' => $biz['phone'],
          'hours' => $hours,
          'wantsReview' => $wantsReview,
      ];
  @endphp
  <script type="application/json" id="business-data">@json($pageData)</script>
@endsection

@push('scripts')
  @vite('resources/js/pages/business.js')
@endpush
