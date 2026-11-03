{{-- Recolour the card image — tint, hue, brightness, saturation. For the
     whole business team, owners included. Driven by
     resources/js/pages/card-manager.js; the maths is App\Support\Cards\ImageColour. --}}
<div class="space-y-3 rounded-xl border border-gray-200 p-4" data-colour-panel>
  <div class="flex items-start justify-between gap-2">
    <div>
      <p class="flex items-center gap-1.5 text-sm font-bold text-ink-900"><x-icon name="sliders-horizontal" :size="15" class="text-brand-600" /> Card colour</p>
      <p class="mt-0.5 text-[11px] text-ink-500">Recolour the card image. Your original image is kept — reset any time.</p>
    </div>
    <button type="button" class="shrink-0 text-[11px] font-semibold text-ink-500 hover:underline" data-colour-reset>Reset</button>
  </div>

  <div class="rounded-lg bg-gray-50 p-2.5">
    <label class="flex items-center justify-between gap-2 text-xs font-semibold text-ink-700">
      <span class="flex items-center gap-2"><input type="checkbox" class="h-4 w-4 rounded border-gray-300" data-colour="useTint" /> Tint colour</span>
      <input type="color" value="#2563eb" class="h-7 w-10 cursor-pointer rounded border border-gray-300 bg-white p-0.5" data-colour="tint" aria-label="Tint colour" />
    </label>
    <label class="mt-2 block">
      <span class="mb-0.5 flex justify-between text-[11px] text-ink-600">Tint strength <span data-colour-label="strength"></span></span>
      <input type="range" min="0" max="100" step="1" class="w-full" data-colour="strength" />
    </label>
  </div>

  @foreach ([['hue', 'Hue', -180, 180, '°'], ['brightness', 'Brightness', 50, 150, '%'], ['saturation', 'Saturation', 0, 200, '%']] as [$key, $label, $min, $max, $unit])
    <label class="block">
      <span class="mb-0.5 flex justify-between text-[11px] text-ink-600">{{ $label }} <span data-colour-label="{{ $key }}" data-unit="{{ $unit }}"></span></span>
      <input type="range" min="{{ $min }}" max="{{ $max }}" step="1" class="w-full" data-colour="{{ $key }}" />
    </label>
  @endforeach

  <div class="flex items-center justify-end gap-2">
    <span class="hidden text-[11px] font-semibold text-amber-700" data-colour-dirty>Not saved</span>
    <button type="button" class="btn-primary px-3 py-1.5 text-xs" data-colour-save disabled><x-icon name="save" :size="13" /> <span>Save colour</span></button>
  </div>
</div>
