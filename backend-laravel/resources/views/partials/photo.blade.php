{{-- Photo with graceful fallback: user-uploaded URLs may 404, so swap in a
     neutral placeholder rather than the browser's broken-image icon. --}}
<img src="{{ $url }}" alt="{{ $alt }}" data-on-error="fallback" class="h-full w-full object-cover" />
<div class="h-full w-full flex items-center justify-center bg-gray-100 text-gray-300" hidden><x-icon name="building-2" :size="32" /></div>
