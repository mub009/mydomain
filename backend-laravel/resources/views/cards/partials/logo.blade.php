<div class="logo">
  @if ($b['logoUrl'])
    <img src="{{ $b['logoUrl'] }}" alt="{{ $b['name'] }} logo" />
  @else
    <span class="initials">{{ $b['initials'] }}</span>
  @endif
</div>
