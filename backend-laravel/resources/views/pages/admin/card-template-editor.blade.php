@extends('layouts.app')

@php
    $isNew = $template === null;
@endphp

@section('title', ($isNew ? 'New template' : $template['name']).' · Card template')

@section('content')
  {{-- A digital-visiting-card template: settings on the left, the card as it
       will look (with sample details) on the right, redrawn as you change
       anything. Saved through /api/v1/admin/card-templates by
       resources/js/pages/card-template-editor.js. --}}
  <div class="space-y-4">
    <div class="flex flex-wrap items-center gap-3">
      <a href="/admin?tab={{ urlencode('Card Templates') }}" class="btn-secondary px-3 py-2 text-sm"><x-icon name="arrow-left" :size="15" /> Templates</a>
      <h1 class="text-lg font-bold text-ink-900">{{ $isNew ? 'New card template' : 'Edit card template' }}</h1>
      @if (! $isNew)
        <span class="text-xs text-ink-500">Used by {{ $template['usedBy'] }} {{ $template['usedBy'] === 1 ? 'card' : 'cards' }}</span>
      @endif
    </div>

    <p class="text-sm text-emerald-800 bg-emerald-50 rounded-md px-3 py-2" data-flash hidden></p>
    <p class="text-sm text-red-700 bg-red-50 rounded-md px-3 py-2" data-error hidden></p>

    <div class="grid gap-5 lg:grid-cols-[minmax(0,1fr)_420px]">
      <div class="min-w-0 space-y-5">
      {{-- Image template: an uploaded card artwork with actions dragged onto it.
           When set, it replaces the layout below on every card wearing this template. --}}
      <div class="card p-5" data-template-image>
        <div class="mb-4">
          <h2 class="flex items-center gap-1.5 font-bold text-ink-900"><x-icon name="image" :size="16" class="text-brand-600" /> Card image &amp; actions</h2>
          <p class="mt-0.5 text-sm text-ink-500">
            Upload a finished card design (JPG) and drag actions onto it. Each action uses the details of the business wearing the template —
            its phone, WhatsApp, address… — unless you type a fixed value. Each action's font, size and colours are set on the action itself.
          </p>
        </div>
        <x-hotspot-editor subject="the card" />

        {{-- Where a business's colour may go on this design: every card wearing it
             recolours only there (resources/js/lib/colour-areas.js). Saved with the template. --}}
        <div class="mt-4 rounded-lg border border-violet-200 bg-violet-50/60 p-3" data-template-areas>
          <p class="flex items-center gap-1.5 text-sm font-semibold text-ink-900"><x-icon name="palette" :size="15" class="text-violet-600" /> Colour areas</p>
          <p class="mt-0.5 text-xs text-ink-600" data-areas-status></p>
          <div class="mt-2 flex flex-wrap gap-2">
            <button type="button" class="btn-primary px-3 py-1.5 text-xs" data-areas-edit><x-icon name="pencil" :size="13" /> <span>Mark areas</span></button>
            <button type="button" class="btn-secondary px-3 py-1.5 text-xs !text-red-700" data-areas-clear hidden><x-icon name="trash-2" :size="13" /> Clear areas</button>
          </div>
        </div>

        {{-- Colour versions: the same design in other colours, each a swatch and its own image
             (a "sub-master" of this master design). On the open card the business picks one and
             wears that image; the boxes stay the master's. Saved with the template. --}}
        <div class="mt-4 rounded-lg border border-sky-200 bg-sky-50/60 p-3" data-template-variants>
          <p class="flex items-center gap-1.5 text-sm font-semibold text-ink-900"><x-icon name="palette" :size="15" class="text-sky-600" /> Colour versions</p>
          <p class="mt-0.5 text-xs text-ink-600" data-variants-status></p>
          <ul class="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3" data-variants-list></ul>
          <div class="mt-3 rounded-lg border border-sky-200 bg-white p-2.5" data-variant-add>
            <p class="mb-2 text-xs font-semibold text-ink-700">Add a colour version: pick its colour, then upload the design in that colour.</p>
            <div class="flex flex-wrap items-center gap-2" role="radiogroup" aria-label="Colour" data-variant-grid></div>
            <div class="mt-2 flex flex-wrap items-center gap-2">
              <button type="button" class="btn-primary px-3 py-1.5 text-xs" data-variant-upload><x-icon name="upload" :size="13" /> <span>Upload image for this colour</span></button>
              <input type="file" accept="image/png,image/jpeg,image/webp" class="hidden" data-variant-file />
            </div>
          </div>
        </div>
      </div>

      <form class="card space-y-5 p-5" data-template-form>
        <div class="grid gap-3 sm:grid-cols-2">
          <label class="block sm:col-span-2">
            <span class="mb-1 block text-xs font-semibold text-ink-700">Template name</span>
            <input name="name" required minlength="2" maxlength="80" value="{{ $template['name'] ?? '' }}" placeholder="e.g. Premium Restaurant" class="input" />
          </label>
          <label class="block">
            <span class="mb-1 block text-xs font-semibold text-ink-700">Category</span>
            <select name="categoryId" class="input" data-search-select data-search-placeholder="Search category…">
              <option value="common" @selected(! empty($template['isCommon']))>Common — shown in every category</option>
              <option value="" @selected(! empty($template) && empty($template['categoryId']) && empty($template['isCommon']))>General — fills in where a category has few designs</option>
              @foreach ($categories as $c)
                <option value="{{ $c['id'] }}" @selected(($template['categoryId'] ?? null) === $c['id'])>{{ $c['name'] }}</option>
              @endforeach
            </select>
          </label>
          <label class="block">
            <span class="mb-1 block text-xs font-semibold text-ink-700">Order in the picker</span>
            <input type="number" name="sortOrder" min="0" max="10000" value="{{ $template['sortOrder'] ?? '' }}" placeholder="After the others" class="input" />
          </label>
        </div>

        <div class="flex flex-wrap gap-x-6 gap-y-2 rounded-lg border border-gray-200 bg-gray-50/60 p-3 text-sm">
          <label class="flex items-center gap-2"><input type="checkbox" name="isActive" @checked($template['isActive'] ?? true) /> Active <span class="text-xs text-ink-500">(businesses can pick it)</span></label>
          <label class="flex items-center gap-2"><input type="checkbox" name="isDefault" @checked($template['isDefault'] ?? false) /> Default for its category</label>
        </div>

        {{-- The layout, colours and button style are kept as saved (defaults for new
             ones); they only matter to an old template without an image. --}}
        <input type="hidden" name="layout" value="{{ $template['layout'] ?? 'classic' }}" />

        <div class="flex flex-wrap items-center gap-2 border-t border-gray-100 pt-4">
          <button class="btn-primary px-5 py-2.5" data-save><x-icon name="save" :size="15" /> {{ $isNew ? 'Create template' : 'Save changes' }}</button>
          <span class="text-xs text-ink-500">Saves the image and actions above too. Changes reach every card using this template as soon as they're saved.</span>
        </div>
      </form>
      </div>

      <div class="lg:sticky lg:top-4 lg:self-start">
        <div class="card p-4">
          <div class="mb-3 flex items-center justify-between gap-2">
            <p class="text-sm font-semibold text-ink-900">Preview <span class="text-xs font-normal text-ink-500">with sample details</span></p>
            <input data-sample-name placeholder="Sample business name" maxlength="80" class="input max-w-[11rem] py-1.5 text-xs" />
          </div>
          <div class="flex justify-center">
            <iframe sandbox="allow-popups allow-popups-to-escape-sandbox" title="Template preview" class="h-[680px] w-full max-w-[390px] rounded-[28px] border-[6px] border-ink-900 bg-white" data-preview></iframe>
          </div>
        </div>
      </div>
    </div>
  </div>

  @php
      $templateData = [
          'id' => $template['id'] ?? null,
          'imageUrl' => $template['imageUrl'] ?? null,
          'imageWidth' => $template['imageWidth'] ?? null,
          'imageHeight' => $template['imageHeight'] ?? null,
          'hotspots' => $template['hotspots'] ?? [],
          'colourAreas' => $template['colourAreas'] ?? [],
          'colourVariants' => $template['colourVariants'] ?? [],
          'actions' => $options['actions'],
          'fonts' => $options['fonts'],
          'actionDefaults' => $options['actionDefaults'],
      ];
  @endphp
  <script type="application/json" id="card-template-data">@json($templateData)</script>
@endsection

@push('scripts')
  @vite('resources/js/pages/card-template-editor.js')
@endpush
