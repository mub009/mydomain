<form class="card p-5 space-y-3" data-details-form>
  <h3 class="font-bold text-ink-900 flex items-center gap-1.5"><x-icon name="info" :size="16" class="text-brand-600" /> Business details</h3>
  <div>
    <label class="block text-xs font-semibold text-ink-700 mb-1">Business name</label>
    <input required name="name" value="{{ $biz['name'] }}" class="input" />
  </div>
  <div>
    <label class="block text-xs font-semibold text-ink-700 mb-1">Description</label>
    <textarea name="description" class="input min-h-24" placeholder="Tell customers about your business">{{ $biz['description'] ?? '' }}</textarea>
  </div>
  <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
    <div>
      <label class="block text-xs font-semibold text-ink-700 mb-1">Category</label>
      <select required name="categoryId" class="input">
        <option value="">Select category</option>
        @foreach ($categories as $c)
          <option value="{{ $c['id'] }}" @selected(($biz['category']['id'] ?? null) === $c['id'])>{{ $c['name'] }}</option>
        @endforeach
      </select>
    </div>
    <div>
      <label class="block text-xs font-semibold text-ink-700 mb-1">Who does this business serve?</label>
      <div class="grid grid-cols-2 gap-2">
        @foreach (['B2C' => 'Consumer (B2C)', 'B2B' => 'Business (B2B)'] as $value => $label)
          <label class="cursor-pointer">
            <input type="radio" name="businessType" value="{{ $value }}" class="peer sr-only" @checked(($biz['businessType'] ?? 'B2C') === $value) />
            <span class="block rounded-lg border px-3 py-2.5 text-left text-sm font-semibold transition-colors border-gray-300 text-ink-700 hover:bg-gray-50 peer-checked:border-brand-500 peer-checked:bg-brand-50 peer-checked:text-brand-700">{{ $label }}</span>
          </label>
        @endforeach
      </div>
    </div>
    <div>
      <label class="block text-xs font-semibold text-ink-700 mb-1">Phone</label>
      <input required name="phone" value="{{ $biz['phone'] }}" class="input" />
    </div>
    <div>
      <label class="block text-xs font-semibold text-ink-700 mb-1">Email</label>
      <input type="email" name="email" value="{{ $biz['email'] ?? '' }}" class="input" />
    </div>
    <div>
      <label class="block text-xs font-semibold text-ink-700 mb-1">Website</label>
      <input name="website" value="{{ $biz['website'] ?? '' }}" class="input" placeholder="https://…" />
    </div>
  </div>

  {{-- Branding — the logo appears in the header of the business website --}}
  <div class="rounded-lg border border-gray-200 bg-gray-50/60 p-3">
    <p class="mb-2 text-xs font-bold uppercase tracking-wide text-ink-500">Branding</p>
    <div class="flex gap-3">
      <div class="flex-1 space-y-3">
        <x-upload-field name="logoUrl" purpose="business-logo" label="Logo image" :value="$biz['logoUrl'] ?? ''" placeholder="https://…/logo.png" hint="Shown in your website header and next to your name. Square images work best." />
        <x-upload-field name="coverImageUrl" purpose="business-cover" label="Cover image" :value="$biz['coverImageUrl'] ?? ''" placeholder="https://…/cover.jpg" />
      </div>
      <div class="shrink-0 text-center">
        <p class="mb-1 text-[11px] font-medium text-ink-500">Preview</p>
        <img src="{{ $biz['logoUrl'] ?? '' }}" alt="Logo preview" data-logo-preview class="h-16 w-16 rounded-full border border-gray-200 object-cover" @if (empty($biz['logoUrl'])) hidden @endif />
        <span data-logo-letter class="flex h-16 w-16 items-center justify-center rounded-full bg-brand-600 text-2xl font-extrabold text-white" @if (! empty($biz['logoUrl'])) hidden @endif>{{ mb_strtoupper(mb_substr(trim($biz['name']), 0, 1)) ?: '?' }}</span>
      </div>
    </div>
  </div>
  <div>
    <label class="block text-xs font-semibold text-ink-700 mb-1">Address line 1</label>
    <input required name="addressLine1" value="{{ $biz['addressLine1'] ?? '' }}" class="input" />
  </div>
  <div>
    <label class="block text-xs font-semibold text-ink-700 mb-1">Address line 2</label>
    <input name="addressLine2" value="{{ $biz['addressLine2'] ?? '' }}" class="input" />
  </div>
  <div class="grid grid-cols-2 sm:grid-cols-3 gap-3">
    <div>
      <label class="block text-xs font-semibold text-ink-700 mb-1">City</label>
      <input required name="city" value="{{ $biz['city'] }}" class="input" />
    </div>
    <div>
      <label class="block text-xs font-semibold text-ink-700 mb-1">State</label>
      <input required name="state" value="{{ $biz['state'] }}" class="input" />
    </div>
    <div>
      <label class="block text-xs font-semibold text-ink-700 mb-1">Postal code</label>
      <input required name="postalCode" value="{{ $biz['postalCode'] ?? '' }}" class="input" />
    </div>
  </div>
  <div>
    <div class="grid grid-cols-2 gap-3">
      <div>
        <label class="block text-xs font-semibold text-ink-700 mb-1">Latitude</label>
        <input required name="latitude" value="{{ $biz['latitude'] }}" class="input" />
      </div>
      <div>
        <label class="block text-xs font-semibold text-ink-700 mb-1">Longitude</label>
        <input required name="longitude" value="{{ $biz['longitude'] }}" class="input" />
      </div>
    </div>
    <button type="button" data-detect-location class="btn-secondary mt-2 px-3 py-1.5 text-sm"><x-icon name="locate-fixed" :size="14" /> <span>Use my current location</span></button>
    <p class="mt-1 text-xs text-red-600" data-location-error hidden></p>
  </div>
  <button class="btn-primary px-5 py-2.5" data-save>Save details</button>
</form>
