@props(['value' => ''])
{{-- The description box on the listing forms: filled in for the owner from
     the name and category (App\Support\AiWriter — an AI service, or the free
     built-in writer), with a "Write with AI" button for a fresh version.
     Wired up by resources/js/lib/ai-describe.js. --}}
<div data-ai-description>
  <div class="mb-1 flex items-center justify-between gap-2">
    <label class="block text-xs font-semibold text-ink-700">Description</label>
    <button type="button" data-ai-write class="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-semibold text-brand-600 hover:bg-brand-50 disabled:opacity-50">
      <x-icon name="sparkles" :size="13" /> Write with AI
    </button>
  </div>
  <textarea name="description" maxlength="2000" class="input min-h-24" placeholder="Written for you once the name and category are in — or type your own">{{ $value }}</textarea>
  <p class="mt-1 text-[11px] text-ink-500" data-ai-status hidden></p>
</div>
