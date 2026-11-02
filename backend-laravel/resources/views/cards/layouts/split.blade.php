<div class="s-wrap">
  <aside class="s-panel">
    @if ($background)<div class="hero-bg" style="background-image:url('{{ $background }}')"></div>@endif
    <div class="s-panel-inner">
      @include('cards.partials.logo')
      <h1 class="name">{{ $b['name'] }}</h1>
      @if ($b['tagline'])<p class="tagline">{{ $b['tagline'] }}</p>@endif
    </div>
  </aside>
  <div class="body s-body">
    @include('cards.partials.details')
  </div>
</div>
