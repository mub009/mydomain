{{-- The 7 website designs (App\Support\SiteBuilder\TemplateRegistry). Each
     opens its own full-screen CSS editor — restyling colours, fonts and
     spacing on top of what the template already draws from a business's own
     data; the content itself (services, gallery, hours...) stays untouched. --}}
<div class="card overflow-hidden">
  <div class="border-b border-gray-100 px-5 py-4">
    <h2 class="font-semibold text-ink-900">Website templates <span class="ml-1 text-sm font-normal text-ink-400">{{ count($siteTemplates) }}</span></h2>
    <p class="mt-0.5 text-xs text-ink-500">Restyle a template and every business using it picks it up next time their page is shown — no rebuild, and a business's own saved changes still come out on top of this.</p>
  </div>
  <div class="grid gap-4 p-5 sm:grid-cols-2 lg:grid-cols-3">
    @foreach ($siteTemplates as $t)
      <a href="/admin/site-templates/{{ $t['id'] }}" class="flex flex-col gap-2 rounded-xl border border-gray-200 p-4 transition hover:-translate-y-0.5 hover:shadow-md hover:ring-1 hover:ring-brand-200">
        <span class="h-8 w-8 rounded-lg" style="background:{{ $t['accent'] }}"></span>
        <span class="font-semibold text-ink-900">{{ $t['name'] }}</span>
        <span class="text-xs text-ink-500">{{ $t['description'] }}</span>
      </a>
    @endforeach
  </div>
</div>
