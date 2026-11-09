{{-- What the card has a place for but the listing lacks, each with a box to
     add it right here (App\Support\Cards\ImageCard::DETAIL_INPUTS): a textbox,
     or an upload for the logo. Only opening hours link to their section.
     Saved by resources/js/pages/card-manager.js. --}}
<div class="rounded-xl border border-amber-200 bg-amber-50 p-4" data-card-missing>
  <p class="flex items-center gap-1.5 text-sm font-bold text-amber-900"><x-icon name="alert-triangle" :size="15" /> Missing on your listing</p>
  <p class="mt-1 text-xs text-amber-800">Your card has a place for these, but your listing doesn't have them yet. Add them here and they appear on your card.</p>
  <ul class="mt-3 space-y-2">
    @foreach ($card['missingDetails'] as $m)
      @php $input = \App\Support\Cards\ImageCard::DETAIL_INPUTS[$m['key']] ?? null; @endphp
      <li class="rounded-lg bg-white px-3 py-2 text-sm">
        @if ($input)
          @php [$field, $via, $type, $placeholder] = $input; @endphp
          <form class="space-y-1.5" data-missing-form data-via="{{ $via }}">
            <label class="block text-xs font-semibold text-ink-900" for="missing-{{ $m['key'] }}">{{ $m['label'] }}</label>
            @if ($type === 'image')
              {{-- Uploading saves it straight away; a pasted link is saved with Save. --}}
              <x-upload-field :name="$field" purpose="business-logo" remove-background :placeholder="$placeholder" data-missing-upload />
              <button class="btn-primary px-3 py-1.5 text-xs" data-missing-save>Save</button>
            @elseif ($type === 'textarea')
              <textarea id="missing-{{ $m['key'] }}" name="{{ $field }}" rows="2" required placeholder="{{ $placeholder }}" class="input w-full py-1.5 text-sm"></textarea>
              <button class="btn-primary px-3 py-1.5 text-xs" data-missing-save>Save</button>
            @else
              <div class="flex gap-2">
                <input id="missing-{{ $m['key'] }}" type="{{ $type }}" name="{{ $field }}" required placeholder="{{ $placeholder }}" class="input min-w-0 flex-1 py-1.5 text-sm" />
                <button class="btn-primary shrink-0 px-3 py-1.5 text-xs" data-missing-save>Save</button>
              </div>
            @endif
          </form>
        @else
          <div class="flex items-center justify-between gap-2">
            <span class="font-semibold text-ink-900">{{ $m['label'] }}</span>
            <a href="{{ $base }}?section={{ urlencode($m['section']) }}" class="shrink-0 text-xs font-semibold text-brand-700 hover:underline">Add in {{ $m['section'] }} →</a>
          </div>
        @endif
      </li>
    @endforeach
  </ul>
</div>
