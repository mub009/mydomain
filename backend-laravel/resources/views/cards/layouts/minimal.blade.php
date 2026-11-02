<div class="body m-body">
  <div class="m-head">
    @include('cards.partials.logo')
    <div>
      <h1 class="name">{{ $b['name'] }}</h1>
      @if ($b['tagline'])<p class="tagline">{{ $b['tagline'] }}</p>@endif
    </div>
  </div>
  @if ($background)<div class="m-photo" style="background-image:url('{{ $background }}')"></div>@endif
  @include('cards.partials.details')
</div>
