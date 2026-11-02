<div class="l-frame">
  @if ($background)<div class="hero-bg" style="background-image:url('{{ $background }}')"></div>@endif
  <div class="l-inner">
    <div class="l-ornament">&#10022; &#10022; &#10022;</div>
    @include('cards.partials.logo')
    <h1 class="name">{{ $b['name'] }}</h1>
    @if ($b['tagline'])<p class="tagline">{{ $b['tagline'] }}</p>@endif
    <div class="l-rule"></div>
    @include('cards.partials.details')
  </div>
</div>
