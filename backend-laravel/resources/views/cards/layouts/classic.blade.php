<header class="c-hero">
  @if ($background)<div class="hero-bg" style="background-image:url('{{ $background }}')"></div>@endif
</header>
<div class="body c-body">
  <div class="c-logo">@include('cards.partials.logo')</div>
  <h1 class="name">{{ $b['name'] }}</h1>
  @if ($b['tagline'])<p class="tagline">{{ $b['tagline'] }}</p>@endif
  @include('cards.partials.details')
</div>
