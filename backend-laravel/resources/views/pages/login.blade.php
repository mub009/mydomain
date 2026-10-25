@extends('layouts.app')

@section('title', 'Log in')

@section('content')
  <x-auth-card title="Welcome back" subtitle="Log in to your Markkito account">
    <form method="POST" action="/login" class="space-y-4">
      @csrf
      <input type="hidden" name="next" value="{{ $next }}" />
      @if ($errors->any())
        <p class="text-sm text-red-700 bg-red-50 rounded-md px-3 py-2">{{ $errors->first() }}</p>
      @endif
      <div>
        <label class="block text-xs font-semibold text-ink-700 mb-1.5">Email or mobile number</label>
        <div class="relative">
          <x-icon name="mail" :size="16" class="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input required name="email" value="{{ old('email') }}" placeholder="you@example.com or 9876543210" autocomplete="username" class="input pl-11" />
        </div>
      </div>
      <div>
        <div class="flex items-center justify-between mb-1.5">
          <label class="block text-xs font-semibold text-ink-700">Password</label>
          <button type="button" class="text-xs text-brand-600 hover:underline">Forgot password?</button>
        </div>
        <div class="relative">
          <x-icon name="lock" :size="16" class="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input required type="password" name="password" placeholder="••••••••" class="input pl-11" />
        </div>
      </div>
      <button class="btn-primary w-full py-2.5" data-busy-label="Logging in…">Log in</button>
    </form>

    <x-slot:footer>
      No account? <a href="/register" class="text-brand-600 font-semibold hover:underline">Sign up</a>
    </x-slot:footer>
  </x-auth-card>
@endsection
