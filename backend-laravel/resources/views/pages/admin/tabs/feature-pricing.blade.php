{{-- Admin: feature pricing (App\Support\FeaturePlans) — per feature, the
     points, price and admin commission for a new sale and for a renewal,
     and how long it lasts. A timed feature switches off on its end date
     until the dealer renews it. Saved by resources/js/pages/admin.js
     ([data-feature-plans]). --}}
@php
    $fp = $featurePlans ?? null;
    $money = function (string $name, ?int $value, string $label, bool $renewal, ?int $months) {
        $disabled = $renewal && $months === null ? 'disabled' : '';
        $v = $value === null ? '' : $value;

        return '<div class="relative"><span class="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-sm text-ink-400">₹</span>'
            .'<input type="number" min="0" max="'.\App\Support\FeaturePlans::MAX_PRICE.'" step="1" class="input w-28 pl-6 disabled:bg-gray-50 disabled:text-ink-400" name="'.$name.'" value="'.e($v).'" placeholder="—" aria-label="'.e($label).'" data-renewal-field="'.($renewal ? 1 : 0).'" '.$disabled.' /></div>';
    };
@endphp

@if (! $fp)
  <p class="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">Could not load the feature pricing.</p>
@else
  {{-- Pricing groups: each has its own prices; dealers are put in one from Users → Edit. --}}
  <div class="card mb-4 p-4" data-pricing-groups>
    <div class="flex flex-wrap items-center justify-between gap-3">
      <div>
        <p class="flex items-center gap-1.5 text-sm font-bold text-ink-900"><x-icon name="users" :size="15" class="text-brand-600" /> Pricing groups</p>
        <p class="text-xs text-ink-500">Each group has its own prices. Put a dealer in a group from <b>Users → Edit</b>; dealers in no group pay the <b>default</b> group's prices.</p>
      </div>
      <button type="button" class="btn-primary px-3 py-2 text-sm" data-group-new><x-icon name="plus" :size="15" /> New group</button>
    </div>
    <div class="mt-3 flex flex-wrap gap-2">
      @foreach ($fp['groups'] as $g)
        <a href="/admin?tab={{ urlencode('Feature Pricing') }}&group={{ $g['id'] }}" @class([
            'inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm font-semibold transition',
            'border-brand-500 bg-brand-50 text-brand-700' => $g['id'] === $fp['group']['id'],
            'border-gray-200 text-ink-700 hover:border-brand-300' => $g['id'] !== $fp['group']['id'],
        ])>
          {{ $g['name'] }}
          @if ($g['isDefault'])<span class="rounded bg-amber-100 px-1.5 text-[10px] font-bold uppercase text-amber-800">Default</span>@endif
          <span class="text-xs font-normal text-ink-500">{{ $g['dealers'] }} {{ $g['dealers'] === 1 ? 'dealer' : 'dealers' }}</span>
        </a>
      @endforeach
    </div>
    <div class="mt-3 flex flex-wrap items-center gap-2 border-t border-gray-100 pt-3 text-sm">
      <span class="text-ink-500">Editing <b class="text-ink-900">{{ $fp['group']['name'] }}</b></span>
      <button type="button" class="btn-secondary px-2.5 py-1 text-xs" data-group-rename><x-icon name="pencil" :size="12" /> Rename</button>
      @unless ($fp['group']['isDefault'])
        <button type="button" class="btn-secondary px-2.5 py-1 text-xs" data-group-default><x-icon name="star" :size="12" /> Make default</button>
        <button type="button" class="btn-secondary px-2.5 py-1 text-xs !text-red-700 hover:!bg-red-50" data-group-delete><x-icon name="trash-2" :size="12" /> Delete group</button>
      @endunless
    </div>
  </div>
  <script type="application/json" id="pricing-group-data">@json(['group' => $fp['group'], 'groups' => $fp['groups']])</script>

  <form class="card p-5" data-feature-plans data-group-id="{{ $fp['group']['id'] }}">
    <div class="flex flex-wrap items-start justify-between gap-3">
      <div>
        <h3 class="flex items-center gap-1.5 font-bold text-ink-900"><x-icon name="coins" :size="16" class="text-brand-600" /> Feature pricing</h3>
        <p class="mt-0.5 max-w-3xl text-sm text-ink-500">
          <b>Points</b> are taken from the dealer's balance. <b>Price</b> is what the feature sells for, in rupees.
          <b>Commission</b> is the admin's share of each sale, which the dealer owes; dealers see their running total.
          The renewal columns apply each time a feature with an end date is renewed. A feature with an end date switches off on that day until it's renewed, and isn't refunded.
          Changes apply to features added or renewed from now on.
        </p>
      </div>
      <div class="flex items-center gap-3">
        <span class="text-xs font-semibold text-brand-700" data-plans-saved aria-live="polite"></span>
        <button type="submit" class="btn-primary px-4 py-2 text-sm"><x-icon name="save" :size="15" /> Save pricing</button>
      </div>
    </div>

    <div class="mt-4 overflow-x-auto">
      <table class="w-full min-w-[1100px] text-sm">
        <thead>
          <tr class="text-left text-[11px] font-semibold uppercase tracking-wide text-ink-500">
            <th class="pb-1 pr-3" rowspan="2">Feature</th>
            <th class="pb-1 pr-3 text-center border-b border-gray-200" colspan="3">New sale</th>
            <th class="pb-1 pr-3 text-center border-b border-gray-200" colspan="3">Renewal</th>
            <th class="pb-1" rowspan="2">Lasts</th>
          </tr>
          <tr class="border-b border-gray-200 text-left text-[11px] font-semibold uppercase tracking-wide text-ink-500">
            <th class="py-1.5 pr-3">Points</th>
            <th class="py-1.5 pr-3">Price</th>
            <th class="py-1.5 pr-3">Commission</th>
            <th class="py-1.5 pr-3">Points</th>
            <th class="py-1.5 pr-3">Price</th>
            <th class="py-1.5 pr-3">Commission</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-gray-100">
          @foreach ($fp['plans'] as $p)
            <tr data-plan="{{ $p['feature'] }}">
              <td class="py-3 pr-3">
                <span class="block font-semibold text-ink-900">{{ $p['label'] }}</span>
                <span class="block max-w-[14rem] text-xs text-ink-500">{{ \App\Support\BusinessFeatures::BLURBS[$p['feature']] }}</span>
              </td>
              <td class="py-3 pr-3"><input type="number" min="0" max="{{ \App\Support\FeaturePlans::MAX_POINTS }}" step="1" class="input w-20" name="points" value="{{ $p['points'] }}" aria-label="Points to add {{ $p['label'] }}" required /></td>
              <td class="py-3 pr-3">{!! $money('price', $p['price'], "Price of {$p['label']}", false, $p['months']) !!}</td>
              <td class="py-3 pr-3">{!! $money('commission', $p['commission'], "Admin commission on {$p['label']}", false, $p['months']) !!}</td>
              <td class="py-3 pr-3"><input type="number" min="0" max="{{ \App\Support\FeaturePlans::MAX_POINTS }}" step="1" class="input w-20 disabled:bg-gray-50 disabled:text-ink-400" name="renewalPoints" value="{{ $p['renewalPoints'] }}" aria-label="Points to renew {{ $p['label'] }}" data-renewal-field="1" @disabled($p['months'] === null) required /></td>
              <td class="py-3 pr-3">{!! $money('renewalPrice', $p['renewalPrice'], "Renewal price of {$p['label']}", true, $p['months']) !!}</td>
              <td class="py-3 pr-3">{!! $money('renewalCommission', $p['renewalCommission'], "Admin commission on renewing {$p['label']}", true, $p['months']) !!}</td>
              <td class="py-3">
                <select class="input" name="months">
                  @foreach ($fp['durations'] as $d)
                    <option value="{{ $d['months'] ?? '' }}" @selected($d['months'] === $p['months'])>{{ $d['label'] }}</option>
                  @endforeach
                </select>
              </td>
            </tr>
          @endforeach
        </tbody>
      </table>
    </div>
    <p class="mt-3 text-xs text-ink-500">Renewal columns are greyed out for unlimited features: they never need renewing.</p>
  </form>
@endif
