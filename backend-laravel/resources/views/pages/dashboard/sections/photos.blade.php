<div class="space-y-4">
  <div class="card p-5">
    <h3 class="font-bold text-ink-900 mb-3 flex items-center gap-1.5"><x-icon name="image-plus" :size="16" class="text-brand-600" /> Services</h3>
    @if (count($biz['photos'] ?? []) > 0)
      <div class="grid grid-cols-2 sm:grid-cols-3 gap-3">
        @foreach ($biz['photos'] as $p)
          <div class="overflow-hidden rounded-lg border border-gray-200">
            <div class="aspect-[4/3] bg-gray-100">
              <img src="{{ $p['url'] }}" alt="{{ $p['caption'] ?? '' }}" class="h-full w-full object-cover" />
            </div>
            <input type="text" value="{{ $p['caption'] ?? '' }}" maxlength="200" placeholder="Caption (optional)" data-photo-caption="{{ $p['id'] }}" class="w-full border-t border-gray-200 bg-white px-2.5 py-1.5 text-xs text-ink-700 placeholder:text-ink-400 focus:outline-none focus:ring-1 focus:ring-inset focus:ring-brand-500" />
            <button type="button" data-delete-photo="{{ $p['id'] }}" class="flex w-full items-center justify-center gap-1.5 border-t border-gray-200 bg-white py-2 text-xs font-semibold text-red-600 hover:bg-red-50">
              <x-icon name="trash-2" :size="13" /> Remove
            </button>
          </div>
        @endforeach
      </div>
    @else
      <p class="text-sm text-ink-500">No photos yet.</p>
    @endif
  </div>

  <form class="card p-5 space-y-3" data-photo-form>
    <h3 class="font-bold text-ink-900 flex items-center gap-1.5"><x-icon name="plus" :size="16" class="text-brand-600" /> Add a photo</h3>
    <x-upload-field name="url" purpose="business-photos" :show-url="false" />
    <input name="caption" placeholder="Caption (optional)" class="input" />
    <button class="btn-primary px-5 py-2.5" data-add-photo disabled>Add photo</button>
  </form>
</div>
