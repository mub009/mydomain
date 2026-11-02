<header class="b-hero">
  @if ($background)<div class="hero-bg" style="background-image:url('{{ $background }}')"></div>@endif
  <div class="b-hero-inner">
    @include('cards.partials.logo')
    <div>
      <h1 class="name">{{ $b['name'] }}</h1>
      @if ($b['tagline'])<p class="tagline">{{ $b['tagline'] }}</p>@endif
    </div>
  </div>
</header>
<div class="body">
  @include('cards.partials.details')
</div>
