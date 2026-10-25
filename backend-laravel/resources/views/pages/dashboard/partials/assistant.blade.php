{{-- The website assistant: a chat (typed or spoken) that proposes changes
     to this business, applied only once the owner confirms. Driven by
     resources/js/lib/assistant.js; see App\Support\SiteAssistant. --}}
<button type="button" data-assistant-open class="fixed bottom-5 right-5 z-40 inline-flex items-center gap-2 rounded-full bg-brand-600 px-5 py-3 text-sm font-semibold text-white shadow-lg hover:bg-brand-700">
  <x-icon name="sparkles" :size="18" /> Assistant
</button>

<section data-assistant hidden class="fixed inset-x-3 bottom-3 z-50 flex max-h-[80vh] flex-col overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-2xl sm:inset-x-auto sm:right-5 sm:bottom-5 sm:w-[400px]" aria-label="Website assistant">
  <header class="flex items-center justify-between gap-2 border-b border-gray-100 px-4 py-3">
    <div class="flex items-center gap-2">
      <span class="flex h-8 w-8 items-center justify-center rounded-full bg-brand-50 text-brand-600"><x-icon name="sparkles" :size="16" /></span>
      <div>
        <p class="text-sm font-bold text-ink-900">Website assistant</p>
        <p class="text-[11px] text-ink-500">Say or type what to change</p>
      </div>
    </div>
    <button type="button" data-assistant-close class="rounded-md p-1.5 text-ink-400 hover:bg-gray-100 hover:text-ink-700" aria-label="Close"><x-icon name="x" :size="18" /></button>
  </header>

  <div data-assistant-log class="flex-1 space-y-3 overflow-y-auto px-4 py-3 text-sm">
    <div class="rounded-2xl rounded-tl-sm bg-gray-100 px-3 py-2 text-ink-800">
      Hi! Tell me what to change on your listing and website — phone, address, description, opening hours, services or the website design. You can type, or tap the mic and speak.
    </div>
    <div class="flex flex-wrap gap-1.5" data-assistant-examples>
      @foreach (['Change my phone to 98470 12345', 'Open 9am to 9pm, closed on Sunday', 'Add a service Home delivery for ₹50', 'Use the Modern design'] as $example)
        <button type="button" class="rounded-full border border-gray-200 px-2.5 py-1 text-xs text-ink-600 hover:border-brand-300 hover:text-brand-700">{{ $example }}</button>
      @endforeach
    </div>
  </div>

  <form data-assistant-form class="border-t border-gray-100 p-3">
    <div class="flex items-end gap-2">
      <textarea name="message" rows="1" maxlength="1000" placeholder="e.g. We now close at 10 pm on Saturdays" class="input max-h-28 min-h-[42px] flex-1 resize-none py-2.5 text-sm"></textarea>
      <button type="button" data-assistant-mic hidden class="flex h-[42px] w-[42px] shrink-0 items-center justify-center rounded-lg border border-gray-200 text-ink-600 hover:bg-gray-50" aria-label="Speak"><x-icon name="mic" :size="18" /></button>
      <button class="flex h-[42px] w-[42px] shrink-0 items-center justify-center rounded-lg bg-brand-600 text-white hover:bg-brand-700 disabled:opacity-50" data-assistant-send aria-label="Send"><x-icon name="send" :size="17" /></button>
    </div>
    <div class="mt-1.5 flex items-center justify-between gap-2 text-[11px] text-ink-400" data-assistant-voice-row hidden>
      <span data-assistant-listening>Tap the mic to speak</span>
      <select data-assistant-lang class="rounded border-0 bg-transparent py-0 pl-0 pr-6 text-[11px] text-ink-500 focus:ring-0" aria-label="Speaking language">
        @foreach (['en-IN' => 'English', 'hi-IN' => 'हिन्दी', 'ml-IN' => 'മലയാളം', 'ta-IN' => 'தமிழ்', 'te-IN' => 'తెలుగు', 'kn-IN' => 'ಕನ್ನಡ', 'mr-IN' => 'मराठी', 'bn-IN' => 'বাংলা', 'gu-IN' => 'ગુજરાતી', 'ar-SA' => 'العربية'] as $code => $label)
          <option value="{{ $code }}">{{ $label }}</option>
        @endforeach
      </select>
    </div>
  </form>
</section>
