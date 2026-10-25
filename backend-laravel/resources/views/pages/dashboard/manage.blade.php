@extends('layouts.app')

@section('title', $biz['name'].' · Manage')

@php
    use App\Http\Controllers\Web\DashboardController as D;
    $statusBadge = match ($biz['status']) {
        'PUBLISHED' => 'bg-emerald-50 text-emerald-700',
        'PENDING_APPROVAL' => 'bg-amber-50 text-amber-700',
        'SUSPENDED' => 'bg-red-50 text-red-700',
        default => 'bg-gray-100 text-gray-600',
    };
    $base = "/dashboard/businesses/{$biz['id']}";
@endphp

@section('content')
  <div class="space-y-4">
    <div class="flex items-center justify-between gap-3 flex-wrap">
      <div class="flex items-center gap-3">
        <a href="/dashboard" class="btn-secondary px-3 py-2 text-sm"><x-icon name="arrow-left" :size="15" /> Back</a>
        <div>
          <h2 class="text-lg font-bold text-ink-900">{{ $biz['name'] }}</h2>
          <span class="badge {{ $statusBadge }}">{{ preg_replace('/_/', ' ', $biz['status'], 1) }}</span>
        </div>
      </div>
      <div class="flex items-center gap-2">
        @if ($biz['status'] === 'PUBLISHED')
          <a href="/business/{{ $biz['slug'] }}" class="btn-secondary px-3 py-2 text-sm"><x-icon name="external-link" :size="15" /> View public page</a>
        @endif
        @if (! in_array($biz['status'], ['PUBLISHED', 'PENDING_APPROVAL'], true))
          <button type="button" data-submit-approval class="btn-primary px-3 py-2 text-sm"><x-icon name="send" :size="15" /> Submit for approval</button>
        @endif
      </div>
    </div>

    <p class="text-sm text-brand-700 bg-brand-50 rounded-md px-3 py-2" data-flash hidden></p>
    <p class="text-sm text-red-700 bg-red-50 rounded-md px-3 py-2" data-error hidden></p>

    {{-- Section tabs --}}
    <div class="flex gap-1 overflow-x-auto border-b border-gray-200">
      @foreach (D::SECTIONS as $s)
        <a href="{{ $base }}?section={{ urlencode($s) }}" @class([
            'whitespace-nowrap px-4 py-2.5 text-sm font-semibold border-b-2 -mb-px transition-colors',
            'border-brand-600 text-brand-600' => $section === $s,
            'border-transparent text-ink-500 hover:text-ink-900' => $section !== $s,
        ])>{{ $s }}</a>
      @endforeach
    </div>

    @switch($section)
      @case('Details') @include('pages.dashboard.sections.details') @break
      @case('Hours') @include('pages.dashboard.sections.hours') @break
      @case('Services') @include('pages.dashboard.sections.services') @break
      @case('Photos') @include('pages.dashboard.sections.photos') @break
      @case('Slider') @include('pages.dashboard.sections.image-set', [
          'title' => 'Slider photos',
          'blurb' => 'These photos slide across the banner at the top of your website, in this order.',
          'empty' => 'No slider photos yet. Upload some below — they only appear in the slider.',
          'hint' => 'Wide photos look best.',
      ]) @break
      @case('Our Gallery') @include('pages.dashboard.sections.image-set', [
          'title' => 'Our Gallery',
          'blurb' => 'These photos make up the “Our Gallery” section of your website, in this order.',
          'empty' => 'No gallery photos yet. Upload some below to add an Our Gallery section to your website.',
          'hint' => 'Square or landscape photos look best.',
      ]) @break
      @case('Reviews & QR') @include('pages.dashboard.sections.reviews-qr') @break
      @case('Website') @include('pages.dashboard.sections.website') @break
      @case('Products') @include('pages.dashboard.sections.products') @break
      @case('Orders') @include('pages.dashboard.sections.orders') @break
      @case('Customers') @include('pages.dashboard.sections.customers') @break
    @endswitch
  </div>

  @php
      $manageData = ['id' => $biz['id'], 'slug' => $biz['slug'], 'name' => $biz['name'], 'section' => $section];
  @endphp
  <script type="application/json" id="manage-data">@json($manageData)</script>
@endsection

@push('scripts')
  @vite('resources/js/pages/manage.js')
  @if ($section === 'Website')
    @vite('resources/js/pages/site-builder.js')
  @endif
@endpush
