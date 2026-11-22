<?php

namespace App\Http\Controllers;

use App\Exceptions\ApiException;
use App\Models\Business;
use App\Models\SiteTemplateStyle;
use App\Support\ApiResponse;
use App\Support\SiteBuilder\Helpers;
use App\Support\SiteBuilder\TemplateRegistry;
use Illuminate\Http\Request;

// An admin's CSS overrides for a website template (App\Support\SiteBuilder\TemplateRegistry) —
// restyles every business using that template, without touching the
// per-business content each template still generates from its own data.
class SiteTemplateStyleController extends Controller
{
    private function assertKnown(string $templateId): void
    {
        if (! TemplateRegistry::isKnown($templateId)) {
            throw ApiException::badRequest("Unknown website template \"{$templateId}\"");
        }
    }

    public function show(string $templateId)
    {
        $this->assertKnown($templateId);
        $style = SiteTemplateStyle::with('updatedBy')->find($templateId);

        return ApiResponse::ok([
            'templateId' => $templateId,
            'customCss' => $style?->customCss ?? '',
            'updatedAt' => $style?->updatedAt,
            'updatedByName' => $style?->updatedBy?->firstName,
        ]);
    }

    public function update(Request $request, string $templateId)
    {
        $this->assertKnown($templateId);
        $actor = $request->attributes->get('auth');
        $data = $request->validate(['customCss' => ['nullable', 'string', 'max:50000']]);

        $style = SiteTemplateStyle::updateOrCreate(['templateId' => $templateId], [
            'customCss' => $data['customCss'] ?: null,
            'updatedByUserId' => $actor->sub ?? null,
            'updatedAt' => now(),
        ]);

        return ApiResponse::ok(['templateId' => $templateId, 'customCss' => $style->customCss ?? '', 'updatedAt' => $style->updatedAt]);
    }

    // A live look at a draft (unsaved) CSS, rendered against a real
    // business's data — same shape as the per-business template preview,
    // so the admin sees the template exactly as a visitor would.
    public function preview(Request $request, string $templateId)
    {
        $this->assertKnown($templateId);
        $data = $request->validate(['customCss' => ['nullable', 'string', 'max:50000']]);

        $business = Business::with([
            'category',
            'photos' => fn ($q) => $q->orderBy('sortOrder'),
            'hours' => fn ($q) => $q->orderBy('dayOfWeek'),
            'services' => fn ($q) => $q->where('isActive', true)->orderBy('createdAt'),
            'site',
        ])->whereHas('site')->orderByDesc('updatedAt')->first()
            ?? Business::with(['category', 'photos', 'hours', 'services'])->orderByDesc('updatedAt')->first();

        if (! $business) {
            throw ApiException::notFound('No business exists yet to preview a template with.');
        }

        // Built directly (not via TemplateRegistry::buildTemplate) so the
        // draft the admin is typing replaces whatever is already saved,
        // rather than stacking on top of it.
        $class = TemplateRegistry::resolve($templateId);
        $built = $class::build(Helpers::buildContext($business, true));
        $css = trim($data['customCss'] ?? '') !== '' ? $built['css']."\n".$data['customCss'] : $built['css'];

        return ApiResponse::ok(['templateId' => $class::ID, 'html' => $built['html'], 'css' => $css]);
    }
}
