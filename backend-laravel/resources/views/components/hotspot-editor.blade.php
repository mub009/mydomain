{{-- The image-card editor's markup: the card image (stage) with its actions,
     the palette to drag them from, the selected action's settings and the
     list of placed ones. Brought to life by resources/js/lib/hotspot-editor.js.
     Used by the business's Visiting Card section and the admin card-template editor. --}}
@props(['subject' => 'your card', 'replaceable' => true, 'palette' => true, 'movable' => true])
<div {{ $attributes->merge(['class' => 'grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px]']) }} data-hotspot-editor>
  {{-- Stage --}}
  <div class="min-w-0">
    <div class="mx-auto w-full max-w-[480px]">
      <div class="relative select-none overflow-hidden rounded-xl border-2 border-dashed border-gray-300 bg-gray-50" data-stage>
        <img alt="Card image" class="hidden w-full" draggable="false" data-stage-image />
        <div class="absolute inset-0" data-stage-spots></div>
        <label class="flex min-h-[320px] cursor-pointer flex-col items-center justify-center gap-2 p-6 text-center" data-dropzone>
          <span class="flex h-14 w-14 items-center justify-center rounded-full bg-brand-50 text-brand-600"><x-icon name="image-plus" :size="26" /></span>
          <span class="font-semibold text-ink-900">Drop the card image here</span>
          <span class="text-xs text-ink-500">or click to choose a JPG, PNG or WebP (up to 20MB)</span>
          <input type="file" accept="image/jpeg,image/png,image/webp" class="sr-only" data-image-file />
        </label>
        <div class="absolute inset-0 hidden items-center justify-center bg-white/80 text-sm font-semibold text-ink-700" data-uploading>
          <x-icon name="loader-2" :size="18" class="mr-2 animate-spin" /> Uploading…
        </div>
      </div>
      <div class="mt-3 hidden flex-wrap items-center justify-between gap-2 text-xs" data-image-tools>
        <span class="text-ink-500"><span class="font-semibold text-ink-700">Click the image to add an action or a business detail.</span>{{ $movable ? ' Drag a box to move it, pull its corners to resize.' : ' Click a box to change its settings — positions are fixed, but the logo can be resized from its settings.' }}</span>
        <span class="flex gap-3">
          {{-- Not on a business's own card: its image stays as set up. --}}
          @if ($replaceable)
            <label class="cursor-pointer font-semibold text-brand-700 hover:underline">Replace image<input type="file" accept="image/jpeg,image/png,image/webp" class="sr-only" data-image-file /></label>
            <button type="button" class="font-semibold text-red-700 hover:underline" data-remove-image>Remove image</button>
          @endif
        </span>
      </div>
    </div>
  </div>

  {{-- Palette, inspector and the list of placed actions --}}
  <div class="space-y-4">
    @if ($palette)
      <div>
        <p class="mb-2 text-[11px] font-semibold uppercase tracking-wide text-ink-500">Drag onto {{ $subject }}</p>
        <div class="flex flex-wrap gap-1.5" data-palette></div>
        <p class="mt-1.5 text-[11px] text-ink-400">Or click right on the image to add one at that spot. Details show your listing's name, address, phone… in your own font.</p>
      </div>
    @endif
    <div class="rounded-xl border border-gray-200 p-3" data-inspector></div>
    <div>
      <p class="mb-2 text-[11px] font-semibold uppercase tracking-wide text-ink-500">On the card <span class="font-normal normal-case" data-spot-count></span></p>
      <ul class="space-y-1" data-spot-list></ul>
    </div>
  </div>
</div>
