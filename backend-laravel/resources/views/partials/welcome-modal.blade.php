<div id="welcome-modal" class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" role="dialog" aria-modal="true" aria-labelledby="welcome-title" hidden>
  <div class="w-full max-w-md rounded-2xl bg-white p-7 shadow-xl">
    <div class="flex items-center gap-4">
      <span class="text-2xl font-extrabold tracking-tight">
        <span class="text-brand-600">Mark</span><span class="text-gold-500">kito</span>
      </span>
      <span class="h-10 w-px bg-gray-200"></span>
      <div>
        <h2 id="welcome-title" class="text-lg font-bold text-ink-900">Welcome</h2>
        <p class="text-sm text-ink-600">Enter your number for a seamless experience</p>
      </div>
    </div>

    <form class="mt-6 space-y-4" novalidate>
      <div data-error></div>

      <div class="flex items-stretch overflow-hidden rounded-xl border border-gray-300 focus-within:border-brand-500 focus-within:ring-2 focus-within:ring-brand-100">
        <span class="flex items-center border-r border-gray-200 px-4 text-base font-medium text-ink-600">+91</span>
        <input name="phone" inputmode="numeric" maxlength="10" placeholder="Enter Mobile Number" aria-label="Mobile number" class="w-full px-4 py-3.5 text-base focus:outline-none" />
      </div>

      <label class="flex items-start gap-2 text-sm text-ink-700">
        <input type="checkbox" name="agreed" checked class="mt-0.5" />
        <span>
          I agree to the Terms and Conditions, and to sharing my number and location so nearby businesses can be
          shown and can contact me.
        </span>
      </label>

      <p class="text-center">
        <a href="/terms" class="text-xs text-ink-500 underline hover:text-brand-600">T&amp;C's Privacy Policy</a>
      </p>

      <button data-submit class="w-full rounded-xl bg-brand-600 py-3.5 text-base font-bold text-white transition-colors hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-60">Continue</button>
      <button type="button" data-dismiss class="w-full text-sm text-ink-500 hover:text-ink-800">Maybe Later</button>
    </form>
  </div>
</div>
