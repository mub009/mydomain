@php
    use App\Support\Seo\SeoMeta;
    $stageBadge = [
        'INDEXED' => ['On Google', 'bg-emerald-50 text-emerald-700', 'check-circle-2'],
        'WAITING' => ['Waiting for Google', 'bg-amber-50 text-amber-700', 'clock'],
        'OVERDUE' => ['Not on Google yet', 'bg-red-50 text-red-700', 'alert-triangle'],
    ];
    $kindLabel = ['LISTING' => 'Listing page', 'WEBSITE' => 'Website'];
@endphp
@if (! $seo)
  <p class="text-sm text-red-700 bg-red-50 rounded-md px-3 py-2">Could not load your SEO details.</p>
@else
  @php
      $checklist = collect($seo['checklist'])->sortBy('ok')->values();
      $score = $seo['score'];
      $scoreTint = $score >= 80 ? 'text-emerald-600' : ($score >= 50 ? 'text-amber-600' : 'text-red-600');
      $days = intdiv($seo['targetHours'], 24);
  @endphp
  <div class="grid gap-4 lg:grid-cols-5">
    <form class="card p-5 space-y-4 lg:col-span-3" data-seo-form>
      <div>
        <h3 class="font-bold text-ink-900 flex items-center gap-1.5"><x-icon name="search-check" :size="16" class="text-brand-600" /> How you appear on Google</h3>
        <p class="text-xs text-ink-500 mt-1">Leave a box empty and we write it from your listing.</p>
      </div>

      {{-- What a Google result for the listing would look like. --}}
      <div class="rounded-lg border border-gray-200 bg-white p-4" data-seo-preview>
        <p class="text-xs text-ink-500 truncate">{{ $seo['preview']['url'] }}</p>
        <p class="text-lg leading-snug text-[#1a0dab] truncate mt-0.5" data-preview-title data-fallback="{{ $seo['preview']['title'] }}">{{ $seo['preview']['title'] }}</p>
        <p class="text-sm text-ink-600 mt-1 line-clamp-2" data-preview-description data-fallback="{{ $seo['preview']['description'] }}">{{ $seo['preview']['description'] }}</p>
      </div>

      <div>
        <div class="flex items-baseline justify-between mb-1">
          <label class="block text-xs font-semibold text-ink-700">SEO title</label>
          <span class="text-xs text-ink-400" data-counter="seoTitle" data-max="{{ SeoMeta::TITLE_MAX }}"></span>
        </div>
        <input name="seoTitle" maxlength="70" value="{{ $seo['seoTitle'] ?? '' }}" class="input" placeholder="e.g. {{ $biz['name'] }} — best {{ strtolower($biz['category']['name'] ?? 'service') }} in {{ $biz['city'] ?? 'your city' }}" />
      </div>
      <div>
        <div class="flex items-baseline justify-between mb-1">
          <label class="block text-xs font-semibold text-ink-700">Meta description</label>
          <span class="text-xs text-ink-400" data-counter="seoDescription" data-max="{{ SeoMeta::DESCRIPTION_MAX }}"></span>
        </div>
        <textarea name="seoDescription" maxlength="170" rows="3" class="input" placeholder="One or two sentences on what you offer and why people choose you.">{{ $seo['seoDescription'] ?? '' }}</textarea>
      </div>
      <div>
        <label class="block text-xs font-semibold text-ink-700 mb-1">Keywords</label>
        <input name="seoKeywords" maxlength="255" value="{{ $seo['seoKeywords'] ?? '' }}" class="input" placeholder="e.g. bakery, birthday cakes, {{ $biz['city'] ?? 'your city' }}" />
        <p class="text-xs text-ink-400 mt-1">Words customers type to find you, separated by commas.</p>
      </div>
      <button class="btn-primary px-5 py-2.5" data-save>Save SEO</button>
    </form>

    <div class="card p-5 lg:col-span-2">
      <div class="flex items-center gap-4">
        <p class="text-4xl font-extrabold leading-none {{ $scoreTint }}">{{ $score }}<span class="text-lg text-ink-400">/100</span></p>
        <div>
          <p class="font-bold text-ink-900">SEO score</p>
          <p class="text-xs text-ink-500">Tick these off to rank higher.</p>
        </div>
      </div>
      <ul class="mt-4 space-y-2.5">
        @foreach ($checklist as $item)
          <li class="flex gap-2 text-sm">
            @if ($item['ok'])
              <x-icon name="check-circle-2" :size="16" class="mt-0.5 shrink-0 text-emerald-600" />
              <span class="text-ink-700">{{ $item['label'] }}</span>
            @else
              <x-icon name="alert-triangle" :size="16" class="mt-0.5 shrink-0 text-amber-500" />
              <span><span class="font-semibold text-ink-900">{{ $item['label'] }}</span><span class="block text-xs text-ink-500">{{ $item['tip'] }}</span></span>
            @endif
          </li>
        @endforeach
      </ul>
    </div>
  </div>

  <div class="card p-5">
    <h3 class="font-bold text-ink-900 flex items-center gap-1.5"><x-icon name="globe" :size="16" class="text-brand-600" /> Google listing</h3>
    <p class="text-xs text-ink-500 mt-1">
      New pages are sent to Google as soon as they go live. Most show up within {{ $days }} days; Google decides the exact timing.
    </p>
    @if (! $seo['googleConnected'])
      <p class="mt-3 text-xs text-ink-600 bg-gray-50 rounded-md px-3 py-2">Automatic Google submission is not switched on for Markkito yet. Your pages are still in our sitemap, so Google can find them on its own.</p>
    @endif
    @if (count($seo['pages']) === 0)
      <p class="mt-4 text-sm text-ink-500">Nothing to send yet — your pages go to Google once your listing is published.</p>
    @else
      <div class="mt-4 divide-y divide-gray-100">
        @foreach ($seo['pages'] as $page)
          @php [$badgeLabel, $badgeTint, $badgeIcon] = $stageBadge[$page['stage']]; @endphp
          <div class="flex flex-col gap-2 py-3 first:pt-0 last:pb-0 sm:flex-row sm:items-center sm:justify-between">
            <div class="min-w-0">
              <p class="text-sm font-semibold text-ink-900">{{ $kindLabel[$page['kind']] ?? $page['kind'] }}</p>
              <a href="{{ $page['url'] }}" target="_blank" rel="noopener" class="block truncate text-xs text-brand-700 hover:underline">{{ $page['url'] }}</a>
              <p class="text-xs text-ink-500 mt-0.5">
                @if ($page['indexedAt'])
                  On Google since {{ \Illuminate\Support\Carbon::parse($page['indexedAt'])->format('j M Y') }}
                @elseif ($page['submittedAt'] && ! $page['submitError'])
                  Sent to Google {{ \Illuminate\Support\Carbon::parse($page['submittedAt'])->diffForHumans() }}
                @else
                  Live since {{ \Illuminate\Support\Carbon::parse($page['createdAt'])->diffForHumans() }}
                @endif
                @if ($page['checkedAt'] && $page['coverageState'] && $page['indexStatus'] !== 'INDEXED')
                  · Google says: “{{ $page['coverageState'] }}”
                @endif
              </p>
            </div>
            <span class="badge {{ $badgeTint }} shrink-0 self-start sm:self-center"><x-icon :name="$badgeIcon" :size="12" /> {{ $badgeLabel }}</span>
          </div>
        @endforeach
      </div>
    @endif
  </div>
@endif
