@extends('layouts.app')

@section('title', 'Activate your review QR board')

@section('content')
  {{-- Where a shop lands after scanning a pre-printed board that isn't
       attached to a business yet: confirm the code, pick the business,
       activate. Drawn by resources/js/pages/qr-claim.js. --}}
  <div class="mx-auto max-w-md" data-qr-claim></div>

  @php
      $claimData = [
          'code' => $code,
          'unknown' => $unknown,
          'canClaim' => $authUser && in_array($authUser->role, ['BUSINESS_OWNER', 'DEALER', 'ADMIN'], true),
          'role' => $authUser?->role,
      ];
  @endphp
  <script type="application/json" id="qr-claim-data">@json($claimData)</script>
@endsection

@push('scripts')
  @vite('resources/js/pages/qr-claim.js')
@endpush
