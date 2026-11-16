<form class="card p-5 space-y-3" data-details-form>
  <h3 class="font-bold text-ink-900 flex items-center gap-1.5"><x-icon name="phone" :size="16" class="text-brand-600" /> Contact</h3>
  <div>
    <label class="block text-xs font-semibold text-ink-700 mb-1">Business name</label>
    <input required name="name" value="{{ $biz['name'] }}" class="input" />
  </div>
  <x-ai-description :value="$biz['description'] ?? ''" />
  <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
    <div>
      <label class="block text-xs font-semibold text-ink-700 mb-1">Category</label>
      <select required name="categoryId" class="input" data-search-select data-search-placeholder="Search category…">
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
      <label class="block text-xs font-semibold text-ink-700 mb-1">WhatsApp number <span class="font-normal text-ink-400">(optional — the phone is used if empty)</span></label>
      <input type="tel" inputmode="tel" maxlength="20" name="whatsappNumber" value="{{ $biz['whatsappNumber'] ?? '' }}" class="input" placeholder="e.g. 98765 43210" />
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

  <div>
    <label class="block text-xs font-semibold text-ink-700 mb-1">Address line 1</label>
    <input required name="addressLine1" value="{{ $biz['addressLine1'] ?? '' }}" class="input" />
  </div>
  <div>
    <label class="block text-xs font-semibold text-ink-700 mb-1">Address line 2</label>
    <input name="addressLine2" value="{{ $biz['addressLine2'] ?? '' }}" class="input" />
  </div>
  <div class="grid grid-cols-1 sm:grid-cols-3 gap-3">
    <x-state-city :state="$biz['state'] ?? ''" :city="$biz['city'] ?? ''" labels />
    <div>
      <label class="block text-xs font-semibold text-ink-700 mb-1">Postal code <span class="font-normal text-ink-400">(optional)</span></label>
      <input inputmode="numeric" autocomplete="postal-code" maxlength="20" name="postalCode" value="{{ $biz['postalCode'] ?? '' }}" class="input" />
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
