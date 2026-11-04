{{-- AI Google Review (a feature the dealer gives the business,
     App\Support\AiReview): the review page's link and QR code, what the
     AI's reviews mention and in which languages, and a sample review.
     Driven by resources/js/pages/ai-review-manager.js. --}}
@php $r = $aiReview ?? null; @endphp

@if (! $r)
  <p class="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">Could not load the AI Google Review settings.</p>
@else
  <div class="space-y-5" data-ai-review>
    <p class="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700" data-error hidden></p>

    @if (! $r['googleReviewUrl'])
      <div class="flex flex-wrap items-center gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
        <x-icon name="alert-triangle" :size="18" class="shrink-0 text-amber-600" />
        <p class="min-w-0 flex-1">Add your <b>Google review link</b> first. Customers are sent there to post the review the AI writes for them.</p>
        <a href="?section={{ urlencode('Reviews & QR') }}" class="btn-primary px-3 py-1.5 text-xs">Add Google link</a>
      </div>
    @elseif (! $r['published'])
      <p class="rounded-xl border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-900">Your review page goes live once your listing is published.</p>
    @endif

    <div class="grid gap-5 lg:grid-cols-[1fr_auto]">
      {{-- The link and its QR code --}}
      <div class="card p-5">
        <h3 class="flex items-center gap-1.5 font-bold text-ink-900"><x-icon name="sparkles" :size="16" class="text-brand-600" /> Your AI review page</h3>
        <p class="mt-0.5 text-sm text-ink-500">Customers open this link or scan the QR code. The AI writes their review in a second; they copy it and post it on your Google page.</p>

        <div class="mt-4 flex items-center gap-2 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2">
          <span class="min-w-0 flex-1 truncate font-mono text-sm text-ink-800" data-ai-url>{{ $r['url'] }}</span>
          <button type="button" class="shrink-0 rounded-md px-2 py-1 text-xs font-semibold text-brand-700 hover:bg-brand-50" data-copy-url><x-icon name="copy" :size="14" /> <span>Copy</span></button>
        </div>
        <div class="mt-3 flex flex-wrap gap-2">
          @if ($r['live'])
            <a href="{{ $r['url'] }}" target="_blank" rel="noopener" class="btn-secondary px-3 py-2 text-sm"><x-icon name="external-link" :size="15" /> Open page</a>
          @endif
          <a href="https://wa.me/?text={{ rawurlencode('Thank you for visiting us! Please share your feedback on Google — it takes 30 seconds: '.$r['url']) }}" target="_blank" rel="noopener" class="btn-secondary px-3 py-2 text-sm"><x-icon name="message-square" :size="15" /> Send on WhatsApp</a>
          <button type="button" class="btn-secondary px-3 py-2 text-sm" data-download-qr><x-icon name="download" :size="15" /> Download QR</button>
        </div>

        <dl class="mt-5 grid grid-cols-2 gap-3">
          <div class="rounded-xl bg-gray-50 px-3 py-2.5">
            <dt class="text-[11px] font-semibold uppercase tracking-wide text-ink-500">Page opened</dt>
            <dd class="mt-0.5 text-xl font-bold tabular-nums text-ink-900">{{ number_format($r['views']) }}</dd>
          </div>
          <div class="rounded-xl bg-gray-50 px-3 py-2.5">
            <dt class="text-[11px] font-semibold uppercase tracking-wide text-ink-500">Reviews copied</dt>
            <dd class="mt-0.5 text-xl font-bold tabular-nums text-ink-900">{{ number_format($r['copies']) }}</dd>
          </div>
        </dl>
      </div>

      <div class="card flex flex-col items-center justify-center p-5">
        <img alt="QR code for your AI review page" class="h-44 w-44" data-qr />
        <p class="mt-2 text-center text-xs font-semibold text-ink-700">Scan to review us on Google</p>
      </div>
    </div>

    {{-- What the reviews mention --}}
    <form class="card space-y-4 p-5" data-ai-settings>
      <div>
        <h3 class="font-bold text-ink-900">What the AI writes, and how</h3>
        <p class="mt-0.5 text-sm text-ink-500">The AI uses your business name, category, city and services. Add anything else reviews may mention — each review picks one or two, so no two read the same.</p>
      </div>
      <label class="block">
        <span class="mb-1 block text-xs font-semibold text-ink-700">Things customers like <span class="font-normal text-ink-400">(optional)</span></span>
        <textarea name="highlights" rows="2" maxlength="300" class="input" placeholder="e.g. friendly staff, quick service, clean place, fair prices">{{ $r['highlights'] }}</textarea>
      </label>
      <fieldset>
        <legend class="mb-1 block text-xs font-semibold text-ink-700">Languages customers can choose</legend>
        <div class="mt-1 flex flex-wrap gap-2">
          @foreach ($r['languageOptions'] as $l)
            <label class="flex cursor-pointer items-center gap-2 rounded-lg border border-gray-200 px-3 py-2 text-sm has-[:checked]:border-brand-500 has-[:checked]:bg-brand-50">
              <input type="checkbox" name="languages" value="{{ $l['code'] }}" class="rounded text-brand-600" @checked(in_array($l['code'], $r['languages'], true)) />
              {{ $l['name'] }} @if ($l['native'] !== $l['name'])<span class="text-ink-500">{{ $l['native'] }}</span>@endif
            </label>
          @endforeach
        </div>
      </fieldset>
      <div class="grid gap-4 sm:grid-cols-2">
        <label class="block">
          <span class="mb-1 block text-xs font-semibold text-ink-700">Tone</span>
          <select name="tone" class="input">
            @foreach ($r['toneOptions'] as $o)
              <option value="{{ $o['key'] }}" @selected($r['tone'] === $o['key'])>{{ $o['label'] }}</option>
            @endforeach
          </select>
        </label>
        <label class="block">
          <span class="mb-1 block text-xs font-semibold text-ink-700">Length</span>
          <select name="length" class="input">
            @foreach ($r['lengthOptions'] as $o)
              <option value="{{ $o['key'] }}" @selected($r['length'] === $o['key'])>{{ $o['label'] }}</option>
            @endforeach
          </select>
        </label>
        <label class="block">
          <span class="mb-1 block text-xs font-semibold text-ink-700">Search keywords <span class="font-normal text-ink-400">(optional)</span></span>
          <input name="keywords" maxlength="300" class="input" value="{{ $r['keywords'] }}" placeholder="e.g. dentist in Dammam, teeth whitening" />
          <span class="mt-1 block text-[11px] text-ink-500">Separate with commas. Each review works in one of them, naturally.</span>
        </label>
        <label class="block">
          <span class="mb-1 block text-xs font-semibold text-ink-700">Staff names <span class="font-normal text-ink-400">(optional)</span></span>
          <input name="staff" maxlength="200" class="input" value="{{ $r['staff'] }}" placeholder="e.g. Dr. Anil, Priya" />
          <span class="mt-1 block text-[11px] text-ink-500">Some reviews thank one of them by name.</span>
        </label>
        <label class="block sm:col-span-2">
          <span class="mb-1 block text-xs font-semibold text-ink-700">Words to avoid <span class="font-normal text-ink-400">(optional)</span></span>
          <input name="avoid" maxlength="300" class="input" value="{{ $r['avoid'] }}" placeholder="e.g. cheap, waiting, best in town" />
          <span class="mt-1 block text-[11px] text-ink-500">Separate with commas. A review that uses one is written again.</span>
        </label>
      </div>
      <label class="flex items-center gap-2 text-sm text-ink-700">
        <input type="checkbox" name="emoji" value="1" class="rounded text-brand-600" @checked($r['emoji']) /> Allow an emoji or two in reviews
      </label>
      <p class="flex items-start gap-1.5 rounded-lg bg-emerald-50 px-3 py-2 text-xs text-emerald-800">
        <x-icon name="check-circle-2" :size="14" class="mt-0.5 shrink-0" />
        <span>Every review is unique: each one is checked against the last {{ number_format(min($r['remembered'], 150)) }} reviews written for you, and written again if it reads too much like one of them.</span>
      </p>
      <div class="flex items-center gap-3">
        <button type="submit" class="btn-primary px-4 py-2 text-sm"><x-icon name="save" :size="15" /> Save</button>
        <span class="text-xs font-semibold text-brand-700" data-saved aria-live="polite"></span>
      </div>
    </form>

    {{-- Try it --}}
    <div class="card p-5" data-ai-sample>
      <h3 class="font-bold text-ink-900">Try it</h3>
      <p class="mt-0.5 text-sm text-ink-500">See a review the way a customer gets one. Try a few: each one is different.</p>
      <div class="mt-3 flex flex-wrap items-end gap-3">
        <label class="block">
          <span class="mb-1 block text-xs font-semibold text-ink-700">Stars</span>
          <select class="input w-28" data-sample-rating>
            @for ($i = 5; $i >= 1; $i--)<option value="{{ $i }}">{{ str_repeat('★', $i) }}</option>@endfor
          </select>
        </label>
        <label class="block">
          <span class="mb-1 block text-xs font-semibold text-ink-700">Language</span>
          <select class="input w-40" data-sample-language>
            @foreach ($r['languageOptions'] as $l)
              @if (in_array($l['code'], $r['languages'], true))<option value="{{ $l['code'] }}">{{ $l['name'] }}</option>@endif
            @endforeach
          </select>
        </label>
        <button type="button" class="btn-primary px-4 py-2.5 text-sm" data-sample-go><x-icon name="sparkles" :size="15" /> <span>Write a review</span></button>
      </div>
      <p class="mt-4 hidden whitespace-pre-line rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm leading-relaxed text-ink-800" data-sample-text></p>
    </div>
  </div>
  <script type="application/json" id="ai-review-data">@json(['url' => $r['url']])</script>
@endif
