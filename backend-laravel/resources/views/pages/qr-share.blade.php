@extends('layouts.app')

@section('title', $boards->count().' QR '.($boards->count() === 1 ? 'board' : 'boards'))

@section('content')
  {{-- A set of QR boards the admin shared as one link (often on WhatsApp).
       Anyone with the link sees each QR and can download it, or all of them
       as a ZIP. The images are served from the same signed link. --}}
  @php
      $whatsApp = 'https://wa.me/?text='.rawurlencode('Markkito QR boards ('.$boards->count().'): open the link to see and download each QR code '.$shareUrl);
  @endphp
  <div class="mx-auto max-w-4xl">
    <div class="mb-5">
      <h1 class="text-xl font-bold text-ink-900">{{ $boards->count() }} QR {{ $boards->count() === 1 ? 'board' : 'boards' }}</h1>
      <p class="mt-1 text-sm text-ink-600">
        Download a QR code and print it. Each board waits until it is attached to a shop; after that a scan
        opens what it was set to (Google review, AI review, social media…).
      </p>
    </div>

    <div class="mb-6 grid gap-2 sm:grid-cols-3">
      <a href="/qr-share.zip?{{ $query }}" class="btn-primary py-2.5" data-share-zip>
        <x-icon name="download" :size="15" /> Download all ({{ $boards->count() }})
      </a>
      <a href="{{ $whatsApp }}" target="_blank" rel="noopener" class="btn-secondary py-2.5 !border-green-600 !text-green-700" data-share-whatsapp>
        <x-icon name="share-2" :size="15" /> Share on WhatsApp
      </a>
      <button type="button" class="btn-secondary py-2.5" data-copy-link="{{ $shareUrl }}">
        <x-icon name="copy" :size="15" /> <span>Copy link</span>
      </button>
    </div>

    <div class="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
      @foreach ($boards as $board)
        <div class="rounded-xl border border-gray-200 bg-white p-3 text-center shadow-sm" data-share-board="{{ $board->code }}">
          <img src="/qr-share/{{ $board->code }}.png?{{ $query }}" alt="QR code {{ $board->code }}" loading="lazy"
               width="200" height="200" class="mx-auto aspect-square w-full max-w-[220px] [image-rendering:pixelated]" />
          <p class="mt-1 font-mono text-sm font-bold text-ink-900">{{ $board->code }}</p>
          <p class="text-[11px] {{ $board->businessId ? 'text-green-700' : 'text-ink-500' }}">
            {{ $board->status === 'DISABLED' ? 'Disabled' : ($board->businessId ? 'Active' : 'Not assigned yet') }}
          </p>
          <a href="/qr-share/{{ $board->code }}.png?{{ $query }}&amp;download=1" download="{{ $board->code }}-qr.png"
             class="mt-2 inline-flex w-full items-center justify-center gap-1 rounded-lg bg-brand-50 px-2 py-2 text-xs font-semibold text-brand-700 hover:bg-brand-100">
            <x-icon name="download" :size="13" /> Download
          </a>
        </div>
      @endforeach
    </div>
  </div>
@endsection

@push('scripts')
  <script>
    document.querySelector('[data-copy-link]')?.addEventListener('click', async (e) => {
      const button = e.currentTarget;
      const label = button.querySelector('span');
      try {
        await navigator.clipboard.writeText(button.dataset.copyLink);
        label.textContent = 'Link copied';
      } catch {
        window.prompt('Copy this link', button.dataset.copyLink);
      }
      setTimeout(() => (label.textContent = 'Copy link'), 2000);
    });
  </script>
@endpush
