<?php

namespace App\Http\Controllers;

use App\Exceptions\ApiException;
use App\Models\Business;
use App\Models\BusinessCard;
use App\Models\Category;
use App\Models\CardTemplate;
use App\Support\ApiResponse;
use App\Support\BusinessAccess;
use App\Support\BusinessFeatures;
use App\Support\Cards\BackgroundGenerator;
use App\Support\Cards\CardEngine;
use App\Support\Cards\ImageCard;
use App\Support\Cards\ImageColour;
use Illuminate\Http\Request;

// A business's digital visiting card, for the people who manage it: the
// designs on offer for its category, which one it wears, and whether it's
// live. Picking a design only records the template id — the details on the
// card are always the business's own (App\Support\Cards\CardEngine).
class CardController extends Controller
{
    private function managed(Request $request, string $id): Business
    {
        $business = Business::with(['category', 'hours' => fn ($q) => $q->orderBy('dayOfWeek'), 'card'])->find($id)
            ?? throw ApiException::notFound('Business not found');
        BusinessAccess::assertCanManage($request->attributes->get('auth'), $business);
        // The visiting card is a feature the dealer gives the business.
        BusinessFeatures::assert($business, BusinessFeatures::VISITING_CARD);

        return $business;
    }

    // Uploading the card image and placing its actions is for dealers and
    // admins; a business owner picks a ready-made design and publishes it.
    /**
     * Where the colour goes (its marked areas, ImageColour::areas) is set by
     * admins only. Anyone else changing the colour keeps the areas it has.
     */
    private static function withOwnAreas(array $actor, mixed $colour, mixed $stored): mixed
    {
        if ($actor['role'] === 'ADMIN') {
            return $colour;
        }
        // "Original" (no colour) keeps the marked areas too, for the next colour picked.
        $areas = is_array($stored) ? ($stored['areas'] ?? []) : [];

        return is_array($colour) ? [...$colour, 'areas' => $areas] : ($areas ? ['areas' => $areas] : null);
    }

    private static function canEditDesign(array $actor): bool
    {
        return $actor['role'] !== 'BUSINESS_OWNER';
    }

    private static function isLive(Business $business, ?BusinessCard $card): bool
    {
        return (bool) $card?->isPublished && $business->status === 'PUBLISHED';
    }

    /**
     * The designs for a category before the business exists — the "Add a
     * business" form's picker — each previewed with stand-in details (and
     * the name and logo given so far).
     */
    public function templates(Request $request)
    {
        $data = $request->validate([
            'categoryId' => ['nullable', 'uuid'],
            'name' => ['nullable', 'string', 'max:150'],
            'logoUrl' => ['nullable', 'url', 'max:500'],
        ]);
        $categoryName = ! empty($data['categoryId']) ? Category::whereKey($data['categoryId'])->value('name') : null;
        $sample = CardEngine::sampleDetails($data['name'] ?? null, $categoryName, $data['logoUrl'] ?? null);

        return ApiResponse::ok(CardEngine::templatesFor($data['categoryId'] ?? null)->map(fn (CardTemplate $t) => [
            ...CardEngine::summary($t),
            'previewHtml' => CardEngine::render($t, $sample, true),
        ])->values());
    }

    public function show(Request $request, string $id)
    {
        $actor = $request->attributes->get('auth');
        $business = $this->managed($request, $id);
        $card = $business->card;
        $current = CardEngine::templateFor($business, $card);
        $details = CardEngine::details($business);
        $image = ImageCard::source($business, $card);

        $templates = CardEngine::templatesFor($business->categoryId);
        // A design picked earlier that this category no longer offers stays listed, so it can still be seen.
        if ($current && ! $templates->contains('id', $current->id)) {
            $templates->prepend($current);
        }

        return ApiResponse::ok([
            'businessId' => $business->id,
            'templateId' => $current?->id,
            'backgroundImageUrl' => $card?->backgroundImageUrl,
            // The image card: the business's own artwork with actions placed on
            // it, or else the image template it wears (imageFromTemplate).
            'imageUrl' => $image['imageUrl'] ?? null,
            'imageWidth' => $image['imageWidth'] ?? null,
            'imageHeight' => $image['imageHeight'] ?? null,
            'hotspots' => $image['hotspots'] ?? [],
            'imageFromTemplate' => (bool) ($image['fromTemplate'] ?? false),
            // Its own copy, of a design that has an image of its own to go back to.
            'canResetImage' => (bool) $card?->imageUrl && (bool) $current?->imageUrl,
            'actions' => ImageCard::actionList(),
            'fonts' => CardEngine::FONTS,
            'listingDefaults' => ImageCard::listingDefaults($details),
            // Business owners wear the design they're given; dealers and admins edit it.
            'canEdit' => self::canEditDesign($actor),
            // Admins draw a free image's area (full-screen editor); dealers just place a picture and resize it.
            'imageAreaTools' => $actor['role'] === 'ADMIN',
            // Marking where the colour goes ("Colour here" / "Eraser") is for admins.
            'colourAreaTools' => $actor['role'] === 'ADMIN',
            // The image's recolouring — the whole business team, owners too, can change it.
            'imageColour' => ImageColour::normalize($card?->imageColour),
            'imageColourDefaults' => ImageColour::DEFAULTS,
            // The areas marked on its design (template editor), used when the card has none of its own.
            'designColourAreas' => count(ImageColour::areas($current?->colourAreas ?? null)),
            'missingDetails' => ImageCard::missingDetails($image['hotspots'] ?? [], ImageCard::listingDefaults($details)),
            // Every listing detail the card shows, with its current value, to update from the card section.
            'cardDetails' => ImageCard::cardDetails($image['hotspots'] ?? [], ImageCard::listingDefaults($details), $business),
            // The preview looks like the public card, in its saved colour: no outlines over the tap areas.
            'imagePreviewHtml' => $image ? ImageCard::renderSource($image, $details, true, false) : null,
            // Ready-made image designs from the admin, for "Start from a design".
            'imageTemplates' => $templates->filter(fn (CardTemplate $t) => (bool) $t->imageUrl)->map(fn (CardTemplate $t) => [
                'id' => $t->id,
                'name' => $t->name,
                'imageUrl' => $t->imageUrl,
                'actionCount' => count($t->hotspots ?? []),
                'inUse' => $t->id === $current?->id && ImageCard::wears($card, $t),
            ])->values(),
            'aiProvider' => BackgroundGenerator::provider(),
            'aiStyles' => BackgroundGenerator::STYLES,
            'aiDefaultStyle' => BackgroundGenerator::defaultStyle($current?->layout ?? 'classic'),
            // Multi card view: the link shows these other designs after the card, as a slider.
            'multiView' => (bool) $card?->multiView,
            'extraDesigns' => ImageCard::extraDesignOptions($business, $card)->map(fn (CardTemplate $t) => [
                'id' => $t->id,
                'name' => $t->name,
                'imageUrl' => $t->imageUrl,
                // None picked = every design is shown.
                'selected' => ! $card?->extraTemplateIds || in_array($t->id, $card->extraTemplateIds, true),
            ])->values(),
            'isPublished' => (bool) $card?->isPublished,
            'live' => self::isLive($business, $card),
            'listingLive' => $business->status === 'PUBLISHED',
            'publishedAt' => $card?->publishedAt,
            'viewCount' => $card?->viewCount ?? 0,
            'publicUrl' => CardEngine::cardUrl($business->slug),
            // "Open card" for the team: the card with its colour and design bar (CardEngine::ownerUrl).
            'ownerUrl' => CardEngine::ownerUrl($business, $actor['sub']),
            'plan' => $business->subscriptionPlan ?? 'FREE',
            'details' => $details,
            'templates' => $templates->map(fn (CardTemplate $t) => [
                ...CardEngine::summary($t),
                'locked' => ! CardEngine::canUse($t, $business, $actor),
                'previewHtml' => CardEngine::render($t, $details, true),
            ])->values(),
        ]);
    }

    // Switch the card's design, set (or clear, with null) the card's own
    // background, and/or set the image card: its artwork (imageUrl, with
    // its pixel size) and the actions placed on it (hotspots — see
    // ImageCard). None of it touches the business's details.
    public function update(Request $request, string $id)
    {
        $actor = $request->attributes->get('auth');
        $business = $this->managed($request, $id);
        $data = $request->validate([
            'templateId' => ['sometimes', 'uuid'],
            'backgroundImageUrl' => ['sometimes', 'nullable', 'url', 'max:500'],
            'imageUrl' => ['sometimes', 'nullable', 'url', 'max:500'],
            'imageWidth' => ['sometimes', 'nullable', 'integer', 'min:1', 'max:20000'],
            'imageHeight' => ['sometimes', 'nullable', 'integer', 'min:1', 'max:20000'],
            ...ImageCard::rules(),
            ...ImageColour::rules(),
            'multiView' => ['sometimes', 'boolean'],
            'extraTemplateIds' => ['sometimes', 'nullable', 'array', 'max:50'],
            'extraTemplateIds.*' => ['uuid'],
            // A picture for one of the design's free-image spots ("Missing on your listing").
            'spotImage' => ['sometimes', 'array'],
            'spotImage.id' => ['required_with:spotImage', 'string', 'max:40'],
            'spotImage.url' => ['required_with:spotImage', 'url', 'max:500'],
            // The picture's own size, when known: it then starts filling its whole box ("full size").
            'spotImage.width' => ['sometimes', 'nullable', 'integer', 'min:1', 'max:20000'],
            'spotImage.height' => ['sometimes', 'nullable', 'integer', 'min:1', 'max:20000'],
            // A free image cut to a ready shape (from the open card): normal, square, round or oval.
            'spotShape' => ['sometimes', 'array'],
            'spotShape.id' => ['required_with:spotShape', 'string', 'max:40'],
            'spotShape.shape' => ['required_with:spotShape', 'in:'.implode(',', ImageCard::SHAPE_PRESETS)],
            // A picture box moved and zoomed (from the open card): its id and where the picture sits.
            'spotFit' => ['sometimes', 'array'],
            'spotFit.id' => ['required_with:spotFit', 'string', 'max:40'],
            'spotFit.fit' => ['nullable', 'array'],
            'spotFit.fit.l' => ['required_with:spotFit.fit', 'numeric', 'min:-'.(ImageCard::FIT_MAX - 100), 'max:'.(100 - ImageCard::FIT_MIN)],
            'spotFit.fit.t' => ['required_with:spotFit.fit', 'numeric', 'min:-'.(ImageCard::FIT_MAX - 100), 'max:'.(100 - ImageCard::FIT_MIN)],
            'spotFit.fit.w' => ['required_with:spotFit.fit', 'numeric', 'min:'.ImageCard::FIT_MIN, 'max:'.ImageCard::FIT_MAX],
            'spotFit.fit.h' => ['required_with:spotFit.fit', 'numeric', 'min:'.ImageCard::FIT_MIN, 'max:'.ImageCard::FIT_MAX],
        ]);
        if (! $data) {
            throw ApiException::badRequest('Send a templateId, backgroundImageUrl, imageUrl, hotspots, imageColour or multiView');
        }
        if (! self::canEditDesign($actor) && array_intersect_key($data, array_flip(['imageUrl', 'imageWidth', 'imageHeight', 'hotspots']))) {
            throw ApiException::forbidden('The card design can only be changed by your dealer or an admin. You can pick a ready-made design.');
        }
        $changes = [];

        if (isset($data['templateId'])) {
            $template = CardTemplate::where('isActive', true)->find($data['templateId'])
                ?? throw ApiException::badRequest('That design is not available');
            if (! CardEngine::templatesFor($business->categoryId)->contains('id', $template->id) && $actor['role'] !== 'ADMIN') {
                throw ApiException::badRequest('That design is not offered for this business’s category');
            }
            if (! CardEngine::canUse($template, $business, $actor)) {
                throw ApiException::forbidden('This is a premium design. Upgrade your plan to use it.');
            }
            $changes['templateId'] = $template->id;
            // Picking a design drops the card's own image copy, so the design's
            // image (if it has one) shows — unless an image is sent with it.
            if (! array_key_exists('imageUrl', $data)) {
                $changes += ['imageUrl' => null, 'imageWidth' => null, 'imageHeight' => null, 'hotspots' => null];
                // Switching to another design takes what was put on the old one with it:
                // uploaded pictures, a logo, typed numbers, links and text, in the
                // matching boxes of the new design (re-picking the same design resets it).
                $old = ImageCard::source($business);
                $current = CardEngine::templateFor($business, $business->card);
                if ($old && $template->imageUrl && $template->id !== $current?->id) {
                    [$hotspots, $filled] = ImageCard::carryOver($old['hotspots'] ?? [], $template->hotspots ?? []);
                    if ($filled) {
                        $changes = ['imageUrl' => $template->imageUrl, 'imageWidth' => $template->imageWidth, 'imageHeight' => $template->imageHeight, 'hotspots' => $hotspots] + $changes;
                    }
                }
            }
        }
        if (array_key_exists('backgroundImageUrl', $data)) {
            if ($data['backgroundImageUrl'] !== null && ! CardEngine::isSafeUrl($data['backgroundImageUrl'])) {
                throw ApiException::badRequest('That image address cannot be used');
            }
            $changes['backgroundImageUrl'] = $data['backgroundImageUrl'];
        }
        if (array_key_exists('imageUrl', $data)) {
            if ($data['imageUrl'] !== null && ! CardEngine::isSafeUrl($data['imageUrl'])) {
                throw ApiException::badRequest('That image address cannot be used');
            }
            $changes['imageUrl'] = $data['imageUrl'];
            $changes['imageWidth'] = $data['imageUrl'] !== null ? ($data['imageWidth'] ?? null) : null;
            $changes['imageHeight'] = $data['imageUrl'] !== null ? ($data['imageHeight'] ?? null) : null;
        }
        if (array_key_exists('hotspots', $data)) {
            $changes['hotspots'] = ImageCard::normalize($data['hotspots'] ?? []);
        }
        // Filling a free-image spot is content, not design: the whole business team can.
        // A card still wearing a ready-made design gets its own copy of it, with the picture in.
        if (isset($data['spotImage']) && ! array_key_exists('hotspots', $changes)) {
            if (! CardEngine::isSafeUrl($data['spotImage']['url'])) {
                throw ApiException::badRequest('That image address cannot be used');
            }
            $source = ImageCard::source($business);
            $hotspots = $source ? ImageCard::withSpotImage($source['hotspots'], $data['spotImage']['id'], $data['spotImage']['url']) : null;
            if ($hotspots === null) {
                throw ApiException::badRequest('Your card has no such image spot');
            }
            // Full size: a new picture whose size is known fills its whole box, in its own proportions.
            if (! empty($data['spotImage']['width']) && ! empty($data['spotImage']['height'])) {
                foreach ($hotspots as &$h) {
                    if (($h['id'] ?? null) === $data['spotImage']['id']) {
                        $h['fit'] = ImageCard::coverFit($h, $source['imageWidth'], $source['imageHeight'], $data['spotImage']['width'], $data['spotImage']['height']) ?? ($h['fit'] ?? null);
                    }
                }
                unset($h);
            }
            $changes['hotspots'] = $hotspots;
            if ($source['fromTemplate']) {
                $changes += ['imageUrl' => $source['imageUrl'], 'imageWidth' => $source['imageWidth'], 'imageHeight' => $source['imageHeight']];
            }
        }
        // Its shape too: content, not the design — the whole business team can.
        if (isset($data['spotShape']) && ! array_key_exists('hotspots', $changes)) {
            $source = ImageCard::source($business);
            $hotspots = $source ? ImageCard::withSpotShape($source['hotspots'], $data['spotShape']['id'], $data['spotShape']['shape'], $source['imageWidth'], $source['imageHeight']) : null;
            if ($hotspots === null) {
                throw ApiException::badRequest('Your card has no such picture');
            }
            $changes['hotspots'] = $hotspots;
            if ($source['fromTemplate']) {
                $changes += ['imageUrl' => $source['imageUrl'], 'imageWidth' => $source['imageWidth'], 'imageHeight' => $source['imageHeight']];
            }
        }
        // Arranging a picture (move and zoom) is content too: the whole business team can.
        if (isset($data['spotFit']) && ! array_key_exists('hotspots', $changes)) {
            $source = ImageCard::source($business);
            $hotspots = $source ? ImageCard::withSpotFit($source['hotspots'], $data['spotFit']['id'], $data['spotFit']['fit'] ?? null) : null;
            if ($hotspots === null) {
                throw ApiException::badRequest('Your card has no such picture');
            }
            $changes['hotspots'] = $hotspots;
            if ($source['fromTemplate']) {
                $changes += ['imageUrl' => $source['imageUrl'], 'imageWidth' => $source['imageWidth'], 'imageHeight' => $source['imageHeight']];
            }
        }
        if (array_key_exists('imageColour', $data)) {
            $changes['imageColour'] = ImageColour::normalize(self::withOwnAreas($actor, $data['imageColour'], $business->card?->imageColour));
        }
        // Multi card view is about sharing, not the design: the whole business team can set it.
        if (array_key_exists('multiView', $data)) {
            $changes['multiView'] = $data['multiView'];
        }
        if (array_key_exists('extraTemplateIds', $data)) {
            $offered = ImageCard::extraDesignOptions($business)->pluck('id')->all();
            $ids = array_values(array_intersect(array_unique($data['extraTemplateIds'] ?? []), $offered));
            if ($data['extraTemplateIds'] && ! $ids) {
                throw ApiException::badRequest('Pick at least one of the designs offered');
            }
            $changes['extraTemplateIds'] = $ids ?: null;
        }

        $card = BusinessCard::updateOrCreate(['businessId' => $business->id], $changes);

        return ApiResponse::ok([
            'templateId' => $card->templateId,
            'backgroundImageUrl' => $card->backgroundImageUrl,
            'imageUrl' => $card->imageUrl,
            'imageWidth' => $card->imageWidth,
            'imageHeight' => $card->imageHeight,
            'hotspots' => $card->hotspots ?? [],
            'imageColour' => ImageColour::normalize($card->imageColour),
            'multiView' => (bool) $card->multiView,
            'extraTemplateIds' => $card->extraTemplateIds,
            'isPublished' => $card->isPublished,
        ]);
    }

    /**
     * An AI background made for this business, from its category, name, city
     * and description, in the colours of the design it wears (or the one
     * given). Not applied: the answer carries a preview, and the owner keeps
     * it with update(backgroundImageUrl).
     */
    public function generateBackground(Request $request, string $id)
    {
        $business = $this->managed($request, $id);
        $data = $request->validate([
            'templateId' => ['nullable', 'uuid'],
            'hint' => ['nullable', 'string', 'max:200'],
            'style' => ['nullable', 'in:'.implode(',', array_keys(BackgroundGenerator::STYLES))],
        ]);
        $template = (! empty($data['templateId']) ? CardTemplate::where('isActive', true)->find($data['templateId']) : null)
            ?? CardEngine::templateFor($business);
        $design = CardEngine::normalizeDesign($template?->design);

        $result = BackgroundGenerator::generate([
            'name' => $business->name,
            'category' => $business->category?->name,
            'city' => $business->city,
            'description' => $business->description,
        ], $design, $template?->layout ?? 'classic', $data['hint'] ?? null, style: $data['style'] ?? null);

        $details = ['cardBackgroundUrl' => $result['url']] + CardEngine::details($business);

        return ApiResponse::ok([
            'url' => $result['url'],
            'source' => $result['source'],
            'style' => $result['style'],
            'previewHtml' => CardEngine::render($template, $details, true),
        ]);
    }

    /**
     * The card as the editor has it right now, saved or not: the image and
     * actions sent, drawn with the business's own details. Actions still
     * being typed are shown without their unfinished value.
     */
    public function preview(Request $request, string $id)
    {
        $business = $this->managed($request, $id);
        $data = $request->validate([
            'imageUrl' => ['required', 'url', 'max:500'],
            'imageWidth' => ['nullable', 'integer', 'min:1', 'max:20000'],
            'imageHeight' => ['nullable', 'integer', 'min:1', 'max:20000'],
            ...ImageCard::rules(),
            ...ImageColour::rules(),
        ]);
        if (! CardEngine::isSafeUrl($data['imageUrl'])) {
            throw ApiException::badRequest('That image address cannot be used');
        }

        return ApiResponse::ok(['html' => ImageCard::renderSource([
            ...$data,
            'hotspots' => ImageCard::normalize($data['hotspots'] ?? [], true),
            'colour' => ImageColour::normalize(self::withOwnAreas($request->attributes->get('auth'), $data['imageColour'] ?? null, $business->card?->imageColour)),
        ], CardEngine::details($business), true, self::canEditDesign($request->attributes->get('auth')))]);
    }

    public function publish(Request $request, string $id)
    {
        $business = $this->managed($request, $id);
        $data = $request->validate(['isPublished' => ['sometimes', 'boolean']]);
        $publish = $data['isPublished'] ?? true;

        $card = $business->card ?? new BusinessCard(['businessId' => $business->id]);
        // Pin the design in use, so a later change of category default doesn't restyle a live card.
        $card->templateId ??= CardEngine::templateFor($business, $card)?->id;
        $card->isPublished = $publish;
        if ($publish && ! $card->publishedAt) {
            $card->publishedAt = now();
        }
        $card->save();

        return ApiResponse::ok([
            'isPublished' => $card->isPublished,
            'live' => self::isLive($business, $card),
            'listingLive' => $business->status === 'PUBLISHED',
            'publicUrl' => CardEngine::cardUrl($business->slug),
        ]);
    }
}
