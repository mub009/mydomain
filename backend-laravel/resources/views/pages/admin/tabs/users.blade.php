@php
    use App\Http\Controllers\Web\AdminPageController as A;
    $items = $users['data'] ?? [];
    $meta = $users['meta'] ?? ['page' => 1, 'totalPages' => 1];
@endphp
<div>
  <form method="GET" class="flex flex-col sm:flex-row gap-3 mb-4" data-filter-form>
    <input type="hidden" name="tab" value="Users" />
    <div class="flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-3 flex-1">
      <x-icon name="search" :size="16" class="text-gray-400" />
      <input name="search" value="{{ request('search') }}" placeholder="Search by name, email or mobile…" class="w-full py-2.5 text-sm focus:outline-none" data-live-search />
    </div>
    <select name="role" class="input sm:w-44" data-autosubmit>
      <option value="">All roles</option>
      @foreach (A::ROLES as $r)
        <option value="{{ $r }}" @selected(request('role') === $r)>{{ A::label($r) }}</option>
      @endforeach
    </select>
    <button type="button" data-create-user class="btn-primary px-4 py-2.5 whitespace-nowrap"><x-icon name="user-plus" :size="16" /> Add user</button>
  </form>

  @if ($users === null)
    <p class="text-sm text-red-700 bg-red-50 rounded-md px-3 py-2 mb-4">Could not load users.</p>
  @endif

  <div class="card divide-y divide-gray-100">
    @forelse ($items as $u)
      <div class="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
        <div class="flex items-center gap-3 min-w-0">
          <span class="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-100 text-brand-700 text-sm font-bold">{{ mb_strtoupper(mb_substr($u['firstName'], 0, 1)) }}</span>
          <div class="min-w-0">
            <p class="font-semibold text-sm text-ink-900 truncate">{{ $u['firstName'] }} {{ $u['lastName'] }}</p>
            {{-- Dealers sign in with their mobile number, so it comes first for them. --}}
            <p class="text-xs text-ink-500 truncate">{{ $u['role'] === 'DEALER' ? ($u['phone'] ?? $u['email'] ?? '') : ($u['email'] ?? $u['phone'] ?? '') }}</p>
            @if ($u['role'] === 'DEALER')
              <p class="text-[11px] text-violet-600 truncate mt-0.5">
                {{ ! empty($u['privileges']) ? implode(' · ', array_map(fn ($p) => A::PRIVILEGE_LABELS[$p] ?? $p, $u['privileges'])) : 'No privileges granted' }}
              </p>
              <p class="text-[11px] mt-0.5 font-semibold {{ ($u['points'] ?? 0) > 0 ? 'text-amber-600' : 'text-red-600' }}">
                <x-icon name="coins" :size="10" class="inline -mt-0.5 mr-0.5" />{{ $u['points'] ?? 0 }} points{{ ($u['points'] ?? 0) === 0 ? ' — needs a top-up' : '' }}
              </p>
            @endif
          </div>
        </div>
        <div class="flex flex-wrap items-center gap-2 sm:shrink-0">
          <span class="badge {{ A::roleBadge($u['role']) }} hidden sm:inline-flex">{{ A::label($u['role']) }}</span>
          <span class="badge {{ A::statusBadge($u['status']) }} hidden md:inline-flex">{{ A::label($u['status']) }}</span>
          @if (($u['_count']['businesses'] ?? 0) > 0)
            <span class="text-xs text-ink-400 hidden lg:inline">{{ $u['_count']['businesses'] }} biz</span>
          @endif
          @if ($u['role'] === 'DEALER')
            <button type="button" data-points="{{ json_encode($u) }}" class="btn-secondary px-3 py-1.5 text-sm whitespace-nowrap"><x-icon name="coins" :size="14" /> Points</button>
          @endif
          <button type="button" data-reset-password="{{ json_encode($u) }}" class="btn-secondary px-3 py-1.5 text-sm whitespace-nowrap">Reset password</button>
          <button type="button" data-edit-user="{{ json_encode($u) }}" class="btn-secondary px-3 py-1.5 text-sm">Edit</button>
        </div>
      </div>
    @empty
      <div class="p-8 text-center text-sm text-ink-500">No users found.</div>
    @endforelse
  </div>
  <x-pager :page="$meta['page']" :total-pages="$meta['totalPages']" />
</div>
