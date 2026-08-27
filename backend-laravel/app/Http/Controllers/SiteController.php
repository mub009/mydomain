<?php

namespace App\Http\Controllers;

use App\Exceptions\ApiException;
use App\Models\Business;
use App\Models\BusinessSite;
use App\Models\Product;
use App\Support\ApiResponse;
use Illuminate\Http\Request;

// Owner-facing storefront settings (site type, delivery fee, publish state).
// The drag-and-drop brochure-website builder (projectData/html/css template
// editing) is not part of this Laravel port — see backend-laravel/README.md.
class SiteController extends Controller
{
    private function assertOwnerOrAdmin(array $actor, string $ownerId): void
    {
        if ($actor['role'] === 'ADMIN') {
            return;
        }
        if ($actor['sub'] !== $ownerId) {
            throw ApiException::forbidden('You do not own this business');
        }
    }

    private function ownedBusiness(array $actor, string $businessId): Business
    {
        $business = Business::find($businessId);
        if (! $business) {
            throw ApiException::notFound('Business not found');
        }
        $this->assertOwnerOrAdmin($actor, $business->ownerId);

        return $business;
    }

    public function show(Request $request, string $id)
    {
        $actor = $request->attributes->get('auth');
        $business = $this->ownedBusiness($actor, $id);
        $site = BusinessSite::where('businessId', $id)->first();

        return ApiResponse::ok([
            'businessId' => $id,
            'slug' => $business->slug,
            'isPublished' => $site->isPublished ?? false,
            'publishedAt' => $site->publishedAt ?? null,
            'updatedAt' => $site->updatedAt ?? null,
            'hasSavedDraft' => (bool) $site,
            'siteType' => $site->siteType ?? 'WEBSITE',
            'storefront' => [
                'deliveryFeeCents' => $site->deliveryFeeCents ?? 0,
                'freeDeliveryAboveCents' => $site->freeDeliveryAboveCents ?? null,
                'productCount' => Product::where('businessId', $id)->count(),
            ],
        ]);
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
        $this->ownedBusiness($actor, $id);

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
        ]);
    }
}
