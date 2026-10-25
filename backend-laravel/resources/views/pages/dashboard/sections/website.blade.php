{{-- Website builder for this business. The first draft is generated
     server-side from the listing's own data; from then on the saved
     document is the source of truth. Drawn by site-builder.js (GrapesJS). --}}
@if (! $site)
  <p class="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">Could not open the website builder.</p>
@else
  <div class="space-y-3" data-site-builder></div>
  @php
      $builderData = [
          'business' => ['id' => $biz['id'], 'slug' => $biz['slug'], 'name' => $biz['name'], 'photos' => array_column($biz['photos'] ?? [], 'url')],
          'site' => $site,
      ];
  @endphp
  <script type="application/json" id="site-builder-data">@json($builderData)</script>
@endif
