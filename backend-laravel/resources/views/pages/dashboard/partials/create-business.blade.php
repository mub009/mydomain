{{-- "Add a business" form. Submitted by resources/js/pages/dashboard.js. --}}
<form class="card p-5 space-y-3 mb-6" data-create-business hidden>
  <h3 class="font-bold text-ink-900">Add a business</h3>
  <p class="text-xs text-ink-500 -mt-2">Create the listing, then add hours, services, and photos.</p>
  @if ($isDealer && $points)
    <p class="text-xs text-amber-700 bg-amber-50 rounded-md px-3 py-2">
      <x-icon name="coins" :size="12" class="inline -mt-0.5 mr-1" />
      This will use {{ $points['pointsPerBusiness'] }} of your {{ $points['points'] }} points.
    </p>
  @endif
  <div>
    <input required name="name" placeholder="Business name" class="input" data-slug-source />
    <p class="mt-1 text-[11px] text-ink-500" data-slug-preview hidden>Page link: <span class="font-mono text-ink-700">/business/<span data-slug-value></span></span></p>
  </div>
  <select required name="categoryId" class="input">
    <option value="">Select category</option>
    @foreach ($categories as $c)
      <option value="{{ $c['id'] }}">{{ $c['name'] }}</option>
    @endforeach
  </select>

  <div>
    <p class="mb-1.5 text-xs font-semibold text-ink-700">Who does this business serve?</p>
    <div class="grid grid-cols-2 gap-2">
      @foreach ([['B2C', 'users-round', 'Consumer (B2C)', 'Public customers find and contact you directly'], ['B2B', 'building-2', 'Business (B2B)', 'Other businesses find you as a supplier']] as [$value, $icon, $title, $text])
        <label class="cursor-pointer">
          <input type="radio" name="businessType" value="{{ $value }}" class="peer sr-only" @checked($value === 'B2C') />
          <span class="flex items-start gap-2 rounded-lg border p-3 text-left transition-colors border-gray-300 hover:bg-gray-50 peer-checked:border-brand-500 peer-checked:bg-brand-50 text-ink-400 peer-checked:[&_svg]:text-brand-600">
            <x-icon :name="$icon" :size="16" />
            <span>
              <span class="block text-sm font-semibold text-ink-900">{{ $title }}</span>
              <span class="block text-xs text-ink-500">{{ $text }}</span>
            </span>
          </span>
        </label>
      @endforeach
    </div>
  </div>

  <input required minlength="7" maxlength="20" name="phone" placeholder="Phone" class="input" />
  <input type="url" name="website" placeholder="Website (optional) — https://…" class="input" />
  <input required name="addressLine1" placeholder="Address line 1" class="input" />
  <div class="flex gap-3">
    <input required name="city" placeholder="City" class="input w-1/2" />
    <input required name="state" placeholder="State" class="input w-1/2" />
  </div>
  <input required name="postalCode" placeholder="Postal code" class="input" />
  <div class="flex gap-3">
    <input required name="latitude" placeholder="Latitude" class="input w-1/2" />
    <input required name="longitude" placeholder="Longitude" class="input w-1/2" />
  </div>

  @if ($canAssignOwner)
    {{-- Dealers/admins can create a login for the business team while adding
         the listing; the listing is then assigned to that account. --}}
    <div class="rounded-lg border border-brand-100 bg-brand-50/50 p-3 space-y-2">
      <label class="flex items-center gap-2 text-sm font-semibold text-brand-800 cursor-pointer">
        <input type="checkbox" name="withOwner" @checked($isDealer) data-with-owner />
        <x-icon name="key-round" :size="14" /> Create a login for the business team
      </label>
      <div class="space-y-2" data-owner-fields @if (! $isDealer) hidden @endif>
        <p class="text-[11px] text-ink-500">
          The listing is assigned to this account so the business can sign in and manage it. If the email
          already has an account, the listing is linked to it and the password is ignored.
        </p>
        <div class="flex gap-3">
          <input class="input" name="ownerFirstName" placeholder="Contact first name" data-owner-required />
          <input class="input" name="ownerLastName" placeholder="Contact last name" data-owner-required />
        </div>
        <div>
          <label class="block text-[11px] font-medium text-ink-600 mb-1">Login username (email or mobile number)</label>
          <input class="input" name="ownerUsername" placeholder="owner@business.com or 9876543210" autocomplete="off" data-owner-required />
        </div>
        <div>
          <label class="block text-[11px] font-medium text-ink-600 mb-1">Login password (min 8 chars)</label>
          <div class="flex gap-2">
            <input minlength="8" type="text" class="input font-mono" name="ownerPassword" placeholder="Set a password" data-owner-required />
            <button type="button" data-generate-password class="btn-secondary px-3 py-2 text-sm whitespace-nowrap"><x-icon name="refresh-cw" :size="14" /> Generate</button>
          </div>
        </div>
        <input minlength="7" maxlength="20" class="input" name="ownerPhone" placeholder="Contact phone (optional, min 7 digits)" />
      </div>
      <p class="text-[11px] text-ink-500" data-owner-off @if ($isDealer) hidden @endif>The listing stays under your own account.</p>
    </div>
  @endif

  <p class="text-sm text-red-700 bg-red-50 rounded-md px-3 py-2" data-create-error hidden></p>
  <button class="btn-primary w-full py-2.5">Create listing</button>
</form>
