@extends('layouts.bare')

@php
    $business = $site['business'];
    $theme = $site['theme'];
    $storefront = $site['storefront'] ?? [];
    $currency = $products[0]['currency'] ?? 'INR';
    $money = fn ($cents) => ($currency === 'INR' ? '₹' : '').rtrim(rtrim(number_format($cents / 100, 2), '0'), '.');
    $baseFee = $storefront['deliveryFeeCents'] ?? 0;
    $freeAbove = $storefront['freeDeliveryAboveCents'] ?? null;
    $address = implode(', ', array_filter([$business['addressLine1'], $business['addressLine2'], $business['city'], $business['state'], $business['postalCode']]));
    $whatsapp = 'https://wa.me/'.preg_replace('/[^0-9]/', '', $business['phone']);
    $directions = "https://www.google.com/maps/dir/?api=1&destination={$business['latitude']},{$business['longitude']}";
    $banner = $business['photos'][0]['url'] ?? null;
    $to12 = function (string $time) {
        [$h, $m] = array_map('intval', explode(':', $time) + [0, 0]);
        $period = $h >= 12 ? 'pm' : 'am';
        $hour = $h % 12 === 0 ? 12 : $h % 12;

        return $m ? sprintf('%d.%02d%s', $hour, $m, $period) : "{$hour}{$period}";
    };
    // The theme travels as CSS variables so every storefront rule is written once.
    $cssVars = collect([
        'accent' => 'accent', 'accent-alt' => 'accentAlt', 'on-accent' => 'onAccent', 'bg' => 'bg', 'surface' => 'surface',
        'text' => 'text', 'muted' => 'muted', 'line' => 'line', 'header-bg' => 'headerBg', 'header-text' => 'headerText',
        'radius' => 'radius', 'font' => 'font', 'heading' => 'heading',
    ])->map(fn ($key, $var) => "--sf-{$var}:".str_replace([';', '"'], '', (string) ($theme[$key] ?? '')))->implode(';');
    $days = \App\Http\Controllers\Web\BusinessPageController::DAY_NAMES;
@endphp

@section('title', ($business['seoTitle'] ?? null) ?: $business['name'].' — Order online')
@section('description', \App\Support\Seo\SeoMeta::description($business))

@push('head')
  {{-- Served at both <slug>.<domain> and /site/<slug>; search engines are
       told the subdomain (when there is one) is the one to list. --}}
  @include('partials.seo-tags', ['biz' => $business, 'url' => \App\Support\Seo\SeoTracker::websiteUrl($business['slug'])])
  @vite('resources/css/storefront.css')
@endpush

@section('content')
  <div class="mk-shop" style="{{ $cssVars }}">
    <header class="sf-header">
      <div class="sf-header-inner">
        <a class="sf-brand" href="#top">
          @if ($business['logoUrl'])
            <img class="sf-logo" src="{{ $business['logoUrl'] }}" alt="{{ $business['name'] }}" />
          @else
            <span class="sf-logo sf-logo-text">{{ mb_strtoupper(mb_substr(trim($business['name']), 0, 1)) }}</span>
          @endif
          <span class="sf-brand-text">
            <strong style="text-transform: {{ ! empty($theme['uppercase']) ? 'uppercase' : 'none' }}">{{ $business['name'] }}</strong>
            <small>{{ $business['city'] }}</small>
          </span>
        </a>

        <form class="sf-search" data-shop-search>
          <input name="search" placeholder="Search products…" aria-label="Search products" />
          <button type="submit">Search</button>
        </form>

        <button class="sf-cart-btn" data-open-cart aria-label="Open cart">
          <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" width="18" height="18"><path d="M7 18a2 2 0 100 4 2 2 0 000-4m10 0a2 2 0 100 4 2 2 0 000-4M7.2 14.6l.03-.13.9-1.63h7.45c.75 0 1.41-.41 1.75-1.03l3.58-6.49-1.74-.96-3.59 6.48h-6.9L3.27 2H0v2h2l3.6 7.59-1.35 2.44A2 2 0 006 17h12v-2H6.42a.25.25 0 01-.22-.4" /></svg>
          <span>Cart</span>
          <em class="sf-badge" data-cart-count hidden></em>
        </button>
      </div>
    </header>

    <section class="sf-hero" id="top">
      @if ($banner)
        <img class="sf-hero-img" src="{{ $banner }}" alt="" />
      @endif
      <div class="sf-hero-body">
        <h1 style="font-family: {{ str_replace(';', '', $theme['heading'] ?? '') }}">{{ $business['name'] }}</h1>
        @if ($business['description'])
          <p class="sf-hero-sub">{{ $business['description'] }}</p>
        @endif
        <div class="sf-hero-meta">
          @if ($business['avgRating'] > 0)
            <span class="sf-pill">★ {{ number_format($business['avgRating'], 1) }} · {{ $business['reviewCount'] }} reviews</span>
          @endif
          <span class="sf-pill">{{ $business['city'] }}</span>
          @if ($baseFee === 0)
            <span class="sf-pill">Free delivery</span>
          @elseif ($freeAbove !== null)
            <span class="sf-pill">Free delivery over {{ $money($freeAbove) }}</span>
          @else
            <span class="sf-pill">Delivery {{ $money($baseFee) }}</span>
          @endif
        </div>
        <div class="sf-hero-actions">
          <a class="sf-btn sf-btn-primary" href="tel:{{ $business['phone'] }}">Call {{ $business['phone'] }}</a>
          <a class="sf-btn sf-btn-ghost" href="{{ $whatsapp }}" target="_blank" rel="noreferrer">WhatsApp</a>
          <a class="sf-btn sf-btn-ghost" href="{{ $directions }}" target="_blank" rel="noreferrer">Directions</a>
        </div>
      </div>
    </section>

    {{-- Shop, checkout and the order confirmation are drawn here by storefront.js. --}}
    <div data-shop-view></div>

    <footer class="sf-footer">
      <div class="sf-footer-inner">
        <div>
          <h4>{{ $business['name'] }}</h4>
          <p>{{ $address }}</p>
          <p>
            <a href="tel:{{ $business['phone'] }}">{{ $business['phone'] }}</a>
            @if ($business['email'])
              · <a href="mailto:{{ $business['email'] }}">{{ $business['email'] }}</a>
            @endif
          </p>
        </div>
        @if (count($business['hours']) > 0)
          <div>
            <h4>Opening hours</h4>
            <ul class="sf-hours">
              @foreach ($business['hours'] as $h)
                <li><span>{{ $days[$h['dayOfWeek']] ?? '' }}</span><span>{{ $h['isClosed'] ? 'Closed' : $to12($h['openTime']).' – '.$to12($h['closeTime']) }}</span></li>
              @endforeach
            </ul>
          </div>
        @endif
        <div>
          <h4>Find us</h4>
          <div class="sf-map">
            <iframe src="https://maps.google.com/maps?q={{ $business['latitude'] }},{{ $business['longitude'] }}&z=16&output=embed" title="Map to {{ $business['name'] }}" loading="lazy"></iframe>
          </div>
          <a class="sf-link" href="{{ $directions }}" target="_blank" rel="noreferrer">Get directions</a>
        </div>
      </div>
      <p class="sf-copy">© {{ now()->year }} {{ $business['name'] }} · <a href="{{ \App\Support\SiteUrl::markkito('/business/'.$business['slug']) }}">View on Markkito</a></p>
    </footer>

    {{-- Floating contact buttons, same as the brochure designs carry. --}}
    <div class="sf-float">
      <a class="sf-float-btn sf-float-wa" href="{{ $whatsapp }}" target="_blank" rel="noreferrer" aria-label="WhatsApp">
        <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M17.47 14.38c-.3-.15-1.76-.87-2.03-.97-.27-.1-.47-.15-.67.15s-.77.96-.94 1.16c-.17.2-.35.22-.64.08-.3-.15-1.25-.46-2.39-1.47-.88-.79-1.48-1.76-1.65-2.06-.17-.3-.02-.46.13-.61.13-.13.3-.35.45-.52.15-.17.2-.3.3-.5.1-.2.05-.37-.03-.52-.07-.15-.67-1.61-.92-2.21-.24-.58-.49-.5-.67-.51h-.57c-.2 0-.52.07-.79.37-.27.3-1.04 1.02-1.04 2.48s1.07 2.88 1.22 3.08c.15.2 2.1 3.2 5.08 4.49.71.3 1.26.49 1.69.63.71.23 1.36.2 1.87.12.57-.09 1.76-.72 2.01-1.41.25-.7.25-1.29.17-1.42-.07-.13-.27-.2-.57-.35M12.04 21.5h-.01a9.5 9.5 0 01-4.84-1.32l-.35-.21-3.6.94.96-3.5-.23-.36a9.42 9.42 0 01-1.45-5.05c0-5.22 4.27-9.47 9.53-9.47a9.47 9.47 0 019.51 9.48c0 5.22-4.27 9.47-9.52 9.47M20.52 3.5A11.44 11.44 0 0012.04 0C5.69 0 .52 5.15.52 11.47c0 2.02.53 3.99 1.54 5.73L.42 24l6.96-1.82a11.5 11.5 0 004.65 1.03h.01c6.35 0 11.52-5.15 11.52-11.47 0-3.06-1.2-5.94-3.37-8.11" /></svg>
      </a>
      <a class="sf-float-btn sf-float-call" href="tel:{{ $business['phone'] }}" aria-label="Call">
        <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M6.62 10.79a15.05 15.05 0 006.59 6.59l2.2-2.2a1 1 0 011.02-.24c1.12.37 2.33.57 3.57.57a1 1 0 011 1V20a1 1 0 01-1 1A17 17 0 013 4a1 1 0 011-1h3.5a1 1 0 011 1c0 1.24.2 2.45.57 3.57a1 1 0 01-.25 1.02l-2.2 2.2z" /></svg>
      </a>
    </div>

    <div class="sf-drawer-wrap" role="dialog" aria-label="Your cart" data-cart-drawer hidden>
      <div class="sf-scrim" data-close-cart></div>
      <aside class="sf-drawer" data-cart-body></aside>
    </div>
  </div>

  @php
      $shopData = [
          'slug' => $business['slug'],
          'name' => $business['name'],
          'city' => $business['city'],
          'heading' => $theme['heading'] ?? '',
          'storefront' => $storefront,
          'products' => $products,
          'total' => $total,
          'pageSize' => \App\Http\Controllers\Web\SitePageController::STOREFRONT_PAGE_SIZE,
      ];
  @endphp
  <script type="application/json" id="shop-data">@json($shopData)</script>
@endsection

@push('scripts')
  @vite('resources/js/pages/storefront.js')
@endpush
