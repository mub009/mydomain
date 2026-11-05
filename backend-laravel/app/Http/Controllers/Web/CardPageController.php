<?php

namespace App\Http\Controllers\Web;

use App\Http\Controllers\Controller;
use App\Models\Business;
use App\Models\BusinessCard;
use App\Support\BusinessAccess;
use App\Support\BusinessFeatures;
use App\Support\Cards\CardEngine;
use App\Support\Cards\CardPdf;
use App\Support\Cards\ImageCard;
use App\Support\WebAuth;

// The public digital visiting card at /card/<slug> (the URL its QR code
// holds), and its "Save contact" vCard. A card is up while it is published
// and the listing itself is live, as with the business's website.
class CardPageController extends Controller
{
    private function liveBusiness(string $slug): Business
    {
        $business = Business::with(['category', 'hours' => fn ($q) => $q->orderBy('dayOfWeek'), 'card'])->where('slug', $slug)->first();
        abort_unless($business && $business->status === 'PUBLISHED' && $business->card?->isPublished
            && BusinessFeatures::has($business, BusinessFeatures::VISITING_CARD), 404);

        return $business;
    }

    public function show(string $slug)
    {
        $business = $this->liveBusiness($slug);
        BusinessCard::whereKey($business->card->id)->increment('viewCount');

        // The business's own artwork with its actions, when it has uploaded one; else its template.
        // Its image (its own, or its image template's) with the actions on it; else the template's layout.
        $html = ImageCard::render($business)
            ?? CardEngine::render(CardEngine::templateFor($business), CardEngine::details($business));

        return response($html)->header('Content-Type', 'text/html; charset=UTF-8');
    }

    // The card as a PDF, every action a working link.
    public function pdf(string $slug)
    {
        return self::pdfResponse($this->liveBusiness($slug), true);
    }

    // The same PDF for the people who manage the business, before the card
    // is live too (then without its QR code and links to the online card).
    public function ownerPdf(string $id)
    {
        $business = Business::with(['category', 'hours' => fn ($q) => $q->orderBy('dayOfWeek'), 'card'])->find($id);
        abort_unless($business, 404);
        $user = WebAuth::user();
        abort_unless(BusinessAccess::canManage(['role' => $user->role, 'sub' => $user->id], $business), 403);
        abort_unless(BusinessFeatures::has($business, BusinessFeatures::VISITING_CARD), 404);

        return self::pdfResponse($business, $business->status === 'PUBLISHED' && (bool) $business->card?->isPublished);
    }

    // The card's contact file for the people who manage the business — works
    // before the card is published (the editors' "Save contact" in previews).
    public function ownerVcard(string $id)
    {
        $business = Business::with(['category', 'hours' => fn ($q) => $q->orderBy('dayOfWeek')])->find($id);
        abort_unless($business, 404);
        $user = WebAuth::user();
        abort_unless(BusinessAccess::canManage(['role' => $user->role, 'sub' => $user->id], $business), 403);
        abort_unless(BusinessFeatures::has($business, BusinessFeatures::VISITING_CARD), 404);

        return self::vcardResponse($business);
    }

    private static function vcardResponse(Business $business)
    {
        return response(CardEngine::vcard(CardEngine::details($business)))
            ->header('Content-Type', 'text/vcard; charset=UTF-8')
            ->header('Content-Disposition', 'attachment; filename="'.$business->slug.'.vcf"');
    }

    private static function pdfResponse(Business $business, bool $live)
    {
        $disposition = request()->boolean('inline') ? 'inline' : 'attachment';

        return response(CardPdf::render($business, $live))
            ->header('Content-Type', 'application/pdf')
            ->header('Content-Disposition', $disposition.'; filename="'.CardPdf::filename($business).'"')
            ->header('Cache-Control', 'private, max-age=0, no-store');
    }

    public function vcard(string $slug)
    {
        return self::vcardResponse($this->liveBusiness($slug));
    }
}
