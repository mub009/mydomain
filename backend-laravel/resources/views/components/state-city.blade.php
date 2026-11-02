@props(['state' => '', 'city' => '', 'labels' => false, 'required' => true])
{{-- State and City drop-downs (states/cities tables, StateCitySeeder). The
     city list follows the chosen state; "Other" swaps in a text box for a
     town that isn't listed. Submits as `state` and `city`, like the text
     inputs it replaced. The wrapper is display:contents, so the two fields
     sit straight in the parent's grid. Wired up by initStateCity() in
     resources/js/lib/state-city.js — until then each select holds just the
     saved value, so the form still works. --}}
@php($state = (string) $state)
@php($city = (string) $city)
<div class="contents" data-state-city data-state="{{ $state }}" data-city="{{ $city }}">
  <div class="min-w-0">
    @if ($labels)
      <label class="block text-xs font-semibold text-ink-700 mb-1">State</label>
    @endif
    <select name="state" class="input min-w-0" data-state-select @if ($required) required @endif>
      <option value="">Select state</option>
      @if ($state !== '')
        <option value="{{ $state }}" selected>{{ $state }}</option>
      @endif
    </select>
  </div>
  <div class="min-w-0">
    @if ($labels)
      <label class="block text-xs font-semibold text-ink-700 mb-1">City</label>
    @endif
    <select name="city" class="input min-w-0" data-city-select @if ($required) required @endif>
      <option value="">Select city</option>
      @if ($city !== '')
        <option value="{{ $city }}" selected>{{ $city }}</option>
      @endif
    </select>
    <input class="input mt-2 min-w-0" maxlength="100" placeholder="Type your city / town" data-city-other hidden />
  </div>
</div>
