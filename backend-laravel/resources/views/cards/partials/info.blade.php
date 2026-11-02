<ul class="info">
  @if ($b['phone'])
    <li><span class="ico"><x-icon name="phone" :size="16" /></span><div><small>Phone</small><a href="{{ $b['phoneHref'] }}">{{ $b['phone'] }}</a></div></li>
  @endif
  @if ($b['email'])
    <li><span class="ico"><x-icon name="mail" :size="16" /></span><div><small>Email</small><a href="mailto:{{ $b['email'] }}">{{ $b['email'] }}</a></div></li>
  @endif
  @if ($b['website'])
    <li><span class="ico"><x-icon name="globe" :size="16" /></span><div><small>Website</small><a href="{{ $b['website'] }}" target="_blank" rel="noopener">{{ preg_replace('#^https?://(www\.)?#i', '', rtrim($b['website'], '/')) }}</a></div></li>
  @endif
  @if ($b['address'])
    <li><span class="ico"><x-icon name="map-pin" :size="16" /></span><div><small>Address</small><a href="{{ $b['mapsHref'] }}" target="_blank" rel="noopener">{{ $b['address'] }}</a></div></li>
  @endif
  @if ($b['hours'])
    <li><span class="ico"><x-icon name="clock" :size="16" /></span><div><small>Open</small><span>{{ $b['hours'] }}</span></div></li>
  @endif
</ul>
