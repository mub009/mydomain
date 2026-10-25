<div class="space-y-4">
  <div class="card p-5">
    <h3 class="font-bold text-ink-900 mb-3 flex items-center gap-1.5"><x-icon name="image-plus" :size="16" class="text-brand-600" /> Photos</h3>
    @if (count($biz['photos'] ?? []) > 0)
      <div class="grid grid-cols-2 sm:grid-cols-3 gap-3">
        @foreach ($biz['photos'] as $p)
          <div class="relative group aspect-[4/3] rounded-lg overflow-hidden bg-gray-100">
            <img src="{{ $p['url'] }}" alt="{{ $p['caption'] ?? '' }}" class="h-full w-full object-cover" />
            <button type="button" data-delete-photo="{{ $p['id'] }}" class="absolute top-2 right-2 h-7 w-7 flex items-center justify-center rounded-full bg-white/90 text-red-500 shadow opacity-0 group-hover:opacity-100 transition-opacity" title="Remove"><x-icon name="trash-2" :size="14" /></button>
          </div>
        @endforeach
      </div>
    @else
      <p class="text-sm text-ink-500">No photos yet.</p>
    @endif
  </div>

  <form class="card p-5 space-y-3" data-photo-form>
    <h3 class="font-bold text-ink-900 flex items-center gap-1.5"><x-icon name="plus" :size="16" class="text-brand-600" /> Add a photo</h3>
    <x-upload-field name="url" purpose="business-photos" placeholder="Image URL (https://…)" />
    <input name="caption" placeholder="Caption (optional)" class="input" />
    <button class="btn-primary px-5 py-2.5" data-add-photo disabled>Add photo</button>
  </form>
</div>
