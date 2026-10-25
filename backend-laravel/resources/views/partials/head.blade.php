<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
{{-- Without this, iOS Safari auto-links recognized phone numbers/addresses
     inside the page, injecting extra elements into flex containers like
     the business address line and breaking their layout (each detected
     phrase becomes its own flex item and gets squeezed to a sliver). --}}
<meta name="format-detection" content="telephone=no, date=no, address=no, email=no" />
<meta name="csrf-token" content="{{ csrf_token() }}" />
@if ($authUser)
  <meta name="auth-user" content="{{ json_encode(['id' => $authUser->id, 'role' => $authUser->role, 'firstName' => $authUser->firstName, 'privileges' => \App\Support\Privileges::normalize($authUser->privileges)]) }}" />
@endif
<title>@hasSection('title')@yield('title') · Markkito @else Markkito — Local Business Directory &amp; Marketplace @endif</title>
<meta name="description" content="@yield('description', 'Find trusted local businesses near you — phone numbers, addresses, opening hours, photos and verified reviews on Markkito.')" />
{{-- Work screens and sign-in pages stay out of search results. --}}
@if (request()->is('dashboard', 'dashboard/*', 'admin', 'admin/*', 'login', 'register'))
  <meta name="robots" content="noindex, nofollow" />
@endif
@vite(['resources/css/app.css', 'resources/js/app.js'])
