@php
    use Illuminate\Support\Carbon;
    use App\Models\GoldRate;
    $rates = $goldRates['rates'] ?? array_fill_keys(GoldRate::PURITIES, null);
    $ratesUpdated = $goldRates['updatedAt'] ?? null;
    $templates = $goldTemplates ?? [];
    $logos = $goldLogos ?? [];
@endphp
{{-- Gold-rate posters: today's rates, the templates they're printed on, and
     the logos. Each template opens in the editor (GoldRatePageController). --}}
<div class="space-y-6">
  {{-- Today's rates --}}
  <form class="card p-5" data-gold-rates-form>
    <div class="flex flex-wrap items-start justify-between gap-3">
      <div>
        <h2 class="font-semibold text-ink-900">Today's gold rates</h2>
        <p class="mt-0.5 text-xs text-ink-500">
          Shared by every template. Leave a rate empty to show “—”.
          @if ($ratesUpdated)
            Last updated {{ Carbon::parse($ratesUpdated)->timezone(config('app.timezone'))->format('j M Y, g:i a') }}.
          @endif
        </p>
      </div>
      <button class="btn-primary px-4 py-2 text-sm" data-save-rates><x-icon name="save" :size="15" /> Save rates</button>
    </div>
    <div class="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
      @foreach (GoldRate::PURITIES as $purity)
        <label class="block">
          <span class="mb-1 block text-xs font-semibold text-ink-700">{{ $purity }} rate</span>
          <input type="number" name="{{ $purity }}" value="{{ $rates[$purity] ?? '' }}" min="0" step="0.01" inputmode="decimal" placeholder="e.g. 6850" class="input" />
        </label>
      @endforeach
    </div>
    <p class="mt-3 text-sm text-red-700 bg-red-50 rounded-md px-3 py-2" data-rates-error hidden></p>
  </form>

  {{-- Templates --}}
  <div class="card overflow-hidden">
    <div class="flex flex-wrap items-center justify-between gap-3 border-b border-gray-100 px-5 py-4">
      <div>
        <h2 class="font-semibold text-ink-900">Templates <span class="ml-1 text-sm font-normal text-ink-400">{{ count($templates) }}</span></h2>
        <p class="mt-0.5 text-xs text-ink-500">Each template is a master PNG, kept exactly as uploaded, with the logo and rates placed on it.</p>
      </div>
    </div>

    <form class="flex flex-col gap-3 border-b border-gray-100 bg-gray-50/60 px-5 py-4 sm:flex-row sm:items-end" data-new-template>
      <label class="block flex-1">
        <span class="mb-1 block text-xs font-semibold text-ink-700">Template name</span>
        <input name="name" required maxlength="100" placeholder="e.g. Daily rate — Instagram square" class="input" />
      </label>
      <label class="block flex-1">
        <span class="mb-1 block text-xs font-semibold text-ink-700">Master PNG</span>
        <input type="file" name="file" required accept="image/png" class="block w-full text-sm text-ink-600 file:mr-3 file:rounded-lg file:border-0 file:bg-brand-50 file:px-3 file:py-2 file:text-sm file:font-semibold file:text-brand-700 hover:file:bg-brand-100" />
      </label>
      @if (count($logos) > 0)
        <label class="block sm:w-48">
          <span class="mb-1 block text-xs font-semibold text-ink-700">Logo</span>
          <select name="logoId" class="input">
            <option value="">No logo</option>
            @foreach ($logos as $logo)
              <option value="{{ $logo['id'] }}">{{ $logo['name'] }}</option>
            @endforeach
          </select>
        </label>
      @endif
      <button class="btn-primary shrink-0 px-4 py-2.5 text-sm" data-upload-template><x-icon name="upload" :size="15" /> Upload &amp; edit</button>
    </form>
    <p class="mx-5 mt-3 text-sm text-red-700 bg-red-50 rounded-md px-3 py-2" data-template-error hidden></p>

    @if ($goldTemplates === null)
      <p class="px-5 py-8 text-center text-sm text-red-700">Could not load the templates.</p>
    @elseif (count($templates) === 0)
      <div class="px-5 py-12 text-center">
        <span class="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-gray-100 text-ink-400"><x-icon name="image" :size="22" /></span>
        <p class="mt-3 font-semibold text-ink-900">No templates yet</p>
        <p class="mt-1 text-sm text-ink-500">Upload a master PNG above to make your first gold-rate poster.</p>
      </div>
    @else
      <div class="grid gap-4 p-5 sm:grid-cols-2 lg:grid-cols-3">
        @foreach ($templates as $t)
          <div class="flex flex-col overflow-hidden rounded-xl border border-gray-200">
            <a href="/admin/gold-rates/templates/{{ $t['id'] }}" class="gold-checker flex h-48 items-center justify-center border-b border-gray-100 p-2">
              <img src="{{ $t['thumbUrl'] }}" alt="" loading="lazy" class="max-h-full max-w-full object-contain" />
            </a>
            <div class="flex flex-1 flex-col gap-3 p-4">
              <div class="min-w-0">
                <a href="/admin/gold-rates/templates/{{ $t['id'] }}" class="block truncate font-semibold text-ink-900 hover:text-brand-600">{{ $t['name'] }}</a>
                <p class="mt-0.5 truncate text-xs text-ink-500">
                  {{ $t['imageWidth'] }}×{{ $t['imageHeight'] }} px
                  · {{ ($t['layout']['logo']['source'] ?? 'library') === 'business' ? 'Business logo' : ($t['logo']['name'] ?? 'No logo') }}
                  · {{ collect($t['layout']['fields'])->filter(fn ($f) => $f['visible'])->keys()->implode(', ') ?: 'No rates shown' }}
                </p>
                @if (! empty($t['businessCard']))
                  <p class="mt-0.5 flex items-center gap-1 truncate text-xs font-medium text-brand-700"><x-icon name="building-2" :size="12" /> {{ $t['businessCard']['name'] }}</p>
                @endif
                <p class="text-xs text-ink-400">Updated {{ Carbon::parse($t['updatedAt'])->timezone(config('app.timezone'))->format('j M Y, g:i a') }}</p>
              </div>
              <div class="mt-auto flex flex-wrap gap-2">
                <a href="/admin/gold-rates/templates/{{ $t['id'] }}" class="btn-primary px-3 py-1.5 text-sm"><x-icon name="pencil" :size="14" /> Edit</a>
                <button type="button" data-download-template="{{ $t['id'] }}" class="btn-secondary px-3 py-1.5 text-sm"><x-icon name="download" :size="14" /> PNG</button>
                <button type="button" data-duplicate-template="{{ $t['id'] }}" class="btn-secondary px-2.5 py-1.5 text-sm" title="Duplicate"><x-icon name="copy" :size="14" /></button>
                <button type="button" data-delete-template="{{ json_encode(['id' => $t['id'], 'name' => $t['name']]) }}" class="btn-secondary px-2.5 py-1.5 text-sm !text-red-700 hover:!bg-red-50" title="Delete"><x-icon name="trash-2" :size="14" /></button>
              </div>
            </div>
          </div>
        @endforeach
      </div>
    @endif
  </div>

  {{-- Logos --}}
  <div class="card overflow-hidden">
    <div class="border-b border-gray-100 px-5 py-4">
      <h2 class="font-semibold text-ink-900">Logos <span class="ml-1 text-sm font-normal text-ink-400">{{ count($logos) }}</span></h2>
      <p class="mt-0.5 text-xs text-ink-500">A transparent PNG works best. Pick which one a template uses in its editor.</p>
    </div>
    <form class="flex flex-col gap-3 border-b border-gray-100 bg-gray-50/60 px-5 py-4 sm:flex-row sm:items-end" data-new-logo>
      <label class="block flex-1">
        <span class="mb-1 block text-xs font-semibold text-ink-700">Name (optional)</span>
        <input name="name" maxlength="100" placeholder="e.g. Shop logo — white" class="input" />
      </label>
      <label class="block flex-1">
        <span class="mb-1 block text-xs font-semibold text-ink-700">Logo image</span>
        <input type="file" name="file" required accept="image/png,image/webp,image/jpeg" class="block w-full text-sm text-ink-600 file:mr-3 file:rounded-lg file:border-0 file:bg-brand-50 file:px-3 file:py-2 file:text-sm file:font-semibold file:text-brand-700 hover:file:bg-brand-100" />
      </label>
      <button class="btn-secondary shrink-0 px-4 py-2.5 text-sm"><x-icon name="upload" :size="15" /> Upload logo</button>
    </form>
    <p class="mx-5 mt-3 text-sm text-red-700 bg-red-50 rounded-md px-3 py-2" data-logo-error hidden></p>
    @if (count($logos) === 0)
      <p class="px-5 py-8 text-center text-sm text-ink-500">No logos yet.</p>
    @else
      <div class="grid grid-cols-2 gap-3 p-5 sm:grid-cols-4 lg:grid-cols-6">
        @foreach ($logos as $logo)
          <div class="overflow-hidden rounded-lg border border-gray-200">
            <div class="gold-checker flex h-24 items-center justify-center p-2"><img src="{{ $logo['url'] }}" alt="" loading="lazy" class="max-h-full max-w-full object-contain" /></div>
            <div class="flex items-start justify-between gap-2 p-2.5">
              <div class="min-w-0">
                <p class="truncate text-sm font-semibold text-ink-900" title="{{ $logo['name'] }}">{{ $logo['name'] }}</p>
                <p class="text-[11px] text-ink-400">{{ $logo['width'] }}×{{ $logo['height'] }} · {{ $logo['templates_count'] }} template{{ $logo['templates_count'] === 1 ? '' : 's' }}</p>
              </div>
              <button type="button" data-delete-logo="{{ json_encode(['id' => $logo['id'], 'name' => $logo['name'], 'used' => $logo['templates_count']]) }}" class="shrink-0 rounded p-1 text-ink-400 hover:bg-red-50 hover:text-red-700" title="Delete logo"><x-icon name="trash-2" :size="14" /></button>
            </div>
          </div>
        @endforeach
      </div>
    @endif
  </div>
</div>

<script type="application/json" id="gold-rates-data">@json(['templates' => $templates, 'rates' => $rates])</script>
@include('pages.admin.partials.gold-rate-fonts')
@push('scripts')
  @vite('resources/js/pages/gold-rates.js')
@endpush
