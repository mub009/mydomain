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
@endphp

@section('content')
  <div class="rounded-2xl bg-gradient-to-r from-ink-900 to-brand-800 px-6 py-6 sm:px-8 sm:py-7 mb-5">
    <h1 class="text-2xl sm:text-3xl font-extrabold text-white">Admin Console</h1>
    <p class="text-white/70 text-sm mt-1">Manage users, dealers, businesses, and platform data.</p>
  </div>

  <p class="text-sm text-emerald-800 bg-emerald-50 rounded-md px-3 py-2 mb-4" data-flash hidden></p>
  <p class="text-sm text-red-700 bg-red-50 rounded-md px-3 py-2 mb-4" data-error hidden></p>

  <div class="flex gap-1 mb-6 border-b border-gray-200 overflow-x-auto">
    @foreach (A::TABS as $t)
      <a href="/admin?tab={{ urlencode($t) }}" @class([
          'px-4 py-2.5 text-sm font-semibold border-b-2 -mb-px whitespace-nowrap transition-colors',
          'border-brand-600 text-brand-600' => $tab === $t,
          'border-transparent text-ink-500 hover:text-ink-900' => $tab !== $t,
      ])>
        {{ $t }}
        @if ($t === 'Approvals' && ($stats['pendingBusinessCount'] ?? 0) > 0)
          <span class="ml-1.5 badge bg-amber-100 text-amber-700 !px-1.5 !py-0">{{ $stats['pendingBusinessCount'] }}</span>
        @endif
      </a>
    @endforeach
  </div>

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
@endsection

@push('scripts')
  @vite('resources/js/pages/admin.js')
@endpush
