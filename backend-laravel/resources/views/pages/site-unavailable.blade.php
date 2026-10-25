@extends('layouts.bare')

@section('title', 'Website not available')

@section('content')
  <div class="flex min-h-screen items-center justify-center px-4">
    <div class="max-w-md text-center">
      <span class="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-gray-100 text-gray-400"><x-icon name="globe" :size="28" /></span>
      <h1 class="mt-4 text-lg font-bold text-ink-900">Website not available</h1>
      <p class="mt-1 text-sm text-ink-500">{{ $message ?: 'This business has not published a website yet.' }}</p>
      <a href="{{ \App\Support\SiteUrl::markkito('/business/'.$slug) }}" class="btn-primary mt-5 inline-flex px-4 py-2.5">View their listing instead</a>
    </div>
  </div>
@endsection
