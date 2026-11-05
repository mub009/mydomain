@php
    $templates = $cardTemplates ?? [];
    $filters = ['category' => request('category'), 'status' => request('status'), 'search' => request('search')];
@endphp
{{-- Digital visiting card designs: any number per category (or general),
     each opened in the editor (/admin/card-templates/<id>). Actions are in
     resources/js/pages/card-templates.js. --}}
<div class="card overflow-hidden" data-card-templates>
  <div class="flex flex-wrap items-center justify-between gap-3 border-b border-gray-100 px-5 py-4">
    <div>
      <h2 class="font-semibold text-ink-900">Visiting card templates <span class="ml-1 text-sm font-normal text-ink-400">{{ count($templates) }}</span></h2>
      <p class="mt-0.5 text-xs text-ink-500">
        Upload a card image and place its actions. Businesses see their category's active designs (default first), plus the general ones;
        each action uses the business's own phone, WhatsApp, address… from its listing.
      </p>
    </div>
    <div class="flex gap-2">
      <a href="/admin/card-templates/new" class="btn-primary px-3 py-2 text-sm"><x-icon name="plus" :size="15" /> New template</a>
    </div>
  </div>

  <form method="get" action="/admin" class="flex flex-col gap-2 border-b border-gray-100 bg-gray-50/60 px-5 py-3 sm:flex-row">
    <input type="hidden" name="tab" value="Card Templates" />
    <input name="search" value="{{ $filters['search'] }}" placeholder="Search by name" class="input sm:max-w-xs" />
    <select name="category" class="input sm:max-w-xs" data-search-select data-search-placeholder="Search category…">
      <option value="">All categories</option>
      <option value="common" @selected($filters['category'] === 'common')>Common (every category)</option>
      <option value="general" @selected($filters['category'] === 'general')>General (fills in)</option>
      @foreach ($categories as $c)
        <option value="{{ $c['id'] }}" @selected($filters['category'] === $c['id'])>{{ $c['name'] }}</option>
      @endforeach
    </select>
    <select name="status" class="input sm:max-w-[10rem]">
      <option value="">Any status</option>
      @foreach (['active' => 'Active', 'inactive' => 'Inactive'] as $value => $label)
        <option value="{{ $value }}" @selected($filters['status'] === $value)>{{ $label }}</option>
      @endforeach
    </select>
    <button class="btn-secondary px-4 py-2 text-sm"><x-icon name="search" :size="14" /> Filter</button>
  </form>

  @if ($cardTemplates === null)
    <p class="px-5 py-8 text-center text-sm text-red-700">Could not load the templates.</p>
  @elseif (empty($templates))
    <div class="px-5 py-10 text-center">
      <p class="text-sm text-ink-500">No templates match.</p>
      <p class="mt-1 text-xs text-ink-400">Use “New template” to upload a card image and place its actions.</p>
    </div>
  @else
    <ul class="divide-y divide-gray-100">
      @foreach ($templates as $t)
        @php $c = $t['design']['colors']; @endphp
        <li class="flex flex-col gap-3 px-5 py-3 sm:flex-row sm:items-center" data-template-row="{{ $t['id'] }}">
          <a href="/admin/card-templates/{{ $t['id'] }}" class="flex min-w-0 flex-1 items-center gap-3">
            @if ($t['imageUrl'])
              <img src="{{ $t['imageUrl'] }}" alt="" loading="lazy" class="h-12 w-12 shrink-0 rounded-lg border border-gray-200 object-cover object-top" />
            @else
              <span class="flex h-12 w-12 shrink-0 overflow-hidden rounded-lg border border-gray-200" title="Colours">
                <span class="flex-1" style="background:{{ $c['primary'] }}"></span>
                <span class="flex-1" style="background:{{ $c['accent'] }}"></span>
                <span class="flex-1" style="background:{{ $c['background'] }}"></span>
              </span>
            @endif
            <span class="min-w-0">
              <span class="flex flex-wrap items-center gap-1.5">
                <span class="truncate font-semibold text-ink-900">{{ $t['name'] }}</span>
                @if ($t['isDefault'])<span class="badge bg-brand-50 text-brand-700">Default</span>@endif
                @unless ($t['isActive'])<span class="badge bg-red-50 text-red-700">Inactive</span>@endunless
              </span>
              <span class="block truncate text-xs text-ink-500">
                {{ $t['categoryName'] ?? (! empty($t['isCommon']) ? 'Common — every category' : 'General') }} ·
                @if ($t['imageUrl'])
                  Image card · {{ count($t['hotspots']) }} {{ count($t['hotspots']) === 1 ? 'action' : 'actions' }}
                @else
                  <span class="capitalize">{{ $t['layout'] }}</span> · {{ $t['design']['fonts']['heading'] }} / {{ $t['design']['fonts']['body'] }}
                @endif
                · {{ $t['usedBy'] }} {{ $t['usedBy'] === 1 ? 'card' : 'cards' }}
              </span>
            </span>
          </a>
          <div class="flex flex-wrap gap-1.5">
            <button type="button" class="btn-secondary px-2.5 py-1.5 text-xs" data-toggle="isActive" data-value="{{ $t['isActive'] ? 0 : 1 }}">{{ $t['isActive'] ? 'Deactivate' : 'Activate' }}</button>
            @unless ($t['isDefault'])
              <button type="button" class="btn-secondary px-2.5 py-1.5 text-xs" data-toggle="isDefault" data-value="1">Make default</button>
            @endunless
            <button type="button" class="btn-secondary px-2.5 py-1.5 text-xs" data-duplicate title="Duplicate"><x-icon name="copy" :size="13" /></button>
            <button type="button" class="btn-secondary px-2.5 py-1.5 text-xs !text-red-700" data-delete data-name="{{ $t['name'] }}" data-used="{{ $t['usedBy'] }}" title="Delete"><x-icon name="trash-2" :size="13" /></button>
          </div>
        </li>
      @endforeach
    </ul>
  @endif
</div>

@push('scripts')
  @vite('resources/js/pages/card-templates.js')
@endpush
