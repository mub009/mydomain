@extends('layouts.app')

@php
    $isNew = $template === null;
    $design = $template['design'] ?? $options['defaultDesign'];
    $colorLabels = [
        'primary' => 'Primary', 'accent' => 'Accent', 'background' => 'Page background', 'surface' => 'Card surface',
        'text' => 'Text', 'muted' => 'Secondary text', 'buttonText' => 'Button text',
    ];
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
      <form class="card space-y-5 p-5" data-template-form>
        <div class="grid gap-3 sm:grid-cols-2">
          <label class="block sm:col-span-2">
            <span class="mb-1 block text-xs font-semibold text-ink-700">Template name</span>
            <input name="name" required minlength="2" maxlength="80" value="{{ $template['name'] ?? '' }}" placeholder="e.g. Premium Restaurant" class="input" />
          </label>
          <label class="block">
            <span class="mb-1 block text-xs font-semibold text-ink-700">Category</span>
            <select name="categoryId" class="input" data-search-select data-search-placeholder="Search category…">
              <option value="">General — offered to any category</option>
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
          <label class="flex items-center gap-2"><input type="checkbox" name="isPremium" @checked($template['isPremium'] ?? false) /> Premium <span class="text-xs text-ink-500">(paid plans only)</span></label>
        </div>

        <div>
          <p class="mb-2 text-xs font-bold uppercase tracking-wide text-ink-500">Layout</p>
          <div class="grid grid-cols-1 gap-2 sm:grid-cols-2">
            @foreach ($options['layouts'] as $value => $label)
              <label class="cursor-pointer">
                <input type="radio" name="layout" value="{{ $value }}" class="peer sr-only" @checked(($template['layout'] ?? 'classic') === $value) />
                <span class="block rounded-lg border border-gray-300 px-3 py-2 text-sm text-ink-700 transition-colors hover:bg-gray-50 peer-checked:border-brand-500 peer-checked:bg-brand-50 peer-checked:text-brand-800">{{ $label }}</span>
              </label>
            @endforeach
          </div>
        </div>

        <div>
          <p class="mb-2 text-xs font-bold uppercase tracking-wide text-ink-500">Background image</p>
          <x-upload-field name="backgroundImageUrl" purpose="card-backgrounds" :value="$template['backgroundImageUrl'] ?? ''" placeholder="https://…/background.jpg" hint="Optional. Used in the card's header (or behind it, for the luxury layout). Without one, a gradient of the template colours is used — or the business's own cover photo." clearable />
          <div class="mt-2 flex flex-col gap-2 sm:flex-row">
            <input maxlength="200" class="input min-w-0 flex-1 text-sm" placeholder="AI style ideas (optional), e.g. soft bokeh of gold jewellery" data-ai-hint />
            <button type="button" class="btn-secondary shrink-0 px-3 py-2 text-sm" data-generate-background><x-icon name="sparkles" :size="14" /> <span>Generate with AI</span></button>
          </div>
          <p class="mt-1 text-[11px] text-ink-400">Made from the category, layout and colours above. No text is put in the image.</p>
          <label class="mt-3 block">
            <span class="mb-1 flex justify-between text-xs font-semibold text-ink-700">Darken the image <span class="font-normal text-ink-500" data-overlay-label>{{ round($design['overlay'] * 100) }}%</span></span>
            <input type="range" name="overlay" min="0" max="0.9" step="0.05" value="{{ $design['overlay'] }}" class="w-full" />
          </label>
        </div>

        <div>
          <p class="mb-2 text-xs font-bold uppercase tracking-wide text-ink-500">Fonts</p>
          <div class="grid gap-3 sm:grid-cols-2">
            @foreach (['heading' => 'Headings', 'body' => 'Body text'] as $key => $label)
              <label class="block">
                <span class="mb-1 block text-xs font-semibold text-ink-700">{{ $label }}</span>
                <select name="font_{{ $key }}" class="input">
                  @foreach ($options['fonts'] as $font)
                    <option value="{{ $font }}" @selected($design['fonts'][$key] === $font)>{{ $font }}</option>
                  @endforeach
                </select>
              </label>
            @endforeach
          </div>
        </div>

        <div>
          <p class="mb-2 text-xs font-bold uppercase tracking-wide text-ink-500">Colours</p>
          <div class="grid grid-cols-2 gap-3 sm:grid-cols-4">
            @foreach ($options['colorKeys'] as $key)
              <label class="block">
                <span class="mb-1 block text-xs font-semibold text-ink-700">{{ $colorLabels[$key] ?? $key }}</span>
                <span class="flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-2 py-1.5">
                  <input type="color" name="color_{{ $key }}" value="{{ $design['colors'][$key] }}" class="h-7 w-9 cursor-pointer rounded border-0 bg-transparent p-0" />
                  <span class="font-mono text-xs text-ink-500" data-color-value="{{ $key }}">{{ $design['colors'][$key] }}</span>
                </span>
              </label>
            @endforeach
          </div>
        </div>

        <div>
          <p class="mb-2 text-xs font-bold uppercase tracking-wide text-ink-500">Button style</p>
          <div class="flex flex-wrap gap-2">
            @foreach ($options['buttonStyles'] as $value => $label)
              <label class="cursor-pointer">
                <input type="radio" name="buttonStyle" value="{{ $value }}" class="peer sr-only" @checked($design['buttonStyle'] === $value) />
                <span class="block rounded-lg border border-gray-300 px-3 py-1.5 text-sm text-ink-700 transition-colors hover:bg-gray-50 peer-checked:border-brand-500 peer-checked:bg-brand-50 peer-checked:text-brand-800">{{ $label }}</span>
              </label>
            @endforeach
          </div>
        </div>

        <div class="flex flex-wrap items-center gap-2 border-t border-gray-100 pt-4">
          <button class="btn-primary px-5 py-2.5" data-save><x-icon name="save" :size="15" /> {{ $isNew ? 'Create template' : 'Save changes' }}</button>
          <span class="text-xs text-ink-500">Changes reach every card using this template as soon as they're saved.</span>
        </div>
      </form>

      <div class="lg:sticky lg:top-4 lg:self-start">
        <div class="card p-4">
          <div class="mb-3 flex items-center justify-between gap-2">
            <p class="text-sm font-semibold text-ink-900">Preview <span class="text-xs font-normal text-ink-500">with sample details</span></p>
            <input data-sample-name placeholder="Sample business name" maxlength="80" class="input max-w-[11rem] py-1.5 text-xs" />
          </div>
          <div class="flex justify-center">
            <iframe sandbox="" title="Template preview" class="h-[680px] w-full max-w-[390px] rounded-[28px] border-[6px] border-ink-900 bg-white" data-preview></iframe>
          </div>
        </div>
      </div>
    </div>
  </div>

  <script type="application/json" id="card-template-data">@json(['id' => $template['id'] ?? null])</script>
@endsection

@push('scripts')
  @vite('resources/js/pages/card-template-editor.js')
@endpush
