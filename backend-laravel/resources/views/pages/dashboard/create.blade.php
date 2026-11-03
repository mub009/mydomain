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

    {{-- The listing is free; points go on its features, picked in the form. --}}
    @include('pages.dashboard.partials.create-business')
  </div>

  <script type="application/json" id="dashboard-data">@json(['isDealer' => $isDealer, 'canAssignOwner' => $canAssignOwner])</script>
@endsection

@push('scripts')
  @vite('resources/js/pages/business-create.js')
@endpush
