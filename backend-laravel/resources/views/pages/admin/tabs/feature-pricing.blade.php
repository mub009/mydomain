{{-- Admin: feature pricing (App\Support\FeaturePlans) — what each feature
     costs a dealer in points and how long it lasts. A timed feature switches
     off on its end date until the dealer renews it for the same points.
     Saved by resources/js/pages/admin.js ([data-feature-plans]). --}}
@php $fp = $featurePlans ?? null; @endphp

@if (! $fp)
  <p class="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">Could not load the feature pricing.</p>
@else
  <form class="card p-5" data-feature-plans>
    <div class="flex flex-wrap items-start justify-between gap-3">
      <div>
        <h3 class="flex items-center gap-1.5 font-bold text-ink-900"><x-icon name="coins" :size="16" class="text-brand-600" /> Feature pricing</h3>
        <p class="mt-0.5 max-w-2xl text-sm text-ink-500">
          What dealers pay, in points, to give a business each feature, and how long it lasts.
          A feature with an end date switches off on that day until the dealer renews it, which costs the same points again.
          Timed features aren't refunded. Changes apply to features added or renewed from now on.
        </p>
      </div>
      <div class="flex items-center gap-3">
        <span class="text-xs font-semibold text-brand-700" data-plans-saved aria-live="polite"></span>
        <button type="submit" class="btn-primary px-4 py-2 text-sm"><x-icon name="save" :size="15" /> Save pricing</button>
      </div>
    </div>

    <div class="mt-4 overflow-x-auto">
      <table class="w-full min-w-[520px] text-sm">
        <thead>
          <tr class="border-b border-gray-200 text-left text-xs font-semibold uppercase tracking-wide text-ink-500">
            <th class="py-2 pr-3">Feature</th>
            <th class="py-2 pr-3 w-36">Cost (points)</th>
            <th class="py-2 w-48">Lasts</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-gray-100">
          @foreach ($fp['plans'] as $p)
            <tr data-plan="{{ $p['feature'] }}">
              <td class="py-3 pr-3">
                <span class="block font-semibold text-ink-900">{{ $p['label'] }}</span>
                <span class="block text-xs text-ink-500">{{ \App\Support\BusinessFeatures::BLURBS[$p['feature']] }}</span>
              </td>
              <td class="py-3 pr-3"><input type="number" min="0" max="{{ \App\Support\FeaturePlans::MAX_POINTS }}" step="1" class="input w-28" name="points" value="{{ $p['points'] }}" required /></td>
              <td class="py-3">
                <select class="input" name="months">
                  @foreach ($fp['durations'] as $d)
                    <option value="{{ $d['months'] ?? '' }}" @selected($d['months'] === $p['months'])>{{ $d['label'] }}{{ $d['months'] ? ' — then renew' : '' }}</option>
                  @endforeach
                </select>
              </td>
            </tr>
          @endforeach
        </tbody>
      </table>
    </div>
  </form>
@endif
