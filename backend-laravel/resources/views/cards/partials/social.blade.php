@if ($b['social'])
  <div class="social">
    @foreach ($b['social'] as $network => $url)
      <a href="{{ $url }}" target="_blank" rel="noopener" aria-label="{{ ucfirst($network) }}"><x-icon :name="$network" :size="18" /></a>
    @endforeach
  </div>
@endif
