{{-- Search and share tags for one business page: the canonical address,
     keywords, Open Graph / Twitter cards, and schema.org LocalBusiness
     data. Expects $biz (the business payload) and $url (the page's
     canonical address). Title and description come from the page's
     'title' / 'description' sections. --}}
@php
    use App\Support\Seo\SeoMeta;
    $seoTitle = SeoMeta::title($biz);
    $seoDescription = SeoMeta::description($biz);
    $seoImage = SeoMeta::image($biz);
@endphp
<link rel="canonical" href="{{ $url }}" />
<meta name="keywords" content="{{ SeoMeta::keywords($biz) }}" />
<meta property="og:type" content="business.business" />
<meta property="og:site_name" content="Markkito" />
<meta property="og:title" content="{{ $seoTitle }}" />
<meta property="og:description" content="{{ $seoDescription }}" />
<meta property="og:url" content="{{ $url }}" />
@if ($seoImage)
  <meta property="og:image" content="{{ $seoImage }}" />
  @if (str_starts_with($seoImage, 'https://'))
    <meta property="og:image:secure_url" content="{{ $seoImage }}" />
  @endif
  @if (SeoMeta::imageIsShareCard($biz))
    <meta property="og:image:type" content="image/jpeg" />
    <meta property="og:image:width" content="{{ \App\Http\Controllers\Web\ShareImageController::WIDTH }}" />
    <meta property="og:image:height" content="{{ \App\Http\Controllers\Web\ShareImageController::HEIGHT }}" />
  @endif
  <meta property="og:image:alt" content="{{ $biz['name'] }}{{ SeoMeta::imageIsShareCard($biz) ? ' logo' : '' }}" />
  <meta name="twitter:image" content="{{ $seoImage }}" />
@endif
<meta name="twitter:card" content="{{ $seoImage ? 'summary_large_image' : 'summary' }}" />
<meta name="twitter:title" content="{{ $seoTitle }}" />
<meta name="twitter:description" content="{{ $seoDescription }}" />
<script type="application/ld+json">{!! json_encode(SeoMeta::jsonLd($biz, $url), JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE | JSON_HEX_TAG) !!}</script>
