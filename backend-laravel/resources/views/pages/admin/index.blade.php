@extends('layouts.app')

@section('title', 'Admin Console')

@php
    use App\Http\Controllers\Web\AdminPageController as A;
    $statMeta = [
        ['userCount', 'Users', 'users', 'bg-brand-50 text-brand-600'],
        ['dealerCount', 'Dealers', 'user-cog', 'bg-violet-50 text-violet-600'],
        ['businessCount', 'Businesses', 'building-2', 'bg-sky-50 text-sky-600'],
        ['publishedBusinessCount', 'Published', 'shield-check', 'bg-emerald-50 text-emerald-600'],
        ['pendingBusinessCount', 'Pending', 'calendar', 'bg-amber-50 text-amber-600'],
        ['reviewCount', 'Reviews', 'star', 'bg-gold-50 text-gold-500'],
        ['leadCount', 'Leads', 'message-square', 'bg-pink-50 text-pink-600'],
        ['b2bBusinessCount', 'B2B Businesses', 'briefcase', 'bg-teal-50 text-teal-600'],
    ];
    // The sidebar: every tab, grouped, with its icon and a line for the page header.
    $menu = [
        '' => [
            'Overview' => ['layout-dashboard', 'Platform totals at a glance'],
        ],
        'People' => [
            'Users' => ['users', 'Accounts, dealers, roles, points and pricing groups'],
        ],
        'Listings' => [
            'Businesses' => ['building-2', 'Every business on Markkito'],
            'Approvals' => ['shield-check', 'Listings waiting for review'],
            'QR Boards' => ['qr-code', 'Printed review boards and their scans'],
        ],
        'Money' => [
            'Feature Pricing' => ['sliders-horizontal', 'Points, prices, commission and durations per pricing group'],
            'Commission' => ['receipt', 'What dealers collected, owe and have paid'],
        ],
        'Content' => [
            'Gold Rates' => ['coins', "Today's gold rates and poster templates"],
            'Card Templates' => ['layout-template', 'Digital visiting card designs'],
            'SEO' => ['search-check', 'Pages on Google and their status'],
        ],
        'Insights' => [
            'Visitors' => ['eye', 'Who is visiting the site'],
            'Analytics' => ['gauge', 'Online now and the most viewed pages'],
            'Reports' => ['trending-up', 'Businesses created by each dealer'],
        ],
    ];
    // Any tab not placed above still shows, at the end.
    $placed = collect($menu)->flatMap(fn ($items) => array_keys($items))->all();
    foreach (array_diff(A::TABS, $placed) as $t) {
        $menu['More'][$t] = ['layout-grid', ''];
    }
    $current = collect($menu)->flatMap(fn ($items) => $items)->get($tab, ['layout-grid', '']);
    $badge = fn (string $t) => $t === 'Approvals' && ($stats['pendingBusinessCount'] ?? 0) > 0 ? $stats['pendingBusinessCount'] : null;
@endphp

@section('content')
  <div class="lg:grid lg:grid-cols-[15rem_minmax(0,1fr)] lg:gap-6">
    {{-- Sidebar (a scrollable strip on phones). --}}
    <aside class="mb-5 lg:mb-0">
      <nav class="lg:sticky lg:top-20 rounded-2xl border border-gray-200 bg-white p-2 shadow-sm lg:p-3" aria-label="Admin">
        <a href="/admin" class="mb-3 hidden items-center gap-2.5 border-b border-gray-100 px-2 pb-3 pt-1 lg:flex">
          <span class="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-brand-500 to-brand-700 text-white shadow-sm"><x-icon name="settings-2" :size="17" /></span>
          <span>
            <span class="block text-sm font-bold text-ink-900">Admin Console</span>
            <span class="block text-[11px] text-ink-400">Markkito platform</span>
          </span>
        </a>
        <div class="flex gap-1 overflow-x-auto lg:block lg:space-y-4 lg:overflow-visible">
          @foreach ($menu as $section => $items)
            <div class="flex shrink-0 gap-1 lg:block lg:space-y-0.5">
              @if ($section !== '')
                <p class="hidden px-2.5 pb-1 text-[10px] font-bold uppercase tracking-[0.14em] text-ink-400 lg:block">{{ $section }}</p>
              @endif
              @foreach ($items as $t => [$icon])
                @php $on = $tab === $t; @endphp
                <a href="/admin?tab={{ urlencode($t) }}" @if ($on) aria-current="page" @endif @class([
                    'group relative flex shrink-0 items-center gap-2.5 whitespace-nowrap rounded-lg px-2.5 py-2 text-sm transition-colors',
                    'bg-brand-50 font-semibold text-brand-700 lg:before:absolute lg:before:inset-y-1.5 lg:before:-left-3 lg:before:w-1 lg:before:rounded-r-full lg:before:bg-brand-600' => $on,
                    'font-medium text-ink-600 hover:bg-gray-50 hover:text-ink-900' => ! $on,
                ])>
                  <span @class(['flex h-7 w-7 items-center justify-center rounded-md transition-colors', 'bg-brand-600 text-white shadow-sm' => $on, 'bg-gray-100 text-ink-500 group-hover:bg-white group-hover:text-brand-600 group-hover:ring-1 group-hover:ring-gray-200' => ! $on])>
                    <x-icon :name="$icon" :size="15" />
                  </span>
                  <span class="lg:flex-1">{{ $t }}</span>
                  @if ($n = $badge($t))
                    <span class="rounded-full bg-amber-100 px-1.5 text-[10px] font-bold text-amber-800 ring-1 ring-amber-200">{{ $n }}</span>
                  @endif
                </a>
              @endforeach
            </div>
          @endforeach
        </div>
      </nav>
    </aside>

    <section class="min-w-0">
      <header class="mb-5 flex items-center gap-3">
        <span class="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-600"><x-icon :name="$current[0]" :size="19" /></span>
        <div class="min-w-0">
          <h1 class="truncate text-xl font-extrabold text-ink-900 sm:text-2xl">{{ $tab }}</h1>
          @if ($current[1])<p class="truncate text-sm text-ink-500">{{ $current[1] }}</p>@endif
        </div>
      </header>

      <p class="text-sm text-emerald-800 bg-emerald-50 rounded-md px-3 py-2 mb-4" data-flash hidden></p>
      <p class="text-sm text-red-700 bg-red-50 rounded-md px-3 py-2 mb-4" data-error hidden></p>

      @if ($tab === 'Overview')
        <div class="grid grid-cols-2 sm:grid-cols-4 gap-3">
          @foreach ($statMeta as [$key, $label, $icon, $tint])
            <div class="card p-4">
              <span class="flex h-9 w-9 items-center justify-center rounded-lg {{ $tint }}"><x-icon :name="$icon" :size="17" /></span>
              <p class="text-2xl font-extrabold text-ink-900 mt-3 leading-none">{{ $stats[$key] ?? 0 }}</p>
              <p class="text-xs text-ink-500 mt-1">{{ $label }}</p>
            </div>
          @endforeach
        </div>
      @else
        @include('pages.admin.tabs.'.\Illuminate\Support\Str::slug($tab))
      @endif
    </section>
  </div>
@endsection

@push('scripts')
  @vite('resources/js/pages/admin.js')
@endpush
