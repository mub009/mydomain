{{-- "Add a business" form (pages/dashboard/create.blade.php). Submitted by
     resources/js/pages/business-create.js. --}}
<form class="card p-4 sm:p-5 space-y-3 mb-6" data-create-business>
  <p class="text-xs text-ink-500">
    {{ $isDealer
        ? 'Add the basics now. The phone, address, description, hours, services and photos are added afterwards from the business’s Manage page.'
        : 'Create the listing, then add hours, services, and photos.' }}
  </p>
  <div>
    <input required name="name" placeholder="Business name" class="input" data-slug-source />
    <p class="mt-1 text-[11px] text-ink-500" data-slug-preview hidden>Page link: <span class="font-mono text-ink-700">/business/<span data-slug-value></span></span></p>
  </div>
  <select required name="categoryId" class="input" data-search-select data-search-placeholder="Search category…">
    <option value="">Select category</option>
    @foreach ($categories as $c)
      <option value="{{ $c['id'] }}">{{ $c['name'] }}</option>
    @endforeach
  </select>

  @if ($canAssignOwner)
    {{-- What the business gets (App\Support\BusinessFeatures). A dealer pays a
         point for each; an admin's are free. The listing itself is free. --}}
    <div class="rounded-lg border border-gray-200 p-3" data-features-picker data-points="{{ $isDealer ? (int) ($points['points'] ?? 0) : '' }}">
      <div class="mb-2 flex flex-wrap items-center justify-between gap-2">
        <p class="text-xs font-semibold text-ink-700"><x-icon name="sliders-horizontal" :size="13" class="-mt-0.5 mr-1 inline" />Features for this business</p>
        <span class="text-[11px] text-ink-500">{{ $isDealer ? 'Priced per feature · the listing itself is free' : 'Free for admins' }}</span>
      </div>
      <div class="grid gap-2 sm:grid-cols-3">
        @php $featurePlans = \App\Support\FeaturePlans::all(); @endphp
        @foreach (\App\Support\BusinessFeatures::ALL as $key)
          <label class="flex cursor-pointer gap-2 rounded-lg border border-gray-200 bg-white p-2.5 transition has-[:checked]:border-brand-500 has-[:checked]:bg-brand-50/50">
            <input type="checkbox" name="features" value="{{ $key }}" class="mt-0.5 h-4 w-4 shrink-0 rounded border-gray-300" data-feature-option data-cost="{{ $isDealer ? $featurePlans[$key]['points'] : 0 }}" @checked(! $isDealer) />
            <span>
              <span class="block text-xs font-semibold text-ink-900">{{ \App\Support\BusinessFeatures::LABELS[$key] }}</span>
              <span class="mt-0.5 block text-[11px] leading-snug text-ink-500">{{ \App\Support\BusinessFeatures::BLURBS[$key] }}</span>
              @if ($isDealer)
                <span class="mt-1 inline-block rounded bg-amber-50 px-1.5 py-0.5 text-[10px] font-semibold text-amber-700">{{ $featurePlans[$key]['points'] }} {{ $featurePlans[$key]['points'] === 1 ? 'point' : 'points' }} · {{ \App\Support\FeaturePlans::durationLabel($featurePlans[$key]['months']) }}{{ $featurePlans[$key]['price'] !== null ? ' · '.\App\Support\FeaturePlans::priceLabel($featurePlans[$key]['price']) : '' }}</span>
                @if ($featurePlans[$key]['commission'] !== null)
                  <span class="mt-0.5 block text-[10px] text-ink-500">Admin commission {{ \App\Support\FeaturePlans::priceLabel($featurePlans[$key]['commission']) }}</span>
                @endif
              @endif
            </span>
          </label>
        @endforeach
      </div>
      @if ($isDealer)
        <p class="mt-2 text-xs text-amber-700" data-features-cost>
          <x-icon name="coins" :size="12" class="inline -mt-0.5 mr-1" />
          <span>No features picked — the listing is free.</span> You have {{ (int) ($points['points'] ?? 0) }} points.
        </p>
      @endif
    </div>
  @endif

  {{-- Step 2–3: the digital visiting card designs for the chosen category,
       filled in by business-create.js. The pick is saved on the new
       business's card; it can be changed any time from Manage → Visiting Card. --}}
  <div class="rounded-lg border border-gray-200 bg-gray-50/60 p-3" data-card-picker hidden>
    <div class="mb-2 flex items-center justify-between gap-2">
      <p class="text-xs font-semibold text-ink-700"><x-icon name="layout-template" :size="13" class="-mt-0.5 mr-1 inline" />Choose a visiting card design</p>
      <span class="text-[11px] text-ink-500">Tap a design to preview it</span>
    </div>
    <div class="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5" data-card-options></div>
    <input type="hidden" name="cardTemplateId" data-card-template />
  </div>

  <div>
    <p class="mb-1.5 text-xs font-semibold text-ink-700">Who does this business serve?</p>
    <div class="grid grid-cols-1 gap-2 sm:grid-cols-2">
      @foreach ([['B2C', 'users-round', 'Consumer (B2C)', 'Public customers find and contact you directly'], ['B2B', 'building-2', 'Business (B2B)', 'Other businesses find you as a supplier']] as [$value, $icon, $title, $text])
        <label class="cursor-pointer">
          <input type="radio" name="businessType" value="{{ $value }}" class="peer sr-only" @checked($value === 'B2C') />
          <span class="flex items-start gap-2 rounded-lg border p-3 text-left transition-colors border-gray-300 hover:bg-gray-50 peer-checked:border-brand-500 peer-checked:bg-brand-50 text-ink-400 peer-checked:[&_svg]:text-brand-600">
            <x-icon :name="$icon" :size="16" class="mt-0.5 shrink-0" />
            <span class="min-w-0">
              <span class="block text-sm font-semibold text-ink-900">{{ $title }}</span>
              <span class="block text-xs text-ink-500">{{ $text }}</span>
            </span>
          </span>
        </label>
      @endforeach
    </div>
  </div>

  {{-- Dealers add just the basics; the description, phone, website and
       address are filled in afterwards from the business's Manage page. --}}
  @unless ($isDealer)
    <x-ai-description />

    <input required type="tel" inputmode="tel" autocomplete="tel" minlength="7" maxlength="20" name="phone" placeholder="Phone" class="input" />
    <input type="tel" inputmode="tel" minlength="7" maxlength="20" name="whatsappNumber" placeholder="WhatsApp number (optional — the phone is used if empty)" class="input" />
    <input type="url" name="website" placeholder="Website (optional) — https://…" class="input" />
    <input required name="addressLine1" placeholder="Address line 1" class="input" />
  @endunless
  {{-- Side by side from tablet width; stacked on phones, where two text
       inputs in a row are wider than the screen. --}}
  <div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
    <x-state-city />
  </div>
  @unless ($isDealer)
    <input inputmode="numeric" autocomplete="postal-code" maxlength="20" name="postalCode" placeholder="Postal code (optional)" class="input" />
  @endunless
  <div>
    <div class="grid grid-cols-2 gap-3">
      <input required inputmode="decimal" name="latitude" placeholder="Latitude" class="input min-w-0" />
      <input required inputmode="decimal" name="longitude" placeholder="Longitude" class="input min-w-0" />
    </div>
    <button type="button" data-detect-location class="btn-secondary mt-2 px-3 py-1.5 text-sm"><x-icon name="locate-fixed" :size="14" /> <span>Use my current location</span></button>
    <p class="mt-1 text-xs text-red-600" data-location-error hidden></p>
  </div>

  @if ($canAssignOwner)
    {{-- Dealers/admins can create a login for the business team while adding
         the listing; the listing is then assigned to that account. --}}
    <div class="rounded-lg border border-brand-100 bg-brand-50/50 p-3 space-y-2">
      <label class="flex items-start gap-2 text-sm font-semibold text-brand-800 cursor-pointer">
        <input type="checkbox" name="withOwner" @checked($isDealer) class="mt-0.5 shrink-0" data-with-owner />
        <x-icon name="key-round" :size="14" class="mt-0.5 shrink-0" /> <span>Create a login for the business team</span>
      </label>
      <div class="space-y-2" data-owner-fields @if (! $isDealer) hidden @endif>
        <p class="text-[11px] text-ink-500">
          The listing is assigned to this account so the business can sign in and manage it. If the email
          already has an account, the listing is linked to it and the password is ignored.
        </p>
        <div>
          <label class="block text-[11px] font-medium text-ink-600 mb-1">Login username (email or mobile number)</label>
          <input class="input" name="ownerUsername" placeholder="owner@business.com or 9876543210" autocomplete="off" autocapitalize="none" spellcheck="false" data-owner-required />
        </div>
        <div>
          <label class="block text-[11px] font-medium text-ink-600 mb-1">Login password (min 8 chars)</label>
          <div class="flex gap-2">
            <input minlength="8" type="text" class="input min-w-0 flex-1 font-mono" name="ownerPassword" placeholder="Set a password" autocomplete="off" autocapitalize="none" spellcheck="false" data-owner-required />
            <button type="button" data-generate-password class="btn-secondary shrink-0 px-3 py-2 text-sm whitespace-nowrap"><x-icon name="refresh-cw" :size="14" /> Generate</button>
          </div>
        </div>
        <input type="tel" inputmode="tel" minlength="7" maxlength="20" class="input" name="ownerPhone" placeholder="Contact phone (optional, min 7 digits)" />
      </div>
      <p class="text-[11px] text-ink-500" data-owner-off @if ($isDealer) hidden @endif>The listing stays under your own account.</p>
    </div>
  @endif

  <x-upload-field name="logoUrl" purpose="business-logo" label="Logo (optional)" placeholder="https://…/logo.png" hint="Shown on your visiting card, website and listing. Square images work best." />

  <p class="text-sm text-red-700 bg-red-50 rounded-md px-3 py-2" data-create-error hidden></p>
  <button class="btn-primary w-full py-2.5">Create listing</button>
</form>
