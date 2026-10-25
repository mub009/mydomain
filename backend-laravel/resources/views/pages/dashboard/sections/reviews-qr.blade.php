@php
    $channels = [
        ['GOOGLE', 'Google', 'star', 'text-amber-600'],
        ['INSTAGRAM', 'Instagram', 'instagram', 'text-pink-600'],
        ['FACEBOOK', 'Facebook', 'facebook', 'text-blue-600'],
        ['YOUTUBE', 'YouTube', 'youtube', 'text-red-600'],
        ['WEBSITE', 'Website', 'globe', 'text-brand-600'],
        ['DIRECTIONS', 'Directions', 'navigation', 'text-sky-600'],
        // Built from the listing itself, so these two are ready with no setup.
        ['MARKKITO_REVIEW', 'Markkito review', 'message-square-plus', 'text-brand-600'],
        ['MARKKITO', 'Markkito page', 'building-2', 'text-brand-600'],
    ];
    $boardChannels = [
        'GOOGLE' => 'Google review', 'INSTAGRAM' => 'Instagram', 'FACEBOOK' => 'Facebook', 'YOUTUBE' => 'YouTube',
        'WEBSITE' => 'Website', 'DIRECTIONS' => 'Directions to shop', 'MARKKITO_REVIEW' => 'Markkito review', 'MARKKITO' => 'Markkito business page',
    ];
    $resolved = $links['resolved'] ?? [];
    $configured = array_filter($channels, fn ($c) => ! empty($resolved[$c[0]]));
@endphp

@if (! $links)
  <p class="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">Could not load the review settings.</p>
@else
  <div class="space-y-6">
    <div class="grid gap-6 lg:grid-cols-2">
      {{-- Platform IDs --}}
      <form class="card space-y-3 p-5" data-review-links-form>
        <div>
          <h3 class="flex items-center gap-1.5 font-bold text-ink-900"><x-icon name="link-2" :size="16" class="text-brand-600" /> Connect your review pages</h3>
          <p class="mt-0.5 text-xs text-ink-500">Customers who scan your QR board land straight on the page you choose.</p>
        </div>

        {{-- These need no setup, so say so rather than leaving the owner
             wondering why there is no field for them. --}}
        <div class="rounded-lg bg-brand-50/70 px-3 py-2.5">
          <p class="flex items-center gap-1.5 text-xs font-bold text-brand-800"><x-icon name="building-2" :size="13" /> Markkito is ready already</p>
          <p class="mt-1 text-[11px] leading-relaxed text-brand-800/85">
            A board can point at your own Markkito page, or straight at its review form — both are built from your
            listing, so there is nothing to connect here.
            <a href="/business/{{ $biz['slug'] }}?review=1" target="_blank" class="font-semibold underline">See the review page</a>
          </p>
        </div>

        <div>
          <label class="mb-1 block text-xs font-semibold text-ink-700">Google Place ID</label>
          <input class="input" name="googlePlaceId" placeholder="ChIJN1t_tDeuEmsRUsoyG83frY4" value="{{ $links['googlePlaceId'] ?? '' }}" />
          <p class="mt-1 text-[11px] text-ink-400">
            Find it at <a href="https://developers.google.com/maps/documentation/places/web-service/place-id" target="_blank" rel="noreferrer" class="text-brand-600 hover:underline">Google's Place ID finder</a>. We build the “write a review” link from it.
          </p>
        </div>
        <div>
          <label class="mb-1 block text-xs font-semibold text-ink-700">Google review link (optional override)</label>
          <input class="input" name="googleReviewUrl" placeholder="https://g.page/r/…/review" value="{{ $links['googleReviewUrl'] ?? '' }}" />
        </div>
        <div>
          <label class="mb-1 block text-xs font-semibold text-ink-700">Instagram username</label>
          <input class="input" name="instagramUsername" placeholder="@yourshop" value="{{ $links['instagramUsername'] ?? '' }}" />
        </div>
        <div>
          <label class="mb-1 block text-xs font-semibold text-ink-700">Facebook page</label>
          <input class="input" name="facebookPageUrl" placeholder="yourshop or https://facebook.com/yourshop" value="{{ $links['facebookPageUrl'] ?? '' }}" />
        </div>
        <div>
          <label class="mb-1 block text-xs font-semibold text-ink-700">YouTube channel</label>
          <input class="input" name="youtubeUrl" placeholder="@yourshop or a full YouTube link" value="{{ $links['youtubeUrl'] ?? '' }}" />
        </div>
        <div>
          <label class="mb-1 block text-xs font-semibold text-ink-700">Default channel for the QR board</label>
          <select class="input" name="preferredReviewChannel">
            <option value="">First configured platform</option>
            @foreach ($channels as [$value, $label])
              <option value="{{ $value }}" @selected(($links['preferredReviewChannel'] ?? '') === $value)>{{ $label }}</option>
            @endforeach
          </select>
        </div>
        <button class="btn-primary w-full py-2.5" data-save>Save review links</button>
      </form>

      {{-- Boards, scans and warnings --}}
      <div class="space-y-3">
        @if (($links['totalScans'] ?? 0) > 0)
          <div class="card p-4">
            <p class="text-xs font-bold uppercase tracking-wide text-ink-500">QR scans</p>
            <p class="mt-1 text-2xl font-extrabold text-ink-900">{{ $links['totalScans'] }}</p>
            <div class="mt-2 flex flex-wrap gap-2">
              @foreach ($channels as [$value, $label, $icon, $tint])
                @if (! empty($links['scanCounts'][$value]))
                  <span class="badge bg-gray-100 text-gray-600"><x-icon :name="$icon" :size="11" :class="$tint" /> {{ $label }}: {{ $links['scanCounts'][$value] }}</span>
                @endif
              @endforeach
            </div>
          </div>
        @endif

        {{-- Pre-printed boards issued by admin and activated by this shop --}}
        <div class="card p-4">
          <div class="flex items-start justify-between gap-2">
            <div>
              <p class="text-xs font-bold uppercase tracking-wide text-ink-500">Issued QR boards</p>
              <p class="mt-0.5 text-xs text-ink-500">Boards you received from Markkito and activated by scanning.</p>
            </div>
            <a href="/qr" class="btn-secondary shrink-0 px-3 py-1.5 text-sm"><x-icon name="qr-code" :size="14" /> Activate a board</a>
          </div>
          @if (count($boards) > 0)
            <div class="mt-3 space-y-2">
              @foreach ($boards as $board)
                @php $previewChannel = $board['channel'] ?? $links['preferredReviewChannel'] ?? ''; @endphp
                <div class="rounded-lg bg-gray-50 p-3">
                  <div class="flex items-start gap-3">
                    <button type="button" data-board-preview="{{ $board['code'] }}" data-board-channel="{{ $previewChannel }}" title="View, download or print this board" class="shrink-0 rounded-md border border-gray-200 bg-white p-1 transition-colors hover:border-brand-400">
                      <span class="block h-14 w-14 animate-pulse rounded bg-gray-100" data-board-thumb="{{ $board['code'] }}"></span>
                    </button>
                    <div class="min-w-0 flex-1">
                      <div class="flex items-center justify-between gap-2">
                        <span class="font-mono text-sm font-bold text-ink-900">{{ $board['code'] }}</span>
                        <span class="shrink-0 text-xs text-ink-500">{{ $board['scanCount'] }} {{ $board['scanCount'] === 1 ? 'scan' : 'scans' }}</span>
                      </div>
                      <div class="mt-1.5 flex items-center gap-2">
                        <label class="shrink-0 text-[11px] font-medium text-ink-600">Sends to</label>
                        <select data-board-channel-select="{{ $board['id'] }}" data-board-code="{{ $board['code'] }}" class="min-w-0 flex-1 rounded-md border border-gray-300 bg-white px-2 py-1 text-xs focus:border-brand-500 focus:outline-none">
                          <option value="">My default channel</option>
                          @foreach ($boardChannels as $value => $label)
                            <option value="{{ $value }}" @selected(($board['channel'] ?? '') === $value) @disabled(empty($resolved[$value]))>{{ $label }}{{ empty($resolved[$value]) ? ' — add link first' : '' }}</option>
                          @endforeach
                        </select>
                      </div>
                      <div class="mt-2 flex flex-wrap gap-1.5">
                        <button type="button" data-board-preview="{{ $board['code'] }}" data-board-channel="{{ $previewChannel }}" class="btn-secondary px-2.5 py-1 text-xs"><x-icon name="qr-code" :size="12" /> View</button>
                        <button type="button" data-board-download="{{ $board['code'] }}" class="btn-secondary px-2.5 py-1 text-xs"><x-icon name="download" :size="12" /> Download</button>
                        <a href="/r/q/{{ $board['code'] }}" target="_blank" rel="noreferrer" class="btn-secondary px-2.5 py-1 text-xs"><x-icon name="external-link" :size="12" /> Test scan</a>
                      </div>
                    </div>
                  </div>
                </div>
              @endforeach
            </div>
          @else
            <p class="mt-3 text-xs text-ink-400">None yet. If you have a printed board from us, scan it or enter its code to activate.</p>
          @endif
        </div>

        @if (count($configured) === 0)
          <p class="rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-800">No review pages connected yet — scans will open your Markkito listing until you add one above.</p>
        @endif
      </div>
    </div>
  </div>
@endif
