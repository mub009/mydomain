{{-- Every listing detail the card shows (App\Support\Cards\ImageCard::cardDetails),
     with its current value, to update right here: a textbox, drop-downs, or an
     upload for the logo and the design's free images. Missing ones come first,
     marked. Only opening hours link to their section. One Save button saves
     everything changed — resources/js/pages/card-manager.js. --}}
@php $missingCount = collect($card['cardDetails'])->where('missing', true)->count(); @endphp
<form @class(['rounded-xl border p-4', 'border-amber-200 bg-amber-50' => $missingCount, 'border-gray-200 bg-gray-50' => ! $missingCount]) data-card-details data-card-details-form novalidate>
  <p class="flex items-center gap-1.5 text-sm font-bold text-ink-900">
    <x-icon name="pencil" :size="15" class="text-brand-600" /> Card details
    @if ($missingCount)
      <span class="badge bg-amber-100 text-amber-800">{{ $missingCount }} missing</span>
    @else
      <span class="badge bg-emerald-50 text-emerald-700"><x-icon name="check" :size="11" /> All filled</span>
    @endif
  </p>
  <p class="mt-1 text-xs text-ink-600">What your card shows. Change anything here, then press Save — it's saved to your listing and on your card.</p>
  <ul class="mt-3 space-y-2">
    @foreach ($card['cardDetails'] as $m)
      @php
          $input = $m['key'] === 'custom_image' ? ['spotUrl', 'spot', 'image', 'https://… or upload a picture'] : (\App\Support\Cards\ImageCard::DETAIL_INPUTS[$m['key']] ?? null);
          $id = 'card-detail-'.($m['spot'] ?? $m['key']);
      @endphp
      <li @class(['rounded-lg bg-white px-3 py-2 text-sm', 'ring-1 ring-amber-300' => $m['missing']])>
        @if ($input)
          @php [$field, $via, $type, $placeholder] = $input; @endphp
          <div class="space-y-1.5" data-detail data-label="{{ $m['label'] }}" data-via="{{ $via }}" @if ($via === 'spot') data-spot="{{ $m['spot'] }}" @endif
               @if ($type === 'category-city') data-category-city data-initial-category="{{ $biz['category']['id'] ?? '' }}" data-initial-state="{{ $biz['state'] ?? '' }}" data-initial-city="{{ $biz['city'] ?? '' }}" @endif>
            <label class="flex items-center gap-1.5 text-xs font-semibold text-ink-900" for="{{ $id }}">
              {{ $m['label'] }}
              @if ($m['missing'])<span class="text-[10px] font-bold uppercase text-amber-700">Missing</span>@endif
            </label>
            @if ($type === 'image')
              @if ($m['value'])
                <img src="{{ $m['value'] }}" alt="" class="h-14 w-14 rounded-lg border border-gray-200 object-cover" />
              @endif
              <x-upload-field :name="$field" :purpose="$via === 'spot' ? 'card-images' : 'business-logo'" :remove-background="$via !== 'spot'" :value="$m['value'] ?? ''" :placeholder="$placeholder" />
            @elseif ($type === 'category-city')
              {{-- Category, state and city (area) from drop-downs — the same lists as Contact. --}}
              @if ($m['value'])<span class="block text-xs text-ink-500">{{ $m['value'] }}</span>@endif
              <select id="{{ $id }}" name="categoryId" class="input w-full py-1.5 text-sm" data-search-select data-search-placeholder="Search category…">
                <option value="">{{ $placeholder }}</option>
                @foreach ($categories ?? [] as $c)
                  <option value="{{ $c['id'] }}" @selected(($biz['category']['id'] ?? null) === $c['id'])>{{ $c['name'] }}</option>
                @endforeach
              </select>
              <div class="grid grid-cols-1 gap-2 sm:grid-cols-2">
                <x-state-city :state="$biz['state'] ?? ''" :city="$biz['city'] ?? ''" :required="false" />
              </div>
            @elseif ($type === 'textarea')
              <textarea id="{{ $id }}" name="{{ $field }}" rows="2" placeholder="{{ $placeholder }}" class="input w-full py-1.5 text-sm">{{ $m['value'] }}</textarea>
            @else
              <input id="{{ $id }}" type="{{ $type }}" name="{{ $field }}" value="{{ $m['value'] }}" placeholder="{{ $placeholder }}" class="input w-full py-1.5 text-sm" />
            @endif
          </div>
        @else
          <div class="flex items-center justify-between gap-2">
            <span class="min-w-0">
              <span class="flex items-center gap-1.5 text-xs font-semibold text-ink-900">
                {{ $m['label'] }}
                @if ($m['missing'])<span class="text-[10px] font-bold uppercase text-amber-700">Missing</span>@endif
              </span>
              @if ($m['value'])<span class="block truncate text-xs text-ink-500">{{ $m['value'] }}</span>@endif
            </span>
            <a href="{{ $base }}?section={{ urlencode($m['section']) }}" class="shrink-0 text-xs font-semibold text-brand-700 hover:underline">{{ $m['missing'] ? 'Add' : 'Change' }} in {{ $m['section'] }} →</a>
          </div>
        @endif
      </li>
    @endforeach
  </ul>
  @if (collect($card['cardDetails'])->contains(fn ($m) => $m['key'] === 'custom_image' || isset(\App\Support\Cards\ImageCard::DETAIL_INPUTS[$m['key']])))
    <div class="mt-3 flex items-center gap-3">
      <button class="btn-primary px-5 py-2 text-sm" data-card-details-save><x-icon name="check" :size="15" /> <span>Save</span></button>
      <p class="text-xs text-ink-500" data-card-details-status></p>
    </div>
  @endif
</form>
