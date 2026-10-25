@props(['total' => 0, 'page' => 1, 'perPage' => 20, 'options' => [5, 10, 20, 50]])
{{-- "Showing 1–10 of 42 · Show [10]": how many rows a list shows per page.
     A plain GET form that keeps the rest of the query string (tab, search)
     and starts again from page 1. --}}
@php
    $from = $total > 0 ? ($page - 1) * $perPage + 1 : 0;
    $to = min($total, $page * $perPage);
@endphp
<form method="GET" class="flex items-center justify-between gap-3 px-5 py-3 text-xs text-ink-500">
  @foreach (request()->except(['perPage', 'page']) as $key => $value)
    @if (is_string($value))
      <input type="hidden" name="{{ $key }}" value="{{ $value }}" />
    @endif
  @endforeach
  <span>Showing {{ $from }}–{{ $to }} of {{ $total }}</span>
  <label class="flex items-center gap-2">
    Show
    <select name="perPage" class="input !w-auto !py-1 !pl-2 !pr-7 text-xs" data-autosubmit>
      @foreach ($options as $n)
        <option value="{{ $n }}" @selected($n === $perPage)>{{ $n }}</option>
      @endforeach
    </select>
    per page
  </label>
</form>
