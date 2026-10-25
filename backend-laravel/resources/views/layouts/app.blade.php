@php
    $navLinks = [['/', 'Search'], ['/b2b', 'B2B Directory']];
    if ($authUser && in_array($authUser->role, ['BUSINESS_OWNER', 'DEALER'], true)) {
        $navLinks[] = ['/dashboard', $authUser->role === 'DEALER' ? 'Dashboard' : 'My Business'];
    }
    if ($authUser && $authUser->role === 'ADMIN') {
        $navLinks[] = ['/admin', 'Admin'];
    }
    // The dashboards (dealer, business owner, admin) are work screens: they
    // get a one-line footer and no visitor welcome popup.
    $isPanel = request()->is('dashboard', 'dashboard/*', 'admin', 'admin/*');
    $socialLinks = [
        ['Facebook', 'facebook', 'bg-[#1877F2]'],
        ['YouTube', 'youtube', 'bg-[#FF0000]'],
        ['Instagram', 'instagram', 'bg-gradient-to-br from-[#f9ce34] via-[#ee2a7b] to-[#6228d7]'],
        ['LinkedIn', 'linkedin', 'bg-[#0A66C2]'],
        ['X (Twitter)', 'twitter', 'bg-ink-900'],
    ];
    $serviceHighlights = [
        ['search-check', 'Local search & discovery', 'Find nearby businesses by category, city, or live location, and compare verified ratings before you reach out.'],
        ['briefcase', 'B2B directory', 'Browse verified suppliers and wholesalers directly — the same search and listing pages, filtered to businesses that serve other businesses.'],
        ['calendar-check-2', 'Bookings & appointments', 'Check real-time availability and book services directly with local businesses, no phone tag required.'],
        ['shield-check', 'Verified reviews & ratings', "Every review comes from a real customer, so you can trust what you're reading before you decide."],
    ];
@endphp
<!doctype html>
<html lang="en">
  <head>
    @include('partials.head')
  </head>
  <body>
    <div class="min-h-screen flex flex-col bg-gray-50">
      <header class="sticky top-0 z-30 border-b border-gray-200 bg-white/95 backdrop-blur">
        <div class="container-page flex h-16 items-center justify-between gap-4">
          <a href="/" class="flex items-center gap-2 shrink-0">
            <span class="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-600 text-white shadow-sm">
              <x-icon name="building-2" :size="20" stroke-width="2.25" />
            </span>
            <span class="text-xl font-extrabold tracking-tight text-ink-900">Mark<span class="text-brand-600">kito</span></span>
          </a>

          <nav class="hidden md:flex items-center gap-1">
            @foreach ($navLinks as [$href, $label])
              <a href="{{ $href }}" class="px-3 py-2 rounded-md text-sm font-medium text-ink-700 hover:text-brand-600 hover:bg-brand-50 transition-colors">{{ $label }}</a>
            @endforeach
          </nav>

          <div class="hidden md:flex items-center gap-3">
            @if ($authUser)
              <div class="flex items-center gap-3">
                <span class="flex items-center gap-1.5 text-sm text-ink-700">
                  <span class="flex h-7 w-7 items-center justify-center rounded-full bg-brand-100 text-brand-700">
                    <x-icon name="user" :size="14" />
                  </span>
                  {{ $authUser->firstName }}
                </span>
                <form method="POST" action="/logout">
                  @csrf
                  <button class="btn-ghost text-sm px-2.5 py-1.5"><x-icon name="log-out" :size="15" /> Log out</button>
                </form>
              </div>
            @else
              <div class="flex items-center gap-2">
                <a href="/login" class="btn-ghost text-sm px-3 py-1.5"><x-icon name="log-in" :size="15" /> Log in</a>
                <a href="/register" class="btn-primary text-sm px-4 py-1.5"><x-icon name="user-plus" :size="15" /> Sign up</a>
              </div>
            @endif
          </div>

          <button class="md:hidden p-2 -mr-2 text-ink-700" data-menu-toggle aria-label="Toggle menu" aria-expanded="false">
            <span data-menu-icon="closed"><x-icon name="menu" :size="22" /></span>
            <span data-menu-icon="open" hidden><x-icon name="x" :size="22" /></span>
          </button>
        </div>

        <div class="md:hidden border-t border-gray-200 bg-white" data-menu hidden>
          <div class="container-page py-3 flex flex-col gap-1">
            @foreach ($navLinks as [$href, $label])
              <a href="{{ $href }}" class="px-3 py-2.5 rounded-md text-sm font-medium text-ink-700 hover:bg-brand-50 hover:text-brand-600">{{ $label }}</a>
            @endforeach
            <div class="h-px bg-gray-200 my-1"></div>
            @if ($authUser)
              <form method="POST" action="/logout">
                @csrf
                <button class="w-full px-3 py-2.5 rounded-md text-sm font-medium text-left text-ink-700 hover:bg-gray-50 flex items-center gap-2">
                  <x-icon name="log-out" :size="15" /> Log out
                </button>
              </form>
            @else
              <div class="flex gap-2 px-3 pt-1">
                <a href="/login" class="btn-secondary flex-1 py-2.5 text-sm"><x-icon name="log-in" :size="15" /> Log in</a>
                <a href="/register" class="btn-primary flex-1 py-2.5 text-sm"><x-icon name="user-plus" :size="15" /> Sign up</a>
              </div>
            @endif
          </div>
        </div>
      </header>

      <main class="flex-1 container-page py-6 sm:py-8">
        @yield('content')
      </main>

      @if ($isPanel)
      <footer class="border-t border-gray-200 bg-white">
        <div class="container-page flex flex-wrap items-center justify-between gap-2 py-4 text-xs text-ink-500">
          <span>&copy; {{ now()->year }} Markkito</span>
          <a href="/" class="hover:text-brand-600">Go to the directory</a>
        </div>
      </footer>
      @else
      <footer class="border-t border-gray-200 bg-white mt-8">
        <div class="container-page py-4 flex items-center justify-between border-b border-gray-100">
          <div class="flex items-center gap-3">
            <span class="text-sm font-semibold text-ink-900">Follow us on</span>
            <div class="flex items-center gap-2">
              @foreach ($socialLinks as [$label, $icon, $class])
                <a href="#" aria-label="{{ $label }}" title="{{ $label }}" class="flex h-8 w-8 items-center justify-center rounded-full text-white hover:opacity-90 transition-opacity {{ $class }}">
                  <x-icon :name="$icon" :size="15" />
                </a>
              @endforeach
            </div>
          </div>
        </div>

        <div class="container-page py-10">
          <h2 class="text-xl font-bold text-ink-900 mb-4">Your one-stop platform for local businesses, services &amp; stores</h2>
          <div class="space-y-3 text-sm text-ink-600 leading-relaxed max-w-4xl">
            <p>
              Markkito helps you discover, compare, and connect with local businesses in your area — from
              restaurants and home services to healthcare, wellness, and professional suppliers. Search by
              category or location, check verified ratings and reviews, and reach out directly for quotes,
              bookings, or more information.
            </p>
            <p>
              We list businesses across categories including restaurants, home services, healthcare, beauty
              and wellness, events, and B2B suppliers, with more added as our community of business owners
              grows across cities and towns.
            </p>
            <p>
              List your business for free to start receiving leads, manage bookings and appointments in real
              time, and grow with genuine customer reviews. Sourcing at scale? Browse our B2B directory to find
              and contact verified suppliers and wholesalers directly.
            </p>
          </div>

          <h3 class="text-base font-bold text-ink-900 mt-8 mb-5">Some of our services that will prove useful to you</h3>
          <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            @foreach ($serviceHighlights as [$icon, $title, $description])
              <div>
                <div class="flex items-center gap-2 mb-2">
                  <span class="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-50 text-brand-600"><x-icon :name="$icon" :size="16" /></span>
                  <h4 class="font-semibold text-ink-900 text-sm">{{ $title }}</h4>
                </div>
                <p class="text-xs text-ink-500 leading-relaxed">{{ $description }}</p>
              </div>
            @endforeach
          </div>
        </div>

        <div class="container-page py-10 border-t border-gray-100 grid grid-cols-2 sm:grid-cols-4 gap-8 text-sm">
          <div class="col-span-2 sm:col-span-1">
            <div class="flex items-center gap-2 mb-3">
              <span class="flex h-7 w-7 items-center justify-center rounded-md bg-brand-600 text-white"><x-icon name="building-2" :size="16" /></span>
              <span class="font-bold text-ink-900">Markkito</span>
            </div>
            <p class="text-ink-500 text-xs leading-relaxed">Find, book, and review local businesses — B2C and B2B, in one directory.</p>
          </div>
          <div>
            <h4 class="font-semibold text-ink-900 mb-3 flex items-center gap-1.5"><x-icon name="store" :size="14" /> For customers</h4>
            <ul class="space-y-2 text-ink-500">
              <li><a href="/" class="hover:text-brand-600">Search businesses</a></li>
              <li><a href="/b2b" class="hover:text-brand-600">Browse B2B suppliers</a></li>
            </ul>
          </div>
          <div>
            <h4 class="font-semibold text-ink-900 mb-3 flex items-center gap-1.5"><x-icon name="layout-dashboard" :size="14" /> For businesses</h4>
            <ul class="space-y-2 text-ink-500">
              <li><a href="/dashboard" class="hover:text-brand-600">Owner dashboard</a></li>
              <li><a href="/register" class="hover:text-brand-600">List your business</a></li>
            </ul>
          </div>
          <div>
            <h4 class="font-semibold text-ink-900 mb-3 flex items-center gap-1.5"><x-icon name="shield" :size="14" /> Platform</h4>
            <ul class="space-y-2 text-ink-500">
              <li><a href="/admin" class="hover:text-brand-600">Admin console</a></li>
            </ul>
          </div>
        </div>
        <div class="border-t border-gray-100 py-4 text-center text-xs text-ink-500">Markkito — Local Business Directory &amp; Marketplace</div>
      </footer>
      @endif
    </div>

    @unless ($isPanel)
      @include('partials.welcome-modal')
    @endunless
    @stack('scripts')
  </body>
</html>
