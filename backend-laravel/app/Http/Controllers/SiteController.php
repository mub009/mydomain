<?php

namespace App\Http\Controllers;

use App\Exceptions\ApiException;
use App\Models\Business;
use App\Models\BusinessSite;
use App\Models\Product;
use App\Support\ApiResponse;
use App\Support\BusinessAccess;
use App\Support\SiteBuilder\Sanitizer;
use App\Support\SiteBuilder\TemplateRegistry;
use App\Support\SiteThemes;
use Illuminate\Http\Request;

// Owner-facing storefront settings and the drag-and-drop brochure-website
// builder (starter/preview rendering, save, publish).
class SiteController extends Controller
{
    // Everything the builder needs to seed a first draft from what the
    // owner already entered in their listing.
    private function loadBusinessForTemplate(string $businessId): Business
    {
        $business = Business::with([
            'category',
            'photos' => fn ($q) => $q->orderBy('sortOrder'),
            'hours' => fn ($q) => $q->orderBy('dayOfWeek'),
            'services' => fn ($q) => $q->where('isActive', true)->orderBy('createdAt'),
        ])->find($businessId);
        if (! $business) {
            throw ApiException::notFound('Business not found');
        }

        return $business;
    }

    private function ownedBusiness(array $actor, string $businessId): Business
    {
        $business = Business::find($businessId);
        if (! $business) {
            throw ApiException::notFound('Business not found');
        }
        BusinessAccess::assertCanManage($actor, $business);

        return $business;
    }

    // Open the editor for a business. On first visit there is no saved
    // document, so we hand back a starter page built from the listing's own
    // data — name, contact details, opening hours, services and photos —
    // which the owner then edits. Nothing is persisted until they save.
    //
    // `templateId` (query param) lets the editor preview a different design
    // without committing to it; when omitted the business's own saved
    // choice is used.
    public function show(Request $request, string $id)
    {
        $actor = $request->attributes->get('auth');
        $business = $this->loadBusinessForTemplate($id);
        BusinessAccess::assertCanManage($actor, $business);

        $data = $request->validate(['templateId' => ['sometimes', 'nullable', 'string', 'max:40']]);

        $site = BusinessSite::where('businessId', $id)->first();
        $selectedId = $data['templateId'] ?? $site->templateId ?? TemplateRegistry::DEFAULT_TEMPLATE_ID;
        $starter = TemplateRegistry::buildTemplate($business, $selectedId);

        return ApiResponse::ok([
            'businessId' => $id,
            'slug' => $business->slug,
            // Null until the owner saves for the first time.
            'projectData' => $site->projectData ?? null,
            'isPublished' => $site->isPublished ?? false,
            'publishedAt' => $site->publishedAt ?? null,
            'updatedAt' => $site->updatedAt ?? null,
            'hasSavedDraft' => (bool) $site,
            // Brochure website or storefront. A storefront is rendered by
            // the app, so the builder document is only used by WEBSITE.
            'siteType' => $site->siteType ?? 'WEBSITE',
            'storefront' => [
                'deliveryFeeCents' => $site->deliveryFeeCents ?? 0,
                'freeDeliveryAboveCents' => $site->freeDeliveryAboveCents ?? null,
                'productCount' => Product::where('businessId', $id)->count(),
            ],
            // What the site is saved as, vs. what this response was rendered with.
            'templateId' => $site->templateId ?? TemplateRegistry::DEFAULT_TEMPLATE_ID,
            'renderedTemplateId' => $starter['templateId'],
            'templates' => TemplateRegistry::choices(),
            'starterHtml' => $starter['html'],
            'starterCss' => $starter['css'],
            // Handy for "reset to my account data" in the editor.
            'businessData' => $starter['data'],
        ]);
    }

    // Renders one of the designs for a business without saving it, so the
    // picker can preview a template before the owner commits to it.
    public function previewTemplate(Request $request, string $id, string $templateId)
    {
        $actor = $request->attributes->get('auth');
        $business = $this->loadBusinessForTemplate($id);
        BusinessAccess::assertCanManage($actor, $business);

        if (! TemplateRegistry::isKnown($templateId)) {
            throw ApiException::badRequest("Unknown website template \"{$templateId}\"");
        }

        $built = TemplateRegistry::buildTemplate($business, $templateId);

        return ApiResponse::ok(['templateId' => $built['templateId'], 'html' => $built['html'], 'css' => $built['css']]);
    }

    public function save(Request $request, string $id)
    {
        $actor = $request->attributes->get('auth');
        $this->ownedBusiness($actor, $id);

        $data = $request->validate([
            'projectData' => ['sometimes'],
            'html' => ['sometimes', 'nullable', 'string', 'max:500000'],
            'css' => ['sometimes', 'nullable', 'string', 'max:200000'],
            'templateId' => ['sometimes', 'nullable', 'string', 'max:40'],
        ]);

        if (! empty($data['templateId']) && ! TemplateRegistry::isKnown($data['templateId'])) {
            throw ApiException::badRequest("Unknown website template \"{$data['templateId']}\"");
        }

        // The rendered output is served on our own origin, so strip
        // anything executable before it is stored. The editor document is
        // kept as authored — it is only ever loaded back into the builder,
        // never rendered as a page.
        $payload = [
            'projectData' => $data['projectData'] ?? null,
            'html' => ! empty($data['html']) ? Sanitizer::sanitizeSiteHtml($data['html']) : null,
            'css' => ! empty($data['css']) ? Sanitizer::sanitizeSiteCss($data['css']) : null,
        ];
        // Only overwritten when the editor actually applied a template, so
        // an ordinary content save keeps the design the owner already picked.
        if (! empty($data['templateId'])) {
            $payload['templateId'] = $data['templateId'];
        }

        $site = BusinessSite::where('businessId', $id)->first();
        if ($site) {
            $site->update($payload);
        } else {
            $site = BusinessSite::create([...$payload, 'businessId' => $id, 'templateId' => $data['templateId'] ?? TemplateRegistry::DEFAULT_TEMPLATE_ID]);
        }

        return ApiResponse::ok(['savedAt' => $site->updatedAt, 'isPublished' => $site->isPublished, 'templateId' => $site->templateId]);
    }

    // Switching between a brochure website and a storefront, plus the
    // storefront's delivery settings.
    public function updateType(Request $request, string $id)
    {
        $actor = $request->attributes->get('auth');
        $this->ownedBusiness($actor, $id);

        $data = $request->validate([
            'siteType' => ['sometimes', 'in:WEBSITE,ECOMMERCE'],
            'deliveryFeeCents' => ['sometimes', 'integer', 'min:0', 'max:10000000'],
            'freeDeliveryAboveCents' => ['sometimes', 'nullable', 'integer', 'min:0', 'max:100000000'],
        ]);

        $site = BusinessSite::updateOrCreate(['businessId' => $id], $data);
        if ($site->wasRecentlyCreated) {
            $site->refresh();
        }

        return ApiResponse::ok([
            'siteType' => $site->siteType,
            'isPublished' => $site->isPublished,
            'deliveryFeeCents' => $site->deliveryFeeCents,
            'freeDeliveryAboveCents' => $site->freeDeliveryAboveCents,
        ]);
    }

    public function publish(Request $request, string $id)
    {
        $actor = $request->attributes->get('auth');
        $business = $this->ownedBusiness($actor, $id);

        $data = $request->validate(['isPublished' => ['required', 'boolean']]);

        $site = BusinessSite::where('businessId', $id)->first();
        if (! $site) {
            throw ApiException::badRequest('Save your website before publishing it');
        }

        if ($data['isPublished']) {
            // A storefront is rendered by the app from the catalogue, so it
            // has no builder document to check — what it needs is something
            // to sell.
            if ($site->siteType === 'ECOMMERCE') {
                if (Product::where('businessId', $id)->where('isActive', true)->count() === 0) {
                    throw ApiException::badRequest('Add at least one product before opening your shop');
                }
            } elseif (! $site->html) {
                throw ApiException::badRequest('There is nothing to publish yet — add some content and save first');
            }
        }

        $site->update(['isPublished' => $data['isPublished'], 'publishedAt' => $data['isPublished'] ? now() : null]);

        return ApiResponse::ok([
            'isPublished' => $site->isPublished,
            'publishedAt' => $site->publishedAt,
            'url' => "/site/{$business->slug}",
        ]);
    }

    // Public: what a visitor sees at a business's own page — either the
    // e-commerce storefront (products rendered by the app, themed from the
    // chosen template) or a published brochure website's saved html/css.
    public function published(string $slug)
    {
        $business = Business::where('slug', $slug)->with([
            'photos' => fn ($q) => $q->orderBy('sortOrder')->select(['businessId', 'url', 'caption']),
            'hours' => fn ($q) => $q->orderBy('dayOfWeek')->select(['businessId', 'dayOfWeek', 'openTime', 'closeTime', 'isClosed']),
        ])->first([
            'id', 'name', 'slug', 'city', 'description', 'phone', 'email', 'logoUrl',
            'addressLine1', 'addressLine2', 'state', 'postalCode', 'latitude', 'longitude',
            'instagramUsername', 'avgRating', 'reviewCount',
        ]);
        if (! $business) {
            throw ApiException::notFound('Business not found');
        }

        $site = BusinessSite::where('businessId', $business->id)->first();
        if (! $site || ! $site->isPublished) {
            throw ApiException::notFound('This business has not published a website yet');
        }

        $businessPayload = [
            ...$business->only([
                'id', 'name', 'slug', 'city', 'description', 'phone', 'email', 'logoUrl',
                'addressLine1', 'addressLine2', 'state', 'postalCode', 'latitude', 'longitude',
                'instagramUsername', 'avgRating', 'reviewCount',
            ]),
            'photos' => $business->photos->map->only(['url', 'caption']),
            'hours' => $business->hours->map->only(['dayOfWeek', 'openTime', 'closeTime', 'isClosed']),
        ];

        if ($site->siteType === 'ECOMMERCE') {
            return ApiResponse::ok([
                'siteType' => 'ECOMMERCE',
                'business' => $businessPayload,
                'theme' => SiteThemes::resolve($site->templateId),
                'templateId' => $site->templateId,
                'storefront' => [
                    'deliveryFeeCents' => $site->deliveryFeeCents,
                    'freeDeliveryAboveCents' => $site->freeDeliveryAboveCents,
                ],
                'html' => '',
                'css' => '',
                'publishedAt' => $site->publishedAt,
            ]);
        }

        if (! $site->html) {
            throw ApiException::notFound('This business has not published a website yet');
        }

        return ApiResponse::ok([
            'siteType' => 'WEBSITE',
            'business' => $businessPayload,
            'theme' => SiteThemes::resolve($site->templateId),
            'templateId' => $site->templateId,
            'storefront' => null,
            'html' => $site->html,
            'css' => $site->css ?? '',
            'publishedAt' => $site->publishedAt,
        ]);
    }
}
