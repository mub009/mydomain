@extends('layouts.bare')

@section('title', $meta['name'].' · Website template')

@section('content')
  {{-- Full screen on purpose: no dashboard chrome, just the CSS editor and
       its live preview (resources/js/pages/site-template-editor.js). The
       preview is a real business's page — the only thing being edited here
       is the template's own stylesheet. --}}
  <div class="flex h-screen flex-col" data-template-editor>
    <div class="flex flex-wrap items-center gap-3 border-b border-gray-200 bg-white px-4 py-3">
      <a href="/admin?tab={{ urlencode('Website Templates') }}" class="btn-secondary px-3 py-2 text-sm"><x-icon name="arrow-left" :size="15" /> Templates</a>
      <div class="min-w-0">
        <h1 class="truncate font-bold text-ink-900">{{ $meta['name'] }}</h1>
        <p class="truncate text-xs text-ink-500">{{ $meta['description'] }}</p>
      </div>
      <span data-status class="ml-auto text-xs font-semibold text-ink-400"></span>
      <button type="button" data-save class="btn-primary px-4 py-2 text-sm"><x-icon name="save" :size="15" /> Save</button>
    </div>
    <p class="mx-4 mt-3 text-sm text-red-700 bg-red-50 rounded-md px-3 py-2" data-error hidden></p>

    <div class="grid min-h-0 flex-1 grid-cols-1 lg:grid-cols-[380px_1fr]">
      <div class="flex min-h-0 flex-col border-b border-gray-200 lg:border-b-0 lg:border-r">
        <div class="border-b border-gray-100 px-4 py-2.5">
          <p class="text-xs font-semibold text-ink-700">Custom CSS</p>
          <p class="mt-0.5 text-[11px] text-ink-400">Plain CSS, applied after the template's own rules — colours, fonts, spacing, anything a stylesheet can do. A business's own saved changes still win over this.</p>
        </div>
        <textarea data-css class="flex-1 resize-none border-0 bg-gray-50 p-4 font-mono text-xs text-ink-900 focus:outline-none focus:ring-0" spellcheck="false" placeholder=".about_section { background: #fafafa; }"></textarea>
      </div>
      <div class="min-h-0 bg-gray-100 p-3">
        <iframe data-preview title="Template preview" class="h-full w-full rounded-lg border border-gray-200 bg-white"></iframe>
      </div>
    </div>
  </div>

  <script type="application/json" id="site-template-editor-data">@json(['templateId' => $templateId])</script>
@endsection

@push('scripts')
  @vite('resources/js/pages/site-template-editor.js')
@endpush
