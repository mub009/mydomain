<div class="card p-5 space-y-3" data-logo-form>
  <h3 class="font-bold text-ink-900 flex items-center gap-1.5"><x-icon name="image" :size="16" class="text-brand-600" /> Logo</h3>
  <div class="flex gap-3">
    <div class="flex-1 space-y-3">
      <x-upload-field name="logoUrl" purpose="business-logo" remove-background label="Logo image" :value="$biz['logoUrl'] ?? ''" placeholder="https://…/logo.png" hint="Shown in your website header and next to your name. Square images work best." clearable />
    </div>
    <div class="shrink-0 text-center">
      <p class="mb-1 text-[11px] font-medium text-ink-500">Preview</p>
      <img src="{{ $biz['logoUrl'] ?? '' }}" alt="Logo preview" data-logo-preview class="h-16 w-16 rounded-full border border-gray-200 object-cover" @if (empty($biz['logoUrl'])) hidden @endif />
      <span data-logo-letter class="flex h-16 w-16 items-center justify-center rounded-full bg-brand-600 text-2xl font-extrabold text-white" @if (! empty($biz['logoUrl'])) hidden @endif>{{ mb_strtoupper(mb_substr(trim($biz['name']), 0, 1)) ?: '?' }}</span>
    </div>
  </div>
</div>
