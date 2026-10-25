<!doctype html>
<html lang="en">
  <head>
    @include('partials.head')
    @stack('head')
  </head>
  <body>
    @yield('content')
    @stack('scripts')
  </body>
</html>
