{{-- Social Media: the business's Google Maps place and social profiles (Instagram, Facebook and
     YouTube columns, plus the others in businesses.socialLinks — see
     App\Support\SocialLinks). Saved through the review-links endpoint;
     shown on One Review, the visiting card and the QR boards. --}}
@php
    $main = [
        ['instagramUsername', 'Instagram', 'instagram', 'text-pink-600', '@yourshop'],
        ['facebookPageUrl', 'Facebook page', 'facebook', 'text-blue-600', 'yourshop or https://facebook.com/yourshop'],
        ['youtubeUrl', 'YouTube channel', 'youtube', 'text-red-600', '@yourshop or a full YouTube link'],
    ];
@endphp

@if (! $links)
  <p class="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">Could not load the social media links.</p>
@else
  <form class="card max-w-2xl space-y-4 p-5" data-social-links-form>
    <div>
      <h3 class="flex items-center gap-1.5 font-bold text-ink-900"><x-icon name="share-2" :size="16" class="text-brand-600" /> Google Maps & social media</h3>
      <p class="mt-0.5 text-xs text-ink-500">Connect Google Maps so customers can review you, then add your social profiles — a username or the full link. They show on your One Review page, visiting card and QR boards. Leave a box empty to hide that network.</p>
    </div>

    {{-- Google Maps: the Place ID (or a Maps share link) gives the review link and directions. --}}
    <div class="space-y-3 rounded-xl border border-gray-200 p-4">
      <p class="flex items-center gap-1.5 text-sm font-bold text-ink-900"><x-icon name="map-pin" :size="15" class="text-amber-600" /> Google Maps</p>
      {{-- Google Places search (GooglePlaces): pick the business, its Place ID is saved. --}}
      @if (! empty($links['placesSearch']))
        <div class="rounded-lg border border-amber-200 bg-amber-50/60 p-3" data-places-search>
          <p class="flex items-center gap-1.5 text-xs font-bold text-ink-900"><x-icon name="search" :size="13" class="text-amber-600" /> Find your business on Google</p>
          <p class="mt-0.5 text-[11px] text-ink-500">Search, tap your business, done. We save its Place ID for you.</p>
          <div class="mt-2 flex gap-2">
            <input class="input py-2" data-places-query value="{{ trim($biz['name'].' '.($biz['city'] ?? '')) }}" aria-label="Business name and city" />
            <button type="button" class="btn-primary shrink-0 px-3 py-2 text-sm" data-places-go><x-icon name="search" :size="14" /> <span>Search</span></button>
          </div>
          <ul class="mt-2 space-y-1.5" data-places-results></ul>
        </div>
      @endif

      <div>
        <label class="mb-1 block text-xs font-semibold text-ink-700">Google Place ID</label>
        <input class="input" name="googlePlaceId" placeholder="ChIJN1t_tDeuEmsRUsoyG83frY4 — or paste a Google Maps link" value="{{ $links['googlePlaceId'] ?? '' }}" />
        <p class="mt-1 text-[11px] text-ink-400">
          Find it at <a href="https://developers.google.com/maps/documentation/places/web-service/place-id" target="_blank" rel="noreferrer" class="text-brand-600 hover:underline">Google's Place ID finder</a>. We build the “write a review” link from it.
        </p>
      </div>
      <div>
        <label class="mb-1 block text-xs font-semibold text-ink-700">Google Maps share link or review link</label>
        <input class="input" name="googleReviewUrl" placeholder="https://maps.app.goo.gl/…" value="{{ $links['googleReviewUrl'] ?? '' }}" />
        <p class="mt-1 text-[11px] text-ink-400">
          Easiest: open your business in Google Maps, tap <b>Share</b>, copy the link and paste it here. We find your place and fill in the Place ID for you.
        </p>
      </div>
    </div>

    <div class="grid gap-3 sm:grid-cols-2">
      @foreach ($main as [$field, $label, $icon, $tint, $placeholder])
        <div>
          <label class="mb-1 flex items-center gap-1.5 text-xs font-semibold text-ink-700"><x-icon :name="$icon" :size="13" :class="$tint" /> {{ $label }}</label>
          <input class="input" name="{{ $field }}" placeholder="{{ $placeholder }}" value="{{ $links[$field] ?? '' }}" />
        </div>
      @endforeach
      @foreach (\App\Support\SocialLinks::NETWORKS as [$label, $field, $placeholder])
        <div>
          <label class="mb-1 block text-xs font-semibold text-ink-700">{{ $label }}</label>
          <input class="input" name="{{ $field }}" placeholder="{{ $placeholder }}" value="{{ $links[$field] ?? '' }}" />
        </div>
      @endforeach
    </div>

    <button class="btn-primary w-full py-2.5 sm:w-auto sm:px-6" data-save>Save links</button>
  </form>
@endif
