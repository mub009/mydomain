<?php

namespace App\Http\Controllers\Web;

use App\Http\Controllers\CardController;
use App\Http\Controllers\Controller;
use App\Http\Controllers\UploadController;
use App\Models\Business;
use App\Models\BusinessCard;
use App\Models\CardTemplate;
use App\Models\User;
use App\Support\BusinessAccess;
use App\Support\BusinessFeatures;
use App\Support\Cards\CardEngine;
use App\Support\Cards\CardImageUnavailable;
use App\Support\Cards\CardPdf;
use App\Support\Cards\ImageCard;
use App\Support\Cards\ImageColour;
use App\Support\WebAuth;
use Illuminate\Http\Request;

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
        $manager = self::manager($business, request()->query('owner'));
        if ($manager && ImageCard::source($business)) {
            // The ready-made image designs for its category, to switch the card's image right here.
            $card = $business->card;
            $current = CardEngine::templateFor($business, $card);
            $designs = CardEngine::templatesFor($business->categoryId)
                ->filter(fn (CardTemplate $t) => (bool) $t->imageUrl)
                ->map(fn (CardTemplate $t) => [
                    'id' => $t->id,
                    'name' => $t->name,
                    'imageUrl' => $t->imageUrl,
                    'inUse' => $t->id === $current?->id && ImageCard::wears($card, $t),
                ])->values()->all();
            $bar = view('cards.partials.owner-bar', [
                'slug' => $business->slug,
                // Saves go with this pass, so they work wherever the card is opened.
                'ownerToken' => CardEngine::ownerToken($business, $manager->id, 12),
                'designs' => $designs,
                'isAdmin' => $manager->role === 'ADMIN',
                'colour' => ImageColour::normalize($business->card?->imageColour),
                'swatches' => ImageColour::SWATCHES,
                'manageUrl' => "/dashboard/businesses/{$business->id}?section=".urlencode('Visiting Card'),
            ])->render();
            $html = str_contains($html, '</body>') ? preg_replace('~</body>~i', $bar.'</body>', $html, 1) : $html.$bar;
        }

        $response = response($html)->header('Content-Type', 'text/html; charset=UTF-8');

        // The owner's copy carries their bar: never keep it in a shared cache.
        return $manager || WebAuth::user() ? $response->header('Cache-Control', 'private, no-store') : $response;
    }

    /**
     * Who may change this card here: someone signed in who manages the
     * business, or the holder of a pass from the dashboard's "Open card"
     * (for when the browser isn't signed in on the card's address).
     */
    private static function manager(Business $business, mixed $token): ?User
    {
        $user = WebAuth::user();
        if (! $user && ($id = CardEngine::ownerFromToken(is_string($token) ? $token : null, $business))) {
            $user = User::find($id);
            $user = $user && $user->status !== 'SUSPENDED' ? $user : null;
        }

        return $user && BusinessAccess::canManage(['role' => $user->role, 'sub' => $user->id], $business) ? $user : null;
    }

    /**
     * The bar's saves: the card's colour, another ready-made design, or a
     * picture moved and zoomed — nothing else — through the card API, as the pass's user.
     */
    public function ownerUpdate(Request $request, string $slug)
    {
        $business = Business::with(['category', 'card'])->where('slug', $slug)->first();
        abort_unless($business, 404);
        $user = self::manager($business, $request->input('owner'));
        abort_unless($user, 403);

        $payload = array_intersect_key($request->all(), array_flip(['imageColour', 'templateId', 'spotFit', 'spotShape', 'spotPlace']));
        abort_unless($payload, 422);
        $sub = Request::create('/', 'PUT', [], [], [], ['CONTENT_TYPE' => 'application/json', 'HTTP_ACCEPT' => 'application/json'], json_encode($payload));
        $sub->attributes->set('auth', ['sub' => $user->id, 'role' => $user->role]);

        return app()->call([app(CardController::class), 'update'], ['request' => $sub, 'id' => $business->id]);
    }

    /**
     * The bar's "Change picture": a new picture uploaded into one of the
     * card's free-image boxes, with the page's pass — the same upload and
     * save the dashboard uses, as the pass's user, and nothing else.
     */
    public function ownerPicture(Request $request, string $slug)
    {
        $business = Business::with(['category', 'card'])->where('slug', $slug)->first();
        abort_unless($business, 404);
        $user = self::manager($business, $request->input('owner'));
        abort_unless($user, 403);
        $spotId = (string) $request->input('spotId');
        abort_unless($spotId !== '' && strlen($spotId) <= 40 && $request->hasFile('file'), 422);
        $auth = ['sub' => $user->id, 'role' => $user->role];

        // The picture's own size, to fit it to the box below.
        $size = @getimagesize($request->file('file')->getRealPath()) ?: [0, 0];
        $upload = Request::create('/', 'POST', ['purpose' => 'card-images'], [], ['file' => $request->file('file')], ['HTTP_ACCEPT' => 'application/json']);
        $upload->attributes->set('auth', $auth);
        $url = app()->call([app(UploadController::class), 'image'], ['request' => $upload])->getData(true)['data']['url'];

        // The picture's size goes with it, so it starts filling its whole box ("full size").
        $picture = ['id' => $spotId, 'url' => $url] + ($size[0] && $size[1] ? ['width' => (int) $size[0], 'height' => (int) $size[1]] : []);
        $save = Request::create('/', 'PUT', [], [], [], ['CONTENT_TYPE' => 'application/json', 'HTTP_ACCEPT' => 'application/json'], json_encode(['spotImage' => $picture]));
        $save->attributes->set('auth', $auth);

        return app()->call([app(CardController::class), 'update'], ['request' => $save, 'id' => $business->id]);
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
        try {
            $pdf = CardPdf::render($business, $live, $design);
        } catch (CardImageUnavailable $e) {
            // Better no file than a PDF of some other design.
            $back = e(url()->previous() ?: '/');

            return response('<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Card PDF</title></head>'
                .'<body style="font-family:system-ui,sans-serif;max-width:520px;margin:15vh auto;padding:0 16px;color:#111827">'
                .'<h1 style="font-size:20px">Couldn&rsquo;t make the PDF</h1><p>'.e($e->getMessage()).'</p>'
                .'<p><a href="'.$back.'" style="color:#047857;font-weight:600">&larr; Back</a></p></body></html>', 503)
                ->header('Content-Type', 'text/html; charset=UTF-8')
                ->header('Retry-After', '60');
        }

        return response($pdf)
            ->header('Content-Type', 'application/pdf')
            ->header('Content-Disposition', $disposition.'; filename="'.CardPdf::filename($business, $design).'"')
            ->header('Cache-Control', 'private, max-age=0, no-store');
    }

    public function vcard(string $slug)
    {
        return self::vcardResponse($this->liveBusiness($slug));
    }
}
