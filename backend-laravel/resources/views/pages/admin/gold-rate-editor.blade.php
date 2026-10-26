@extends('layouts.app')

@section('title', $template->name.' · Gold rate template')

@php
    $toolButton = 'btn-secondary h-9 px-2.5 text-sm disabled:cursor-not-allowed disabled:opacity-40';
@endphp

@section('content')
  {{-- The template editor: the master PNG on a canvas with the logo and
       rates drawn over it (resources/js/pages/gold-rate-editor.js). --}}
  <div class="space-y-4">
    <div class="flex flex-wrap items-center gap-3">
      <a href="/admin?tab={{ urlencode('Gold Rates') }}" class="btn-secondary px-3 py-2 text-sm"><x-icon name="arrow-left" :size="15" /> Templates</a>
      <input data-name value="{{ $template->name }}" maxlength="100" aria-label="Template name" class="input min-w-0 flex-1 py-2 text-base font-bold sm:max-w-sm" />
      <span class="text-xs text-ink-400">{{ $template->imageWidth }}×{{ $template->imageHeight }} px</span>
      <button type="button" data-change-image class="btn-secondary px-3 py-2 text-sm"><x-icon name="image" :size="15" /> Change image</button>
      <span data-status class="text-xs font-semibold text-emerald-700">All changes saved</span>
    </div>

    <div class="flex flex-wrap items-center gap-2">
      <div class="flex gap-1">
        <button type="button" data-undo class="{{ $toolButton }}" title="Undo (Ctrl+Z)" disabled><x-icon name="undo-2" :size="16" /></button>
        <button type="button" data-redo class="{{ $toolButton }}" title="Redo (Ctrl+Y)" disabled><x-icon name="redo-2" :size="16" /></button>
      </div>
      <div class="flex items-center gap-1">
        <button type="button" data-zoom-out class="{{ $toolButton }}" title="Zoom out"><x-icon name="zoom-out" :size="16" /></button>
        <button type="button" data-zoom-fit class="{{ $toolButton }} w-16 tabular-nums" title="Fit to screen"><span data-zoom-label>100%</span></button>
        <button type="button" data-zoom-in class="{{ $toolButton }}" title="Zoom in"><x-icon name="zoom-in" :size="16" /></button>
      </div>
      <div class="ml-auto flex flex-wrap gap-2">
        <button type="button" data-preview class="btn-secondary h-9 px-3 text-sm"><x-icon name="eye" :size="15" /> Preview</button>
        <button type="button" data-download class="btn-secondary h-9 px-3 text-sm"><x-icon name="download" :size="15" /> Download Final PNG</button>
        <button type="button" data-save class="btn-primary h-9 px-4 text-sm"><x-icon name="save" :size="15" /> Save</button>
      </div>
    </div>

    <p class="text-sm text-brand-700 bg-brand-50 rounded-md px-3 py-2" data-flash hidden></p>
    <p class="text-sm text-red-700 bg-red-50 rounded-md px-3 py-2" data-error hidden></p>

    <div class="grid gap-4 lg:grid-cols-[minmax(0,1fr)_340px]">
      <div class="min-w-0">
        <div data-viewport class="gold-checker relative h-[60vh] overflow-auto rounded-xl border border-gray-200 lg:h-[calc(100vh-15rem)] lg:min-h-[480px]">
          <div data-stage class="relative mx-auto select-none" style="width: 0; height: 0">
            <canvas data-canvas class="absolute inset-0 block h-full w-full shadow-card"></canvas>
            <div data-overlay class="absolute inset-0"></div>
          </div>
          <div data-loading class="absolute inset-0 flex items-center justify-center bg-white/70 text-sm text-ink-500">Loading template…</div>
        </div>
        <p class="mt-2 text-xs text-ink-400">Drag to move · drag the handles to resize (Shift keeps the shape) · Logo → “Draw logo area” to mark where the logo goes · arrow keys nudge 1px (Shift: 10px) · Ctrl+Z / Ctrl+Y · Ctrl+scroll to zoom · Ctrl+S saves</p>
      </div>

      <div class="space-y-4">
        <div class="card p-4">
          <h3 class="mb-2 text-sm font-bold text-ink-900">Elements</h3>
          <div class="space-y-1" data-elements></div>
        </div>
        <div class="card p-4" data-props></div>
        <div class="card p-4">
          <h3 class="text-sm font-bold text-ink-900">Gold rates</h3>
          <p class="mb-3 text-xs text-ink-500">Shared by every template — saved with <strong>Save</strong>.</p>
          <div class="grid grid-cols-2 gap-2" data-rates></div>
        </div>
      </div>
    </div>
  </div>

  <script type="application/json" id="gold-rate-editor-data">@json($editorData)</script>
  @include('pages.admin.partials.gold-rate-fonts')
@endsection

@push('scripts')
  @vite('resources/js/pages/gold-rate-editor.js')
@endpush
