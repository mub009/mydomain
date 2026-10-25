@extends('layouts.app')

@section('title', $isDealer ? 'Dealer Dashboard' : 'My Business Dashboard')

@php
    use App\Http\Controllers\Web\DashboardController as D;
    use App\Support\SiteUrl;
    $badge = fn (string $status) => match ($status) {
        'PUBLISHED', 'CONFIRMED', 'CONVERTED', 'COMPLETED' => 'bg-emerald-50 text-emerald-700 ring-emerald-600/20',
        'PENDING_APPROVAL', 'PENDING' => 'bg-amber-50 text-amber-700 ring-amber-600/20',
        'NEW' => 'bg-brand-50 text-brand-700 ring-brand-600/20',
        'CONTACTED' => 'bg-sky-50 text-sky-700 ring-sky-600/20',
        'QUALIFIED' => 'bg-violet-50 text-violet-700 ring-violet-600/20',
        'SUSPENDED', 'CANCELLED', 'LOST', 'NO_SHOW' => 'bg-red-50 text-red-700 ring-red-600/20',
        default => 'bg-gray-50 text-gray-600 ring-gray-500/20',
    };
    $statusLabel = fn (string $status) => match ($status) {
        'PUBLISHED' => 'Live',
        'PENDING_APPROVAL' => 'Pending',
        default => ucfirst(strtolower(str_replace('_', ' ', $status))),
    };
    $stats = [
        ['building-2', 'Listings', $stats['listings'], "{$stats['live']} live"],
        ...($isDealer ? [['coins', 'Points', $points['points'] ?? '—', $outOfPoints ? 'None left' : 'For new listings']] : []),
        ['eye', 'Profile views', number_format($stats['totalViews']), 'All listings'],
        ['message-square', 'Leads', number_format($stats['totalLeads']), 'All listings'],
        ['star', 'Rating', $stats['avgRating'] > 0 ? number_format($stats['avgRating'], 1) : '—', "{$stats['ratedReviews']} reviews"],
    ];
@endphp

@section('content')
  {{-- Page header --}}
  <div class="mb-6 flex flex-wrap items-end justify-between gap-4">
    <div>
      <p class="text-sm text-ink-500">Welcome back{{ $user->firstName ? ", {$user->firstName}" : '' }}</p>
      <h1 class="text-2xl font-bold tracking-tight text-ink-900">{{ $isDealer ? 'Dealer dashboard' : 'My business' }}</h1>
    </div>
    @if ($tab === 'businesses')
      <div class="flex items-center gap-2">
        @if ($isDealer && $points)
          <span class="inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-sm font-semibold {{ $outOfPoints ? 'border-red-200 bg-red-50 text-red-700' : 'border-amber-200 bg-amber-50 text-amber-700' }}">
            <x-icon name="coins" :size="15" /> {{ $points['points'] }} {{ $points['points'] === 1 ? 'point' : 'points' }}
          </span>
        @endif
        <button type="button" data-toggle-create @disabled($outOfPoints) title="{{ $outOfPoints ? 'No points left — contact the admin to add more' : '' }}" class="btn-primary px-4 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-50">
          <span data-when="closed" class="inline-flex items-center gap-2"><x-icon name="plus" :size="15" /> Add business</span>
          <span data-when="open" class="inline-flex items-center gap-2" hidden><x-icon name="x" :size="15" /> Cancel</span>
        </button>
      </div>
    @endif
  </div>

  {{-- Totals --}}
  <div class="mb-6 grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-gray-200 bg-gray-200 {{ $isDealer ? 'lg:grid-cols-5' : 'lg:grid-cols-4' }}">
    @foreach ($stats as [$icon, $label, $value, $note])
      {{-- An odd one out fills its row on phones rather than leaving a gap. --}}
      <div class="bg-white px-5 py-4 last:odd:col-span-2 lg:last:odd:col-span-1">
        <p class="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-ink-500"><x-icon :name="$icon" :size="13" /> {{ $label }}</p>
        <p class="mt-1.5 text-2xl font-bold text-ink-900">{{ $value }}</p>
        <p class="text-xs text-ink-400">{{ $note }}</p>
      </div>
    @endforeach
  </div>

  @if ($outOfPoints)
    <div class="mb-6 flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3">
      <x-icon name="alert-triangle" :size="18" class="mt-0.5 shrink-0 text-red-600" />
      <p class="text-sm text-red-800"><span class="font-semibold">You're out of points.</span> Adding or cloning a business costs {{ $points['pointsPerBusiness'] ?? 1 }} point — ask the admin to add more. You can still manage your existing listings.</p>
    </div>
  @endif

  {{-- Sections --}}
  @if (count($visibleTabs) > 1)
    {{-- Scrolls sideways on its own when the tabs outgrow a phone screen,
         rather than widening the whole page. --}}
    <div class="mb-5 flex w-fit max-w-full overflow-x-auto rounded-lg bg-gray-100 p-1">
      @foreach ($visibleTabs as $t)
        <a href="/dashboard?tab={{ $t }}" @class([
            'flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-md px-3 py-1.5 text-sm font-semibold transition-colors sm:px-4',
            'bg-white text-ink-900 shadow-sm' => $tab === $t,
            'text-ink-500 hover:text-ink-900' => $tab !== $t,
        ])><x-icon :name="D::TABS[$t]['icon']" :size="15" /> {{ D::TABS[$t]['label'] }}</a>
      @endforeach
    </div>
  @endif

  @if (count($visibleTabs) === 0)
    <div class="card p-8 text-center text-sm text-ink-500">Your account doesn’t have any features enabled yet. Please contact your administrator to grant access.</div>
  @endif

  @if ($tab === 'businesses')
    <p class="mb-4 rounded-lg bg-brand-50 px-3 py-2 text-sm text-brand-700" data-flash hidden></p>
    <div data-owner-creds></div>

    @include('pages.dashboard.partials.create-business')

    <div class="card overflow-hidden">
      <div class="flex flex-wrap items-center justify-between gap-3 border-b border-gray-100 px-5 py-4">
        <h2 class="font-semibold text-ink-900">Listings <span class="ml-1 text-sm font-normal text-ink-400">{{ $bizMeta['total'] }}</span></h2>
        <form method="GET" action="/dashboard" class="relative w-full sm:w-72">
          <input type="hidden" name="tab" value="businesses" />
          <input type="hidden" name="perPage" value="{{ $perPage }}" />
          <x-icon name="search" :size="15" class="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-400" />
          <input name="search" value="{{ $search }}" placeholder="Search by name, city or phone" autocomplete="off" class="input py-2 pl-9 text-sm" data-live-search />
        </form>
      </div>

      @if (count($businesses) > 0)
        <div class="hidden grid-cols-[minmax(0,1fr)_100px_90px_90px_auto] gap-4 border-b border-gray-100 bg-gray-50 px-5 py-2 text-xs font-semibold uppercase tracking-wide text-ink-500 md:grid">
          <span>Business</span><span>Status</span><span class="text-right">Views</span><span class="text-right">Leads</span><span class="w-[232px]"></span>
        </div>
      @endif
      <div class="divide-y divide-gray-100">
        @forelse ($businesses as $b)
          <div class="grid grid-cols-1 items-center gap-3 px-5 py-3.5 md:grid-cols-[minmax(0,1fr)_100px_90px_90px_auto] md:gap-4">
            <div class="flex min-w-0 items-center gap-3">
              @if (! empty($b['logoUrl']))
                <img src="{{ $b['logoUrl'] }}" alt="" class="h-10 w-10 shrink-0 rounded-lg object-cover ring-1 ring-gray-200" data-on-error="hide" />
              @else
                <span class="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-sm font-bold text-brand-700">{{ mb_strtoupper(mb_substr($b['name'], 0, 1)) }}</span>
              @endif
              <div class="min-w-0">
                <a href="/dashboard/businesses/{{ $b['id'] }}" class="block truncate font-semibold text-ink-900 hover:text-brand-600">{{ $b['name'] }}</a>
                <p class="truncate text-xs text-ink-500">{{ collect([$b['category']['name'] ?? null, $b['city']])->filter()->implode(' · ') }}</p>
              </div>
            </div>
            <div class="flex items-center gap-3 md:block">
              <span class="inline-flex items-center rounded-md px-2 py-0.5 text-xs font-semibold ring-1 ring-inset {{ $badge($b['status']) }}">{{ $statusLabel($b['status']) }}</span>
              <span class="text-xs text-ink-500 md:hidden">{{ number_format($b['viewCount'] ?? 0) }} views · {{ number_format($b['leadCount'] ?? 0) }} leads</span>
            </div>
            <span class="hidden text-right text-sm tabular-nums text-ink-700 md:block">{{ number_format($b['viewCount'] ?? 0) }}</span>
            <span class="hidden text-right text-sm tabular-nums text-ink-700 md:block">{{ number_format($b['leadCount'] ?? 0) }}</span>
            <div class="flex flex-wrap items-center gap-2 md:w-[232px] md:flex-nowrap md:justify-end">
              {{-- First on phones; last on wide screens, so it lines up down the list. --}}
              <a href="/dashboard/businesses/{{ $b['id'] }}" class="btn-primary px-3 py-1.5 text-sm md:order-last"><x-icon name="settings-2" :size="14" /> Manage</a>
              @if ($b['status'] === 'PUBLISHED')
                <a href="{{ SiteUrl::for($b['slug']) }}" target="_blank" rel="noreferrer" class="btn-secondary px-2.5 py-1.5 text-sm" title="Open website"><x-icon name="globe" :size="14" /> Website</a>
              @endif
              @if ($isDealer)
                <button type="button" data-clone-business="{{ json_encode(['id' => $b['id'], 'name' => $b['name']]) }}" @disabled($outOfPoints) title="{{ $outOfPoints ? 'No points left — contact the admin to add more' : 'Make a copy of this business' }}" class="btn-secondary px-2.5 py-1.5 text-sm disabled:cursor-not-allowed disabled:opacity-50"><x-icon name="copy" :size="14" /> Clone</button>
              @endif
            </div>
          </div>
        @empty
          <div class="px-5 py-12 text-center" data-empty-listings>
            <span class="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-gray-100 text-ink-400"><x-icon name="building-2" :size="22" /></span>
            @if ($search !== '')
              <p class="mt-3 font-semibold text-ink-900">No listings match “{{ $search }}”</p>
              <a href="/dashboard?tab=businesses" class="mt-1 inline-block text-sm font-semibold text-brand-600 hover:underline">Clear search</a>
            @else
              <p class="mt-3 font-semibold text-ink-900">No businesses yet</p>
              <p class="mt-1 text-sm text-ink-500">Click “Add business” to create your first listing.</p>
            @endif
          </div>
        @endforelse
      </div>
      @if ($bizMeta['total'] > 0)
        <div class="border-t border-gray-100">
          <x-per-page :total="$bizMeta['total']" :page="$bizMeta['page']" :per-page="$perPage" :options="D::PER_PAGE_OPTIONS" />
        </div>
      @endif
    </div>
    <x-pager :page="$bizMeta['page']" :total-pages="$bizMeta['totalPages']" />
  @endif

  @if ($tab === 'logins')
    @php
        $logins = $accounts['data'] ?? [];
        $loginsMeta = $accounts['meta'] ?? ['page' => 1, 'totalPages' => 1, 'total' => 0];
    @endphp
    <div class="card overflow-hidden">
      <div class="flex flex-wrap items-center justify-between gap-3 border-b border-gray-100 px-5 py-4">
        <div>
          <h2 class="font-semibold text-ink-900">Business logins <span class="ml-1 text-sm font-normal text-ink-400">{{ $loginsMeta['total'] }}</span></h2>
          <p class="mt-0.5 text-xs text-ink-500">Accounts you created for business teams. If an owner forgets their password, reset it here and share the new one.</p>
        </div>
        <form method="GET" action="/dashboard" class="relative w-full sm:w-72">
          <input type="hidden" name="tab" value="logins" />
          <input type="hidden" name="perPage" value="{{ $perPage }}" />
          <x-icon name="search" :size="15" class="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-400" />
          <input name="search" value="{{ $search }}" placeholder="Search by name, phone, email or business" autocomplete="off" class="input py-2 pl-9 text-sm" data-live-search />
        </form>
      </div>

      @if ($accounts === null)
        <p class="px-5 py-8 text-center text-sm text-red-700">Could not load your business logins.</p>
      @elseif (count($logins) === 0)
        <p class="px-5 py-10 text-center text-sm text-ink-500">
          @if ($search !== '')
            No logins match “{{ $search }}”. <a href="/dashboard?tab=logins" class="font-semibold text-brand-600 hover:underline">Show all</a>
          @else
            No business logins yet. When you add a business with a new owner login, it appears here.
          @endif
        </p>
      @else
        <div class="divide-y divide-gray-100">
          @foreach ($logins as $a)
            <div class="flex flex-col gap-3 px-5 py-3.5 sm:flex-row sm:items-center sm:justify-between">
              <div class="flex min-w-0 items-start gap-3">
                <span class="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gray-100 text-ink-500"><x-icon name="user" :size="16" /></span>
                <div class="min-w-0">
                  <p class="flex flex-wrap items-center gap-2 text-sm font-semibold text-ink-900">
                    <span class="truncate">{{ $a['firstName'] }} {{ $a['lastName'] }}</span>
                    @if ($a['status'] !== 'ACTIVE')
                      <span class="rounded-full px-2 py-0.5 text-[11px] font-medium ring-1 ring-inset {{ $badge($a['status']) }}">{{ $statusLabel($a['status']) }}</span>
                    @endif
                  </p>
                  <p class="truncate text-xs text-ink-500">
                    {{ implode(' · ', array_filter([$a['phone'] ?? null, $a['email'] ?? null])) }}
                    · created {{ \Illuminate\Support\Carbon::parse($a['createdAt'])->format('j M Y') }}
                  </p>
                  @if (count($a['businesses']) > 0)
                    <div class="mt-1.5 flex flex-wrap gap-1.5">
                      @foreach (array_slice($a['businesses'], 0, 4) as $b)
                        <a href="/dashboard/businesses/{{ $b['id'] }}" class="inline-flex items-center gap-1 rounded-md bg-gray-50 px-2 py-0.5 text-xs text-ink-700 ring-1 ring-inset ring-gray-200 hover:bg-brand-50 hover:text-brand-700">
                          <x-icon name="building-2" :size="11" /> {{ $b['name'] }}
                          <span class="text-ink-400">· {{ $statusLabel($b['status']) }}</span>
                        </a>
                      @endforeach
                      @if ($a['_count']['businesses'] > 4)
                        <span class="px-1 py-0.5 text-xs text-ink-400">+{{ $a['_count']['businesses'] - 4 }} more</span>
                      @endif
                    </div>
                  @else
                    <p class="mt-1 text-xs text-ink-400">No businesses</p>
                  @endif
                </div>
              </div>
              <button type="button" data-reset-password="{{ json_encode(['id' => $a['id'], 'email' => $a['email'] ?? null, 'phone' => $a['phone'] ?? null, 'firstName' => $a['firstName'], 'lastName' => $a['lastName']]) }}" class="btn-secondary shrink-0 self-start whitespace-nowrap px-3 py-1.5 text-sm sm:self-center">
                <x-icon name="key-round" :size="14" /> Reset password
              </button>
            </div>
          @endforeach
        </div>
        <div class="border-t border-gray-100">
          <x-per-page :total="$loginsMeta['total']" :page="$loginsMeta['page']" :per-page="$perPage" :options="D::PER_PAGE_OPTIONS" />
        </div>
      @endif
    </div>
    <x-pager :page="$loginsMeta['page']" :total-pages="$loginsMeta['totalPages']" />
  @endif

  @if (in_array($tab, ['leads', 'bookings'], true))
    @php
        $items = $list['data'] ?? [];
        $statuses = $tab === 'leads' ? D::LEAD_STATUSES : D::BOOKING_STATUSES;
    @endphp
    <div class="card overflow-hidden">
      <div class="flex flex-wrap items-center justify-between gap-3 border-b border-gray-100 px-5 py-4">
        <h2 class="font-semibold text-ink-900">{{ $tab === 'leads' ? 'Leads' : 'Bookings' }}</h2>
        <form method="GET" action="/dashboard" class="w-full sm:w-72">
          <input type="hidden" name="tab" value="{{ $tab }}" />
          <select name="business" class="input py-2 text-sm" data-autosubmit aria-label="Business">
            @foreach ($businesses as $b)
              <option value="{{ $b['id'] }}" @selected($b['id'] === $selectedId)>{{ $b['name'] }}</option>
            @endforeach
          </select>
        </form>
      </div>
      <div class="divide-y divide-gray-100">
        @foreach ($items as $item)
          <div class="flex items-center justify-between gap-3 px-5 py-3.5">
            <div class="min-w-0">
              @if ($tab === 'leads')
                <p class="text-sm font-semibold text-ink-900">{{ $item['name'] }} <span class="font-normal text-ink-500">· {{ $item['phone'] }}</span></p>
                @if (! empty($item['message']))
                  <p class="mt-0.5 truncate text-sm text-ink-600">{{ $item['message'] }}</p>
                @endif
              @else
                <p class="text-sm font-semibold text-ink-900">{{ $item['service']['name'] ?? '' }}</p>
                <p class="mt-0.5 text-sm text-ink-500" data-local-datetime="{{ $item['scheduledAt'] }}">{{ $item['scheduledAt'] }}</p>
              @endif
            </div>
            <select data-status-update="{{ $tab === 'leads' ? "/leads/{$item['id']}/status" : "/bookings/{$item['id']}/status" }}" class="shrink-0 rounded-md border-0 py-1 text-xs font-semibold ring-1 ring-inset {{ $badge($item['status']) }}" aria-label="Status">
              @foreach ($statuses as $s)
                <option value="{{ $s }}" @selected($item['status'] === $s)>{{ ucfirst(strtolower(str_replace('_', ' ', $s))) }}</option>
              @endforeach
            </select>
          </div>
        @endforeach
        @if (count($items) === 0)
          <div class="px-5 py-12 text-center text-sm text-ink-500">{{ $tab === 'leads' ? 'No leads yet.' : 'No bookings yet.' }}</div>
        @endif
      </div>
    </div>
    @if ($list)
      <x-pager :page="$list['meta']['page']" :total-pages="$list['meta']['totalPages']" />
    @endif
  @endif

  @php
      $dashData = [
          'isDealer' => $isDealer,
          'canAssignOwner' => $canAssignOwner,
      ];
  @endphp
  <script type="application/json" id="dashboard-data">@json($dashData)</script>
@endsection

@push('scripts')
  @vite('resources/js/pages/dashboard.js')
@endpush
