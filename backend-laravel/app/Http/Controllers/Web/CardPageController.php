<?php

namespace App\Http\Controllers\Web;

use App\Http\Controllers\Controller;
use App\Models\Business;
use App\Models\BusinessCard;
use App\Models\CardTemplate;
use App\Support\BusinessAccess;
use App\Support\BusinessFeatures;
use App\Support\Cards\CardEngine;
use App\Support\Cards\CardPdf;
use App\Support\Cards\ImageCard;
use App\Support\Cards\ImageColour;
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

        // A slide of the Multi card view slider: /card/<slug>?design=<id>&embed=1.
        if (request()->boolean('embed')) {
            $html = ImageCard::renderSlide($business, (string) request()->query('design', 'main'), true);
            abort_unless($html !== null, 404);

            return response($html)->header('Content-Type', 'text/html; charset=UTF-8');
        }

        BusinessCard::whereKey($business->card->id)->increment('viewCount');

        // Multi card view: the business's card, then its other designs, as a slider.
        $slides = ImageCard::slides($business);
        if (count($slides) > 1) {
            $details = CardEngine::details($business);

            return self::page($business, view('cards.slider', [
                'b' => $details,
                'slides' => array_map(fn ($s) => [
                    'id' => $s['id'],
                    'name' => $s['name'],
                    'src' => $details['cardUrl'].'?'.http_build_query(['design' => $s['id'], 'embed' => 1]),
                    'pdf' => $details['pdfUrl'].($s['id'] === 'main' ? '' : '?'.http_build_query(['design' => $s['id']])),
                ], $slides),
                'image' => ImageCard::source($business)['imageUrl'] ?? ($slides[1]['template']->imageUrl ?? null),
            ])->render());
        }

        // The business's own artwork with its actions, when it has uploaded one; else its template.
        // Its image (its own, or its image template's) with the actions on it; else the template's layout.
        $html = ImageCard::render($business)
            ?? CardEngine::render(CardEngine::templateFor($business), CardEngine::details($business));

        return self::page($business, $html);
    }

    // The card page; for someone signed in who manages the business, with the
    // bar for changing the card's colour (cards/partials/owner-bar) — only
    // when the card wears an image, which is what the colour changes.
    private static function page(Business $business, string $html)
    {
        $user = WebAuth::user();
        if ($user && ImageCard::source($business)
            && BusinessAccess::canManage(['role' => $user->role, 'sub' => $user->id], $business)) {
            $bar = view('cards.partials.owner-bar', [
                'businessId' => $business->id,
                'colour' => ImageColour::normalize($business->card?->imageColour),
                'swatches' => ImageColour::SWATCHES,
                'manageUrl' => "/dashboard/businesses/{$business->id}?section=".urlencode('Visiting Card'),
            ])->render();
            $html = str_contains($html, '</body>') ? preg_replace('~</body>~i', $bar.'</body>', $html, 1) : $html.$bar;
        }

        $response = response($html)->header('Content-Type', 'text/html; charset=UTF-8');

        // The owner's copy carries their bar: never keep it in a shared cache.
        return $user ? $response->header('Cache-Control', 'private, no-store') : $response;
    }

    // The card as a PDF, every action a working link. ?design=<id>: one of
    // the other designs shown in Multi card view.
    public function pdf(string $slug)
    {
        $business = $this->liveBusiness($slug);
        $design = null;
        if (($id = request()->query('design')) && $id !== 'main') {
            $design = collect(ImageCard::slides($business))->firstWhere('id', (string) $id)['template'] ?? null;
            abort_unless($design, 404);
        }

        return self::pdfResponse($business, true, $design);
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

    private static function pdfResponse(Business $business, bool $live, ?CardTemplate $design = null)
    {
        $disposition = request()->boolean('inline') ? 'inline' : 'attachment';

        return response(CardPdf::render($business, $live, $design))
            ->header('Content-Type', 'application/pdf')
            ->header('Content-Disposition', $disposition.'; filename="'.CardPdf::filename($business, $design).'"')
            ->header('Cache-Control', 'private, max-age=0, no-store');
    }

    public function vcard(string $slug)
    {
        return self::vcardResponse($this->liveBusiness($slug));
    }
}
