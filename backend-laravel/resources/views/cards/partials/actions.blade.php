{{-- The tap-to-act buttons. Only those the business has details for appear. --}}
<div class="actions">
  @if ($b['phoneHref'])
    <a class="btn" href="{{ $b['phoneHref'] }}"><x-icon name="phone" :size="17" /> <span>Call</span></a>
  @endif
  @if ($b['whatsappHref'])
    <a class="btn alt" href="{{ $b['whatsappHref'] }}" target="_blank" rel="noopener"><x-icon name="message-square" :size="17" /> <span>WhatsApp</span></a>
  @endif
  @if ($b['mapsHref'])
    <a class="btn" href="{{ $b['mapsHref'] }}" target="_blank" rel="noopener"><x-icon name="navigation" :size="17" /> <span>Directions</span></a>
  @endif
  @if ($b['email'])
    <a class="btn" href="mailto:{{ $b['email'] }}"><x-icon name="mail" :size="17" /> <span>Email</span></a>
  @elseif ($b['website'])
    <a class="btn" href="{{ $b['website'] }}" target="_blank" rel="noopener"><x-icon name="globe" :size="17" /> <span>Website</span></a>
  @endif
</div>
