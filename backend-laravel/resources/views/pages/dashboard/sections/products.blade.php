@php
    use App\Support\Money;
    $items = $products['data'] ?? [];
    $meta = $products['meta'] ?? ['page' => 1, 'totalPages' => 1, 'total' => 0];
    $search = request('search');
@endphp
{{-- The shop's catalogue: what customers can put in their cart. --}}
<div class="space-y-3">
  <div class="card p-4">
    <div class="flex flex-wrap items-start justify-between gap-3">
      <div>
        <h3 class="flex items-center gap-1.5 font-bold text-ink-900"><x-icon name="package" :size="16" class="text-brand-600" /> Products</h3>
        <p class="mt-0.5 text-xs text-ink-500">What customers can buy on your shop page. Switch a product off to hide it without deleting it.</p>
      </div>
      <button type="button" data-product-create class="btn-primary px-3 py-2 text-sm"><x-icon name="plus" :size="15" /> Add product</button>
    </div>

    <form class="mt-3 flex gap-2" method="GET">
      <input type="hidden" name="section" value="Products" />
      <div class="relative flex-1">
        <x-icon name="search" :size="15" class="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input class="input pl-9" name="search" value="{{ $search }}" placeholder="Search your products…" />
      </div>
      <button class="btn-secondary px-4 py-2 text-sm">Search</button>
      @if ($search)
        <a href="?section=Products" class="btn-ghost px-3 py-2 text-sm">Clear</a>
      @endif
    </form>
    @if ($products === null)
      <p class="mt-3 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">Could not load your products.</p>
    @endif
  </div>

  @if (count($items) === 0)
    <div class="card p-8 text-center">
      <span class="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-gray-100 text-gray-400"><x-icon name="package" :size="22" /></span>
      <p class="mt-3 font-semibold text-ink-900">{{ $search ? 'No products matched that search' : 'No products yet' }}</p>
      <p class="mt-1 text-sm text-ink-500">{{ $search ? 'Try a different word, or clear the search.' : 'Add your first product and it will appear on your shop page straight away.' }}</p>
      @if (! $search)
        <button type="button" data-product-create class="btn-primary mt-4 px-4 py-2 text-sm"><x-icon name="plus" :size="15" /> Add your first product</button>
      @endif
    </div>
  @else
    <div class="card divide-y divide-gray-100">
      @foreach ($items as $product)
        <div class="flex flex-wrap items-center gap-3 p-3.5">
          @if ($product['imageUrl'])
            <img src="{{ $product['imageUrl'] }}" alt="" class="h-14 w-14 flex-none rounded-lg object-cover" loading="lazy" />
          @else
            <span class="flex h-14 w-14 flex-none items-center justify-center rounded-lg bg-gray-100 text-gray-400"><x-icon name="image-off" :size="18" /></span>
          @endif

          <div class="min-w-[10rem] flex-1">
            <p class="flex items-center gap-1.5 text-sm font-bold text-ink-900">
              {{ $product['name'] }}
              @if (! ($product['isActive'] ?? true))
                <span class="badge bg-gray-100 text-gray-600">Hidden</span>
              @endif
              @if ($product['trackStock'] && $product['stock'] <= 0)
                <span class="badge bg-red-50 text-red-700">Sold out</span>
              @endif
            </p>
            @if ($product['description'])
              <p class="mt-0.5 line-clamp-1 text-xs text-ink-500">{{ $product['description'] }}</p>
            @endif
            <p class="mt-1 text-xs text-ink-400">{{ $product['trackStock'] ? "{$product['stock']} in stock" : 'Stock not tracked' }}{{ $product['sku'] ? " · SKU {$product['sku']}" : '' }}</p>
          </div>

          <div class="text-right">
            <p class="text-sm font-bold text-ink-900">{{ Money::format($product['priceCents'], $product['currency']) }}</p>
            @if ($product['compareAtCents'] !== null && $product['compareAtCents'] > $product['priceCents'])
              <p class="text-xs text-ink-400 line-through">{{ Money::format($product['compareAtCents'], $product['currency']) }}</p>
            @endif
          </div>

          <div class="flex items-center gap-1.5">
            <button type="button" data-product-toggle="{{ $product['id'] }}" data-active="{{ ($product['isActive'] ?? true) ? '1' : '0' }}" class="btn-secondary px-2.5 py-1.5 text-xs" title="{{ ($product['isActive'] ?? true) ? 'Hide from your shop' : 'Show on your shop' }}">{{ ($product['isActive'] ?? true) ? 'Hide' : 'Show' }}</button>
            <button type="button" data-product-edit="{{ json_encode($product) }}" class="btn-secondary px-2.5 py-1.5 text-xs"><x-icon name="pencil" :size="13" /> Edit</button>
            <button type="button" data-product-delete="{{ $product['id'] }}" data-name="{{ $product['name'] }}" class="rounded-lg p-2 text-ink-400 hover:bg-red-50 hover:text-red-600" aria-label="Delete {{ $product['name'] }}"><x-icon name="trash-2" :size="15" /></button>
          </div>
        </div>
      @endforeach
    </div>

    <div class="flex flex-wrap items-center justify-between gap-3">
      <p class="text-xs text-ink-500">{{ $meta['total'] }} product{{ $meta['total'] === 1 ? '' : 's' }}</p>
      <x-pager :page="$meta['page']" :total-pages="$meta['totalPages']" />
    </div>
  @endif
</div>

{{-- Add / edit form, opened in a modal by manage.js. --}}
<template id="product-form-template">
  <form class="space-y-3" data-product-form>
    <label class="block">
      <span class="mb-1 block text-xs font-semibold text-ink-700">Product name *</span>
      <input required name="name" class="input" />
    </label>
    <label class="block">
      <span class="mb-1 block text-xs font-semibold text-ink-700">Description</span>
      <textarea rows="2" name="description" class="input"></textarea>
    </label>
    <div class="grid gap-3 sm:grid-cols-2">
      <label class="block">
        <span class="mb-1 block text-xs font-semibold text-ink-700">Price (₹) *</span>
        <input required type="number" min="0" step="0.01" name="price" class="input" />
      </label>
      <label class="block">
        <span class="mb-1 block text-xs font-semibold text-ink-700">Was (₹)</span>
        <input type="number" min="0" step="0.01" name="compareAt" class="input" placeholder="Optional" />
        <span class="mt-1 block text-[11px] text-ink-400">Shown struck through next to the price. Must be higher than the price.</span>
      </label>
    </div>
    <x-upload-field name="imageUrl" purpose="products" label="Image" />
    <img alt="" data-image-preview class="h-24 w-24 rounded-lg border border-gray-200 object-cover" hidden />
    <label class="block">
      <span class="mb-1 block text-xs font-semibold text-ink-700">SKU / item code</span>
      <input name="sku" class="input" />
    </label>
    <div class="rounded-lg bg-gray-50 p-3">
      <label class="flex items-center gap-2 text-sm font-semibold text-ink-800">
        <input type="checkbox" name="trackStock" data-track-stock /> Count stock for this product
      </label>
      <p class="mt-1 text-[11px] text-ink-500">Leave off if you always have it available. When on, customers cannot order more than you have left.</p>
      <label class="mt-2 block" data-stock-field hidden>
        <span class="mb-1 block text-xs font-semibold text-ink-700">Units in stock</span>
        <input type="number" min="0" name="stock" value="0" class="input" />
      </label>
    </div>
    <label class="flex items-center gap-2 text-sm font-semibold text-ink-800">
      <input type="checkbox" name="isActive" checked /> Show this product on my shop
    </label>
    <p class="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700" data-form-error hidden></p>
    <div class="flex justify-end gap-2 pt-1">
      <button type="button" data-close class="btn-secondary px-4 py-2 text-sm">Cancel</button>
      <button class="btn-primary px-4 py-2 text-sm disabled:opacity-50" data-submit>Add product</button>
    </div>
  </form>
</template>
