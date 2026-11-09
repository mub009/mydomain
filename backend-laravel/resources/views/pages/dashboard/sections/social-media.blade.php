{{-- Social Media: the business's social profiles (Instagram, Facebook and
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
      <h3 class="flex items-center gap-1.5 font-bold text-ink-900"><x-icon name="share-2" :size="16" class="text-brand-600" /> Social media links</h3>
      <p class="mt-0.5 text-xs text-ink-500">Type a username or paste the full link. They show on your One Review page, visiting card and QR boards. Leave a box empty to hide that network.</p>
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

    <button class="btn-primary w-full py-2.5 sm:w-auto sm:px-6" data-save>Save social links</button>
  </form>
@endif
