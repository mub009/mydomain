@php
    use App\Http\Controllers\Web\AdminPageController as A;
    $items = $businesses['data'] ?? [];
    $meta = $businesses['meta'] ?? ['page' => 1, 'totalPages' => 1];
@endphp
<div>
  <form method="GET" class="flex flex-col sm:flex-row gap-3 mb-4" data-filter-form>
    <input type="hidden" name="tab" value="Businesses" />
    <div class="flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-3 flex-1">
      <x-icon name="search" :size="16" class="text-gray-400" />
      <input name="search" value="{{ request('search') }}" placeholder="Search by name or city…" class="w-full py-2.5 text-sm focus:outline-none" data-live-search />
    </div>
    <select name="status" class="input sm:w-52" data-autosubmit>
      <option value="">All statuses</option>
      @foreach (A::BIZ_STATUSES as $s)
        <option value="{{ $s }}" @selected(request('status') === $s)>{{ A::label($s) }}</option>
      @endforeach
    </select>
    <select name="businessType" class="input sm:w-40" data-autosubmit>
      <option value="">B2C &amp; B2B</option>
      <option value="B2C" @selected(request('businessType') === 'B2C')>B2C only</option>
      <option value="B2B" @selected(request('businessType') === 'B2B')>B2B only</option>
    </select>
  </form>

  @if ($businesses === null)
    <p class="text-sm text-red-700 bg-red-50 rounded-md px-3 py-2 mb-4">Could not load businesses.</p>
  @endif

  <div class="space-y-2">
    @forelse ($items as $b)
      <div class="card p-4">
        <div class="flex items-start justify-between gap-3 flex-wrap">
          <div class="min-w-0">
            <div class="flex items-center gap-2 flex-wrap">
              <p class="font-semibold text-ink-900">{{ $b['name'] }}</p>
              <span class="badge {{ A::statusBadge($b['status']) }}">{{ A::label($b['status']) }}</span>
              @if (($b['businessType'] ?? null) === 'B2B')
                <span class="badge bg-violet-50 text-violet-700">B2B</span>
              @endif
              @if (! empty($b['isVerified']))
                <span class="badge bg-emerald-50 text-emerald-700"><x-icon name="shield-check" :size="11" /> Verified</span>
              @endif
            </div>
            <p class="text-xs text-ink-500 mt-1">{{ $b['city'] }}, {{ $b['state'] }} · {{ $b['category']['name'] ?? '' }}</p>
            @if (! empty($b['owner']))
              <p class="text-xs text-ink-500 mt-0.5">
                Owner: {{ $b['owner']['firstName'] }} {{ $b['owner']['lastName'] }} ({{ $b['owner']['email'] ?? $b['owner']['phone'] ?? '' }})
                <span class="badge {{ A::roleBadge($b['owner']['role']) }} !px-1.5 !py-0">{{ A::label($b['owner']['role']) }}</span>
              </p>
            @endif
          </div>
          <div class="flex flex-wrap items-center gap-2">
            @if ($b['status'] === 'PENDING_APPROVAL')
              <button type="button" data-business-action="approve" data-id="{{ $b['id'] }}" class="btn-primary px-3 py-1.5 text-sm"><x-icon name="check" :size="14" /> Approve</button>
            @endif
            @if ($b['status'] === 'PUBLISHED')
              <button type="button" data-business-action="suspend" data-id="{{ $b['id'] }}" class="btn-secondary px-3 py-1.5 text-sm">Suspend</button>
            @endif
            <button type="button" data-reassign="{{ json_encode(['id' => $b['id'], 'name' => $b['name'], 'owner' => $b['owner'] ?? null]) }}" class="btn-secondary px-3 py-1.5 text-sm">Reassign</button>
            <button type="button" data-edit-business="{{ json_encode($b) }}" class="btn-secondary px-3 py-1.5 text-sm">Edit</button>
          </div>
        </div>
      </div>
    @empty
      <div class="card p-8 text-center text-sm text-ink-500">No businesses found.</div>
    @endforelse
  </div>
  <x-pager :page="$meta['page']" :total-pages="$meta['totalPages']" />

  <script type="application/json" id="admin-categories">@json(array_map(fn ($c) => ['id' => $c['id'], 'name' => $c['name']], $categories))</script>
</div>
