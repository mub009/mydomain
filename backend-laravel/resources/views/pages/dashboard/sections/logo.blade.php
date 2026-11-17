<div class="card p-5 space-y-6" data-logo-form>
  <h3 class="font-bold text-ink-900 flex items-center gap-1.5"><x-icon name="image" :size="16" class="text-brand-600" /> Logo</h3>

  <div class="flex items-center gap-5">
    <div class="relative shrink-0">
      <img src="{{ $biz['logoUrl'] ?? '' }}" alt="Logo preview" data-logo-preview class="h-20 w-20 rounded-full border border-gray-200 object-cover" @if (empty($biz['logoUrl'])) hidden @endif />
      <span data-logo-letter class="flex h-20 w-20 items-center justify-center rounded-full bg-brand-600 text-3xl font-extrabold text-white" @if (! empty($biz['logoUrl'])) hidden @endif>{{ mb_strtoupper(mb_substr(trim($biz['name']), 0, 1)) ?: '?' }}</span>
    </div>
    <div class="flex-1 space-y-2">
      <p class="text-xs text-ink-500">Shown in your website header and next to your name. Square images work best.</p>
      <x-upload-field name="logoUrl" purpose="business-logo" remove-background :value="$biz['logoUrl'] ?? ''" clearable :show-url="false" />
    </div>
  </div>

  {{-- The cover image appears behind the header of the business website. --}}
  <div class="space-y-2 border-t border-gray-100 pt-5">
    <p class="mb-1 block text-xs font-semibold text-ink-700">Cover image</p>
    <p class="text-xs text-ink-500">The banner behind your website's header.</p>
    <x-upload-field name="coverImageUrl" purpose="business-cover" :value="$biz['coverImageUrl'] ?? ''" clearable :show-url="false" />
  </div>
</div>
