@extends('layouts.app')

@section('title', 'Add a business')

{{-- The "Add a business" form on its own page (/dashboard/businesses/new),
     reached from the dashboard's "Add business" button. Submitted by
     resources/js/pages/business-create.js. --}}
@section('content')
  <div class="mx-auto max-w-3xl">
    <div class="mb-4 flex items-center gap-3">
      <a href="/dashboard" class="btn-secondary px-3 py-2 text-sm"><x-icon name="arrow-left" :size="15" /> Back</a>
      <h1 class="text-xl font-bold tracking-tight text-ink-900">Add a business</h1>
    </div>

    @if ($outOfPoints)
      <div class="card p-6 text-center">
        <p class="font-semibold text-red-700">No points left</p>
        <p class="mt-1 text-sm text-ink-500">Adding a business uses {{ $points['pointsPerBusiness'] ?? 1 }} point. Contact the admin to add more.</p>
        <a href="/dashboard" class="btn-secondary mt-4 inline-flex px-4 py-2 text-sm">Back to dashboard</a>
      </div>
    @else
      @include('pages.dashboard.partials.create-business')
    @endif
  </div>

  <script type="application/json" id="dashboard-data">@json(['isDealer' => $isDealer, 'canAssignOwner' => $canAssignOwner])</script>
@endsection

@push('scripts')
  @vite('resources/js/pages/business-create.js')
@endpush
