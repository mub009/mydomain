<div class="space-y-4">
  <div class="card p-5">
    <h3 class="font-bold text-ink-900 mb-3 flex items-center gap-1.5"><x-icon name="wrench" :size="16" class="text-brand-600" /> Services</h3>
    <div class="space-y-2">
      @forelse ($biz['services'] ?? [] as $s)
        <div class="border border-gray-100 rounded-lg p-3 flex items-center justify-between gap-3">
          <div class="min-w-0">
            <p class="font-medium text-sm text-ink-900">{{ $s['name'] }} @if (! $s['isActive'])<span class="text-xs text-ink-400">(hidden)</span>@endif</p>
            <p class="text-xs text-ink-500">{{ $s['priceCents'] > 0 ? $s['currency'].' '.number_format($s['priceCents'] / 100, 2) : 'Free' }} · {{ $s['durationMins'] }} mins</p>
          </div>
          <div class="flex items-center gap-2 shrink-0">
            <button type="button" data-toggle-service="{{ $s['id'] }}" data-active="{{ $s['isActive'] ? '1' : '0' }}" class="text-xs font-medium rounded-md border border-gray-200 px-2.5 py-1.5 hover:bg-gray-50">{{ $s['isActive'] ? 'Hide' : 'Show' }}</button>
            <button type="button" data-delete-service="{{ $s['id'] }}" class="text-red-500 hover:text-red-600 p-1.5" title="Delete"><x-icon name="trash-2" :size="15" /></button>
          </div>
        </div>
      @empty
        <p class="text-sm text-ink-500">No services yet.</p>
      @endforelse
    </div>
  </div>

  <form class="card p-5 space-y-3" data-service-form>
    <h3 class="font-bold text-ink-900 flex items-center gap-1.5"><x-icon name="plus" :size="16" class="text-brand-600" /> Add a service</h3>
    <input required name="name" placeholder="Service name" class="input" />
    <input name="description" placeholder="Description (optional)" class="input" />
    <div class="grid grid-cols-2 gap-3">
      <div>
        <label class="block text-xs font-semibold text-ink-700 mb-1">Price (INR)</label>
        <input type="number" min="0" step="0.01" name="price" placeholder="0.00" class="input" />
      </div>
      <div>
        <label class="block text-xs font-semibold text-ink-700 mb-1">Duration (mins)</label>
        <input type="number" min="5" name="durationMins" value="60" class="input" />
      </div>
    </div>
    <button class="btn-primary px-5 py-2.5">Add service</button>
  </form>
</div>
