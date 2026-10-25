@extends('layouts.app')

@section('title', 'My Business Dashboard')

@php
    use App\Http\Controllers\Web\DashboardController as D;
    $badge = fn (string $status) => match ($status) {
        'PUBLISHED', 'CONFIRMED', 'CONVERTED', 'COMPLETED' => 'bg-emerald-50 text-emerald-700',
        'PENDING_APPROVAL', 'PENDING' => 'bg-amber-50 text-amber-700',
        'NEW' => 'bg-brand-50 text-brand-700',
        'CONTACTED' => 'bg-sky-50 text-sky-700',
        'QUALIFIED' => 'bg-violet-50 text-violet-700',
        'SUSPENDED', 'CANCELLED', 'LOST', 'NO_SHOW' => 'bg-red-50 text-red-700',
        default => 'bg-gray-100 text-gray-600',
    };
    $statCards = [
        ['building-2', 'Active listings', $stats['listings'], 'bg-brand-50 text-brand-600'],
    ];
    if ($isDealer) {
        $statCards[] = ['coins', 'Points available', $points['points'] ?? '—', $outOfPoints ? 'bg-red-50 text-red-600' : 'bg-amber-50 text-amber-600'];
    }
    $statCards[] = ['eye', 'Total profile views', $stats['totalViews'], 'bg-sky-50 text-sky-600'];
    $statCards[] = ['message-square', 'Leads received', $stats['totalLeads'], 'bg-violet-50 text-violet-600'];
    $statCards[] = ['star', "Avg rating · {$stats['ratedReviews']} reviews", $stats['avgRating'] > 0 ? number_format($stats['avgRating'], 1) : '—', 'bg-amber-50 text-amber-600'];
@endphp

@section('content')
  {{-- Header banner --}}
  <div class="rounded-2xl bg-gradient-to-r from-brand-800 via-brand-700 to-brand-600 px-6 py-6 sm:px-8 sm:py-7 mb-5 relative overflow-hidden">
    <div class="absolute inset-0 opacity-10 pointer-events-none [background-image:radial-gradient(circle_at_15%_20%,white,transparent_35%),radial-gradient(circle_at_85%_80%,white,transparent_30%)]"></div>
    <div class="relative">
      <p class="text-brand-50/80 text-sm">Welcome back{{ $user->firstName ? ", {$user->firstName}" : '' }} 👋</p>
      <h1 class="text-2xl sm:text-3xl font-extrabold text-white mt-0.5">My Business Dashboard</h1>
      <p class="text-brand-50/80 text-sm mt-1">Manage your listings, leads, bookings, hours, and more.</p>
    </div>
  </div>

  {{-- KPI stats --}}
  <div class="grid grid-cols-2 {{ $isDealer ? 'lg:grid-cols-5' : 'lg:grid-cols-4' }} gap-3 mb-6">
    @foreach ($statCards as [$icon, $label, $value, $tint])
      <div class="card p-4">
        <div class="flex items-center justify-between">
          <span class="flex h-9 w-9 items-center justify-center rounded-lg {{ $tint }}"><x-icon :name="$icon" :size="17" /></span>
        </div>
        <p class="text-2xl font-extrabold text-ink-900 mt-3 leading-none">{{ $value }}</p>
        <p class="text-xs text-ink-500 mt-1">{{ $label }}</p>
      </div>
    @endforeach
  </div>

  @if ($outOfPoints)
    <div class="rounded-xl border border-red-200 bg-red-50 px-4 py-3 mb-5 flex items-start gap-3">
      <span class="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-red-100 text-red-600"><x-icon name="coins" :size="17" /></span>
      <div>
        <p class="font-bold text-red-800 text-sm">You're out of registration points</p>
        <p class="text-xs text-red-700/90 mt-0.5">
          Registering a business costs {{ $points['pointsPerBusiness'] ?? 1 }} point. Please contact the admin to add more
          points to your account. You can still manage your existing listings.
        </p>
      </div>
    </div>
  @endif

  <div class="flex gap-2 mb-6 border-b border-gray-200">
    @foreach ($visibleTabs as $t)
      <a href="/dashboard?tab={{ $t }}" @class([
          'flex items-center gap-1.5 px-4 py-2.5 text-sm font-semibold border-b-2 -mb-px transition-colors',
          'border-brand-600 text-brand-600' => $tab === $t,
          'border-transparent text-ink-500 hover:text-ink-900' => $tab !== $t,
      ])><x-icon :name="D::TABS[$t]['icon']" :size="15" /> {{ D::TABS[$t]['label'] }}</a>
    @endforeach
  </div>

  @if (count($visibleTabs) === 0)
    <div class="card p-8 text-center text-sm text-ink-500">Your account doesn’t have any features enabled yet. Please contact your administrator to grant access.</div>
  @endif

  @if ($tab === 'businesses')
    <div>
      <div class="flex items-center justify-between mb-4">
        <h2 class="font-bold text-ink-900 flex items-center gap-1.5"><x-icon name="building-2" :size="16" class="text-brand-600" /> Your listings</h2>
        <div class="flex items-center gap-2">
          @if ($isDealer && $points && ! $outOfPoints)
            <span class="badge bg-amber-50 text-amber-700 whitespace-nowrap"><x-icon name="coins" :size="11" /> {{ $points['points'] }} points left</span>
          @endif
          <button type="button" data-toggle-create @disabled($outOfPoints) title="{{ $outOfPoints ? 'No points left — contact the admin to add more' : '' }}" class="btn-primary px-3 py-2 text-sm disabled:opacity-50 disabled:cursor-not-allowed">
            <span data-when="closed" class="inline-flex items-center gap-2"><x-icon name="plus" :size="15" /> Add business</span>
            <span data-when="open" class="inline-flex items-center gap-2" hidden><x-icon name="x" :size="15" /> Cancel</span>
          </button>
        </div>
      </div>

      <p class="text-sm text-brand-700 bg-brand-50 rounded-md px-3 py-2 mb-4" data-flash hidden></p>
      <div data-owner-creds></div>

      @include('pages.dashboard.partials.create-business')

      <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
        @forelse ($businesses as $b)
          <div class="card p-4 flex flex-col">
            <div class="flex items-start justify-between gap-2">
              <p class="font-semibold text-ink-900">{{ $b['name'] }}</p>
              <span class="badge {{ $badge($b['status']) }}">{{ preg_replace('/_/', ' ', $b['status'], 1) }}</span>
            </div>
            <p class="text-xs text-ink-500 mt-1 flex items-center gap-1"><x-icon name="map-pin" :size="12" /> {{ $b['city'] }}, {{ $b['state'] }}</p>
            <div class="mt-3 flex gap-2">
              <a href="/dashboard/businesses/{{ $b['id'] }}" class="btn-secondary flex-1 py-2 text-sm"><x-icon name="settings-2" :size="15" /> Manage</a>
              @if ($isDealer)
                <button type="button" data-clone-business="{{ json_encode(['id' => $b['id'], 'name' => $b['name']]) }}" @disabled($outOfPoints) title="{{ $outOfPoints ? 'No points left — contact the admin to add more' : 'Make a draft copy of this business' }}" class="btn-secondary px-3 py-2 text-sm disabled:opacity-50 disabled:cursor-not-allowed"><x-icon name="copy" :size="15" /> Clone</button>
              @endif
            </div>
          </div>
        @empty
          <div class="card p-8 text-center text-sm text-ink-500 sm:col-span-2" data-empty-listings>No businesses yet — click “Add business” to get started.</div>
        @endforelse
      </div>
      <x-pager :page="$bizMeta['page']" :total-pages="$bizMeta['totalPages']" />

      @if ($isDealer && $accounts && count($accounts['data']) > 0)
        <div class="mt-8">
          <h2 class="font-bold text-ink-900 flex items-center gap-1.5 mb-1"><x-icon name="users-round" :size="16" class="text-brand-600" /> Business accounts you created</h2>
          <p class="text-xs text-ink-500 mb-3">Logins you handed out with a listing. If an owner forgets their password, reset it here and share the new one.</p>
          <div class="card divide-y divide-gray-100">
            @foreach ($accounts['data'] as $a)
              <div class="p-4 flex items-center justify-between gap-3">
                <div class="min-w-0">
                  <p class="font-semibold text-sm text-ink-900 truncate">{{ $a['firstName'] }} {{ $a['lastName'] }}</p>
                  <p class="text-xs text-ink-500 truncate">{{ $a['email'] ?? $a['phone'] ?? '' }}</p>
                  @isset($a['_count'])
                    <p class="text-[11px] text-ink-400 mt-0.5">{{ $a['_count']['businesses'] }} {{ $a['_count']['businesses'] === 1 ? 'business' : 'businesses' }}</p>
                  @endisset
                </div>
                <button type="button" data-reset-password="{{ json_encode(['id' => $a['id'], 'email' => $a['email'] ?? null, 'phone' => $a['phone'] ?? null, 'firstName' => $a['firstName'], 'lastName' => $a['lastName']]) }}" class="btn-secondary px-3 py-1.5 text-sm shrink-0 whitespace-nowrap">
                  <x-icon name="key-round" :size="14" /> Reset password
                </button>
              </div>
            @endforeach
          </div>
          @php
              $accountsPager = $accounts['meta'];
          @endphp
          @if ($accountsPager['totalPages'] > 1)
            <div class="flex items-center justify-center gap-2 mt-4 text-sm">
              @if ($accountsPager['page'] > 1)
                <a class="btn-secondary px-3 py-1.5" href="{{ D::url(['accountsPage' => $accountsPager['page'] - 1]) }}"><x-icon name="chevron-left" :size="15" /></a>
              @endif
              <span class="text-ink-500">Page {{ $accountsPager['page'] }} of {{ $accountsPager['totalPages'] }}</span>
              @if ($accountsPager['page'] < $accountsPager['totalPages'])
                <a class="btn-secondary px-3 py-1.5" href="{{ D::url(['accountsPage' => $accountsPager['page'] + 1]) }}"><x-icon name="chevron-right" :size="15" /></a>
              @endif
            </div>
          @endif
        </div>
      @endif
    </div>
  @endif

  @if (in_array($tab, ['leads', 'bookings'], true))
    <div>
      <form method="GET" action="/dashboard">
        <input type="hidden" name="tab" value="{{ $tab }}" />
        <select name="business" class="input sm:w-72 mb-4" data-autosubmit>
          @foreach ($businesses as $b)
            <option value="{{ $b['id'] }}" @selected($b['id'] === $selectedId)>{{ $b['name'] }}</option>
          @endforeach
        </select>
      </form>

      @php
          $items = $list['data'] ?? [];
          $statuses = $tab === 'leads' ? D::LEAD_STATUSES : D::BOOKING_STATUSES;
      @endphp
      <div class="space-y-2">
        @foreach ($items as $item)
          <div class="card p-3.5 flex justify-between items-center gap-3">
            <div class="min-w-0">
              @if ($tab === 'leads')
                <p class="font-semibold text-sm text-ink-900">{{ $item['name'] }} <span class="text-ink-500 font-normal">— {{ $item['phone'] }}</span></p>
                @if (! empty($item['message']))
                  <p class="text-sm text-ink-600 mt-0.5 truncate">{{ $item['message'] }}</p>
                @endif
              @else
                <p class="font-semibold text-sm text-ink-900">{{ $item['service']['name'] ?? '' }}</p>
                <p class="text-sm text-ink-500 mt-0.5" data-local-datetime="{{ $item['scheduledAt'] }}">{{ $item['scheduledAt'] }}</p>
              @endif
            </div>
            <select data-status-update="{{ $tab === 'leads' ? "/leads/{$item['id']}/status" : "/bookings/{$item['id']}/status" }}" class="badge border-0 shrink-0 {{ $badge($item['status']) }}">
              @foreach ($statuses as $s)
                <option value="{{ $s }}" @selected($item['status'] === $s)>{{ $s }}</option>
              @endforeach
            </select>
          </div>
        @endforeach
        @if (count($items) === 0)
          <div class="card p-6 text-center text-sm text-ink-500">{{ $tab === 'leads' ? 'No leads yet.' : 'No bookings yet.' }}</div>
        @endif
        @if ($list)
          <x-pager :page="$list['meta']['page']" :total-pages="$list['meta']['totalPages']" />
        @endif
      </div>
    </div>
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
