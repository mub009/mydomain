@props(['value' => '', 'placeholder' => 'City / Location'])
{{-- City picker with "detect my location", recent and trending cities.
     Behaviour lives in resources/js/lib/location-input.js. --}}
<div {{ $attributes->merge(['class' => 'relative']) }} data-location-input>
  <div class="flex items-center gap-2 h-[52px] rounded-lg border border-gray-300 bg-white px-3.5 focus-within:ring-2 focus-within:ring-brand-500/40 focus-within:border-brand-500">
    <x-icon name="map-pin" :size="18" class="text-brand-600 shrink-0" />
    <input value="{{ $value }}" placeholder="{{ $placeholder }}" autocomplete="off" data-location-field class="w-full text-sm text-ink-900 placeholder:text-gray-400 focus:outline-none" />
  </div>

  <div class="absolute z-40 top-full mt-1.5 w-full sm:w-80 max-h-96 overflow-y-auto rounded-lg border border-gray-200 bg-white shadow-popover py-2" data-location-menu hidden>
    <button type="button" data-detect class="w-full flex items-center gap-2 px-4 py-2.5 text-sm font-semibold text-brand-600 hover:bg-brand-50 transition-colors">
      <x-icon name="locate-fixed" :size="16" />
      <span data-detect-label>Detect my location</span>
    </button>
    <p class="px-4 pb-1.5 text-xs text-red-600" data-detect-error hidden></p>

    <div class="pt-1.5" data-recents hidden>
      <div class="flex items-center justify-between px-4 py-1">
        <span class="text-[11px] font-semibold uppercase tracking-wide text-ink-500">Recent locations</span>
        <button type="button" data-clear-recents class="text-[11px] font-semibold text-brand-600 hover:underline flex items-center gap-0.5">
          <x-icon name="x" :size="11" /> Clear all
        </button>
      </div>
      <div data-recents-list></div>
    </div>

    <div class="pt-1.5 border-t border-gray-100 mt-1.5" data-trending hidden>
      <div class="flex items-center gap-1.5 px-4 py-1">
        <x-icon name="trending-up" :size="12" class="text-ink-500" />
        <span class="text-[11px] font-semibold uppercase tracking-wide text-ink-500">Trending areas</span>
      </div>
      <div data-trending-list></div>
    </div>

    <p class="px-4 py-2 text-xs text-ink-500" data-location-empty>Start typing a city, or detect your location above.</p>
  </div>
</div>
