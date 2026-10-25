@extends('layouts.bare')

@section('title', $site['business']['name'].' — Website')

@push('head')
  @if ($fontUrl = \App\Support\SiteBuilder\TemplateRegistry::fontUrl($site['templateId'] ?? null))
    <link rel="stylesheet" href="{{ $fontUrl }}" />
  @endif
  {{-- The site owns the whole page. Its CSS was namespaced under the root
       when it was saved, but the root itself must stay a plain block in
       normal flow — no transform, filter or overflow — or the page's own
       `position: sticky` header would have nothing to stick to. --}}
  <style>
    .mk-site-page{background:#fff}
    #mk-site-root{display:block;font-family:system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;color:#1a1a1a;line-height:1.5}
    #mk-site-root *{box-sizing:border-box}
    #mk-site-root img{max-width:100%}
    {!! str_ireplace('</style', '<\/style', $site['css']) !!}
  </style>
@endpush

@section('content')
  <div class="mk-site-page">
    {{-- Builder markup, sanitized (scripts and handlers stripped) on save. --}}
    <div id="mk-site-root" data-business-id="{{ $site['business']['id'] }}">{!! $site['html'] !!}</div>

    {{-- Small attribution back to the listing, kept out of the site's design. --}}
    <p class="bg-white py-4 text-center text-xs text-gray-400">
      <a href="/business/{{ $site['business']['slug'] }}" class="hover:text-brand-600 hover:underline">{{ $site['business']['name'] }} on Markkito</a>
    </p>
  </div>
@endsection

@push('scripts')
  @vite('resources/js/pages/site.js')
@endpush
