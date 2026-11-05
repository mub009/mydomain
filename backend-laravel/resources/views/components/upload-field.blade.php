@props(['name', 'purpose', 'value' => '', 'label' => null, 'hint' => null, 'placeholder' => 'https://… or upload a file', 'clearable' => false, 'removeBackground' => false])
{{-- A URL field with an "Upload" button next to it: the picked file goes to
     /uploads/image and the returned URL lands in the same field. Wired up by
     initUploadFields() in resources/js/lib/widgets.js. --}}
<div {{ $attributes }} data-upload-field="{{ $purpose }}">
  @if ($label)
    <label class="mb-1 block text-xs font-semibold text-ink-700">{{ $label }}</label>
  @endif
  <div class="flex items-center gap-2">
    <input name="{{ $name }}" value="{{ $value }}" class="input flex-1" placeholder="{{ $placeholder }}" data-upload-url />
    <button type="button" class="btn-secondary shrink-0 px-3 py-2 text-sm" data-upload-button>
      <x-icon name="upload" :size="14" /> <span>Upload</span>
    </button>
    @if ($clearable)
      <button type="button" class="btn-secondary shrink-0 px-3 py-2 text-sm text-red-600" data-upload-clear title="Remove image" @if ($value === '' || $value === null) hidden @endif>
        <x-icon name="trash-2" :size="14" /> <span>Remove</span>
      </button>
    @endif
    <input type="file" accept="image/png,image/jpeg,image/gif,image/webp" class="hidden" data-upload-file />
  </div>
  @if ($removeBackground)
    {{-- Logos: the server clears a plain background, trims and sharpens the picture (App\Support\Uploads\LogoCleaner). --}}
    <label class="mt-1.5 flex items-center gap-1.5 text-xs text-ink-600">
      <input type="checkbox" class="rounded border-gray-300" data-upload-remove-bg /> Remove background &amp; make high quality with AI
    </label>
  @endif
  @if ($hint)
    <p class="mt-1 text-[11px] text-ink-400">{{ $hint }}</p>
  @endif
  <p class="mt-1 text-xs text-red-600" data-upload-error hidden></p>
  <p class="mt-1 text-xs font-medium text-emerald-600" data-upload-saved hidden></p>
</div>
