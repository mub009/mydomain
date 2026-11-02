{{-- Everything below the header, shared by every layout. --}}
@if ($b['description'])
  <p class="about">{{ $b['description'] }}</p>
@endif
@include('cards.partials.actions')
@include('cards.partials.info')
@include('cards.partials.social')
@include('cards.partials.footer')
