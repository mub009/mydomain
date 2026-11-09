{{-- Recolour the card image in one tap: a row of colour swatches, saved as
     soon as one is picked. "Fine-tune" holds the strength and brightness for
     anyone who wants them. For the whole business team, owners included.
     Driven by resources/js/pages/card-manager.js; the maths is
     App\Support\Cards\ImageColour (tint, strength, hue, brightness, saturation). --}}
@php $swatches = \App\Support\Cards\ImageColour::SWATCHES; @endphp
<div class="rounded-xl border border-gray-200 p-4" data-colour-panel>
  <div class="flex items-center justify-between gap-2">
    <p class="flex items-center gap-1.5 text-sm font-bold text-ink-900"><x-icon name="sliders-horizontal" :size="15" class="text-brand-600" /> Card colour</p>
    <span class="text-xs font-semibold text-ink-500" data-colour-status aria-live="polite"></span>
  </div>
  <p class="mt-0.5 text-xs text-ink-500">Tap a colour — it's saved straight away. Your original image is always kept.</p>

  {{-- In the editor (dealers and admins), whose card is a scroll away: a small
       copy of it right here, recoloured the instant a colour is tapped. An
       owner sees the colour on their card itself. --}}
  @if (! empty($card['imageUrl']) && ($thumbAlways ?? false))
    <div class="mt-3 flex justify-center rounded-lg bg-gray-100 p-2">
      <img src="{{ $card['imageUrl'] }}" alt="Your card in this colour" class="max-h-56 w-auto rounded-md shadow-sm transition-[filter] duration-150" data-colour-thumb />
    </div>
  @endif

  <div class="mt-3 grid grid-cols-5 gap-2.5 sm:grid-cols-10" role="radiogroup" aria-label="Card colour">
    @foreach ($swatches as [$key, $label, $bg, $tint, $sat])
      <button type="button" role="radio" aria-checked="false" title="{{ $label }}"
              class="group flex flex-col items-center gap-1 rounded-xl p-1 text-[10px] font-semibold leading-tight text-ink-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
              data-swatch="{{ $key }}" data-tint="{{ $tint ?? '' }}" data-saturation="{{ $sat }}">
        <span class="block h-11 w-11 rounded-full border-2 border-white shadow ring-2 ring-transparent transition group-aria-checked:ring-brand-600 sm:h-10 sm:w-10" style="background: {{ $bg }}"></span>
        <span class="w-full truncate text-center">{{ $label }}</span>
      </button>
    @endforeach
    {{-- Any other colour, from the phone's or browser's colour picker. --}}
    <label role="radio" aria-checked="false" title="Your own colour"
           class="group relative flex cursor-pointer flex-col items-center gap-1 rounded-xl p-1 text-[10px] font-semibold leading-tight text-ink-600"
           data-swatch="custom">
      <span class="flex h-11 w-11 items-center justify-center rounded-full border-2 border-dashed border-gray-300 bg-white text-ink-500 ring-2 ring-transparent transition group-aria-checked:ring-brand-600 sm:h-10 sm:w-10" data-custom-dot><x-icon name="plus" :size="18" /></span>
      <span class="w-full truncate text-center">Own colour</span>
      <input type="color" value="#2563eb" class="absolute inset-0 h-full w-full cursor-pointer opacity-0" data-colour-custom aria-label="Pick your own colour" />
    </label>
  </div>

  <details class="mt-3 rounded-lg bg-gray-50 px-3 py-2" data-colour-more>
    <summary class="cursor-pointer select-none text-xs font-semibold text-ink-700">Fine-tune</summary>
    <div class="mt-2 space-y-3 pb-1">
      <label class="block" data-strength-row>
        <span class="mb-1 flex justify-between text-xs text-ink-600">How strong <span data-colour-label="strength"></span></span>
        <input type="range" min="10" max="100" step="5" class="h-6 w-full" data-colour="strength" />
      </label>
      <label class="block">
        <span class="mb-1 flex justify-between text-xs text-ink-600">Brightness <span data-colour-label="brightness"></span></span>
        <input type="range" min="50" max="150" step="5" class="h-6 w-full" data-colour="brightness" />
      </label>
    </div>
  </details>
</div>
