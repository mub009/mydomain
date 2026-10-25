{{-- The banner slider at the top of the business's website. Every change
     saves straight away and the website shows it on its next visit — no
     rebuild or publish needed. Wired up in resources/js/pages/manage.js. --}}
@php
    $images = $slider['sliderImages'] ?? [];
    $max = $slider['max'] ?? 8;
    $listingPhotos = array_values(array_filter(array_column($biz['photos'] ?? [], 'url'), fn ($url) => ! in_array($url, $images, true)));
    $sliderData = ['images' => $images, 'max' => $max];
@endphp
<div class="space-y-4">
  <div class="card p-5">
    <h3 class="font-bold text-ink-900 flex items-center gap-1.5"><x-icon name="image" :size="16" class="text-brand-600" /> Slider photos</h3>
    <p class="mt-0.5 mb-3 text-xs text-ink-500">These photos slide across the banner at the top of your website, in this order (up to {{ $max }}). Changes show on your website straight away.</p>
    @if (count($images) > 0)
      <div class="grid grid-cols-2 sm:grid-cols-3 gap-3">
        @foreach ($images as $i => $url)
          <div class="relative aspect-video rounded-lg overflow-hidden bg-gray-100">
            <img src="{{ $url }}" alt="Slide {{ $i + 1 }}" class="h-full w-full object-cover" />
            <span class="absolute left-2 top-2 rounded bg-black/60 px-1.5 py-0.5 text-[11px] font-bold text-white">{{ $i + 1 }}</span>
            <div class="absolute right-2 top-2 flex gap-1">
              <button type="button" data-slide-move="{{ $i }}" data-to="{{ $i - 1 }}" @disabled($i === 0) class="h-7 w-7 flex items-center justify-center rounded-full bg-white/90 text-ink-700 shadow disabled:opacity-30" title="Move earlier"><x-icon name="chevron-left" :size="14" /></button>
              <button type="button" data-slide-move="{{ $i }}" data-to="{{ $i + 1 }}" @disabled($i === count($images) - 1) class="h-7 w-7 flex items-center justify-center rounded-full bg-white/90 text-ink-700 shadow disabled:opacity-30" title="Move later"><x-icon name="chevron-right" :size="14" /></button>
              <button type="button" data-slide-remove="{{ $i }}" class="h-7 w-7 flex items-center justify-center rounded-full bg-white/90 text-red-500 shadow" title="Remove"><x-icon name="trash-2" :size="14" /></button>
            </div>
          </div>
        @endforeach
      </div>
    @else
      <p class="text-sm text-ink-500">No slider photos yet, so your website shows your first 5 listing photos. Upload photos below to choose your own.</p>
    @endif
  </div>

  @if (count($images) < $max)
    <div class="card p-5 space-y-3">
      <h3 class="font-bold text-ink-900 flex items-center gap-1.5"><x-icon name="plus" :size="16" class="text-brand-600" /> Add slider photos</h3>
      <label class="flex cursor-pointer flex-col items-center justify-center gap-1 rounded-lg border-2 border-dashed border-gray-300 px-4 py-8 text-sm font-semibold text-ink-500 hover:border-brand-400 hover:text-brand-600" data-slider-drop>
        <x-icon name="upload" :size="20" />
        <span data-slider-label>Upload photos</span>
        <span class="text-xs font-normal text-ink-400">PNG, JPG, GIF or WebP. Wide photos look best.</span>
        <input type="file" accept="image/png,image/jpeg,image/gif,image/webp" multiple class="hidden" data-slider-upload />
      </label>
      @if (count($listingPhotos) > 0)
        <div>
          <p class="text-xs font-semibold text-ink-700">Or add one of your listing photos</p>
          <div class="mt-1.5 flex flex-wrap gap-2">
            @foreach ($listingPhotos as $url)
              <button type="button" data-slide-add="{{ $url }}" class="h-14 w-20 overflow-hidden rounded-md border border-gray-200 hover:ring-2 hover:ring-brand-500" title="Add to slider">
                <img src="{{ $url }}" alt="" class="h-full w-full object-cover" />
              </button>
            @endforeach
          </div>
        </div>
      @endif
    </div>
  @endif
</div>
<script type="application/json" id="slider-data">@json($sliderData)</script>
