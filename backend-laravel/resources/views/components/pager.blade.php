@props(['page' => 1, 'totalPages' => 1, 'fragment' => null])
{{-- Compact pager: « Prev · 1 … n · Next », as plain links that keep the
     current query string. Renders nothing when there's only one page. --}}
@if ($totalPages > 1)
  @php
      $pages = [];
      for ($p = 1; $p <= $totalPages; $p++) {
          if ($p === 1 || $p === $totalPages || abs($p - $page) <= 1) {
              $pages[] = $p;
          } elseif (end($pages) !== '…') {
              $pages[] = '…';
          }
      }
      $url = function (int $p) use ($fragment) {
          $query = array_merge(request()->query(), ['page' => $p]);
          if ($p === 1) {
              unset($query['page']);
          }
          $qs = http_build_query($query);

          return request()->url().($qs ? "?{$qs}" : '').($fragment ? "#{$fragment}" : '');
      };
      $edge = 'btn-secondary px-2.5 py-1.5 text-sm';
  @endphp
  <div {{ $attributes->merge(['class' => 'flex items-center justify-center gap-1 mt-4']) }}>
    @if ($page > 1)
      <a href="{{ $url($page - 1) }}" class="{{ $edge }}" aria-label="Previous page"><x-icon name="chevron-left" :size="15" /></a>
    @else
      <span class="{{ $edge }} opacity-40 cursor-not-allowed" aria-hidden="true"><x-icon name="chevron-left" :size="15" /></span>
    @endif
    @foreach ($pages as $p)
      @if ($p === '…')
        <span class="px-1.5 text-sm text-ink-400">…</span>
      @else
        <a href="{{ $url($p) }}" @class([
            'min-w-[34px] rounded-lg px-2.5 py-1.5 text-sm font-semibold text-center transition-colors',
            'bg-brand-600 text-white' => $p === $page,
            'text-ink-600 hover:bg-brand-50 hover:text-brand-700' => $p !== $page,
        ])>{{ $p }}</a>
      @endif
    @endforeach
    @if ($page < $totalPages)
      <a href="{{ $url($page + 1) }}" class="{{ $edge }}" aria-label="Next page"><x-icon name="chevron-right" :size="15" /></a>
    @else
      <span class="{{ $edge }} opacity-40 cursor-not-allowed" aria-hidden="true"><x-icon name="chevron-right" :size="15" /></span>
    @endif
  </div>
@endif
