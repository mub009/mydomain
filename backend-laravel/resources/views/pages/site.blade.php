@extends('layouts.bare')

@section('title', ($site['business']['seoTitle'] ?? null) ?: $site['business']['name'].' — Website')
@section('description', \App\Support\Seo\SeoMeta::description($site['business']))

@push('head')
  {{-- Served at both <slug>.<domain> and /site/<slug>; search engines are
       told the subdomain (when there is one) is the one to list. --}}
  @include('partials.seo-tags', ['biz' => $site['business'], 'url' => \App\Support\Seo\SeoTracker::websiteUrl($site['business']['slug'])])
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
    {{-- The gallery slider (App\Support\SiteBuilder\Helpers::gallerySlider):
         shared across every template, since the carousel is the same widget
         everywhere even though each template's own CSS gives it a different
         surrounding section. --}}
    #mk-site-root .gallery_slider{padding-bottom:34px}
    #mk-site-root .gallery_slider .swiper-slide{width:280px;flex-shrink:0;border-radius:10px;overflow:hidden;border:4px solid #fff;box-shadow:0 6px 18px rgba(0,0,0,.12);background:#fff}
    #mk-site-root .gallery_slider .swiper-slide a{display:block}
    #mk-site-root .gallery_slider .swiper-slide img{width:100%;aspect-ratio:4/3;object-fit:cover;display:block}
    #mk-site-root .gallery_slider .mk-gallery-caption{display:block;padding:8px 10px;font-size:13px;font-weight:600;line-height:1.3;text-align:center;color:#1a1a1a}
    #mk-site-root .gallery_slider .swiper-pagination-bullet{background:#1a1a1a}
    {!! str_ireplace('</style', '<\/style', $site['css']) !!}
  </style>
@endpush

@section('content')
  <div class="mk-site-page">
    {{-- Builder markup, sanitized (scripts and handlers stripped) on save. --}}
    <div id="mk-site-root" data-business-id="{{ $site['business']['id'] }}">{!! $site['html'] !!}</div>

    {{-- Small attribution back to the listing, kept out of the site's design. --}}
    <p class="bg-white py-4 text-center text-xs text-gray-400">
      <a href="{{ \App\Support\SiteUrl::markkito('/business/'.$site['business']['slug']) }}" class="hover:text-brand-600 hover:underline">{{ $site['business']['name'] }} on Markkito</a>
    </p>
  </div>
@endsection

@push('scripts')
  @vite('resources/js/pages/site.js')
@endpush
