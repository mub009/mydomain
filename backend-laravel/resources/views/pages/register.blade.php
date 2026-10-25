@extends('layouts.app')

@section('title', 'Sign up')

@section('content')
  @php $role = old('role', 'CUSTOMER'); @endphp
  <x-auth-card title="Create your account" subtitle="Join Markkito in seconds">
    <form method="POST" action="/register" class="space-y-4">
      @csrf
      @if ($errors->any())
        <p class="text-sm text-red-700 bg-red-50 rounded-md px-3 py-2">{{ $errors->first() }}</p>
      @endif
      <div class="flex gap-3">
        <div class="w-1/2">
          <label class="block text-xs font-semibold text-ink-700 mb-1.5">First name</label>
          <input required name="firstName" value="{{ old('firstName') }}" class="input" />
        </div>
        <div class="w-1/2">
          <label class="block text-xs font-semibold text-ink-700 mb-1.5">Last name</label>
          <input required name="lastName" value="{{ old('lastName') }}" class="input" />
        </div>
      </div>
      <div>
        <label class="block text-xs font-semibold text-ink-700 mb-1.5">Email</label>
        <div class="relative">
          <x-icon name="mail" :size="16" class="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input required type="email" name="email" value="{{ old('email') }}" placeholder="you@example.com" class="input pl-11" />
        </div>
      </div>
      <div>
        <label class="block text-xs font-semibold text-ink-700 mb-1.5">Password</label>
        <div class="relative">
          <x-icon name="lock" :size="16" class="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input required type="password" name="password" minlength="8" placeholder="Min. 8 characters" class="input pl-11" />
        </div>
      </div>
      <div>
        <label class="block text-xs font-semibold text-ink-700 mb-1.5">I am a…</label>
        <div class="grid grid-cols-2 gap-2" data-role-picker>
          @foreach ([['CUSTOMER', 'user', 'Customer'], ['BUSINESS_OWNER', 'briefcase', 'Business owner']] as [$value, $icon, $label])
            <label class="cursor-pointer">
              <input type="radio" name="role" value="{{ $value }}" class="peer sr-only" @checked($role === $value) />
              <span class="flex items-center justify-center gap-1.5 rounded-lg border py-2.5 text-sm font-medium transition-colors bg-white text-ink-700 border-gray-300 hover:border-brand-300 peer-checked:bg-brand-600 peer-checked:text-white peer-checked:border-brand-600">
                <x-icon :name="$icon" :size="15" /> {{ $label }}
              </span>
            </label>
          @endforeach
        </div>
      </div>
      <button class="btn-primary w-full py-2.5" data-busy-label="Creating account…">Sign up</button>
    </form>

    <x-slot:footer>
      Already have an account? <a href="/login" class="text-brand-600 font-semibold hover:underline">Log in</a>
    </x-slot:footer>
  </x-auth-card>
@endsection
