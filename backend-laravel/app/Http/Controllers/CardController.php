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
            // The image's recolouring — the whole business team, owners too, can change it.
            'imageColour' => ImageColour::normalize($card?->imageColour),
            'imageColourDefaults' => ImageColour::DEFAULTS,
            'missingDetails' => ImageCard::missingDetails($image['hotspots'] ?? [], ImageCard::listingDefaults($details)),
            // An owner's preview looks like the public card: no outlines over the tap areas.
            // For an owner, the page lays the colour over it live (card-manager.js), so it's drawn without.
            'imagePreviewHtml' => $image ? ImageCard::renderSource(self::canEditDesign($actor) ? $image : [...$image, 'colour' => null], $details, true, self::canEditDesign($actor)) : null,
            // Ready-made image designs from the admin, for "Start from a design".
            'imageTemplates' => $templates->filter(fn (CardTemplate $t) => (bool) $t->imageUrl)->map(fn (CardTemplate $t) => [
                'id' => $t->id,
                'name' => $t->name,
                'imageUrl' => $t->imageUrl,
                'actionCount' => count($t->hotspots ?? []),
                'inUse' => $t->id === $current?->id && ! $card?->imageUrl,
            ])->values(),
            'aiProvider' => BackgroundGenerator::provider(),
            'aiStyles' => BackgroundGenerator::STYLES,
            'aiDefaultStyle' => BackgroundGenerator::defaultStyle($current?->layout ?? 'classic'),
            'isPublished' => (bool) $card?->isPublished,
            'live' => self::isLive($business, $card),
            'listingLive' => $business->status === 'PUBLISHED',
            'publishedAt' => $card?->publishedAt,
            'viewCount' => $card?->viewCount ?? 0,
            'publicUrl' => CardEngine::cardUrl($business->slug),
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
        ]);
        if (! $data) {
            throw ApiException::badRequest('Send a templateId, backgroundImageUrl, imageUrl, hotspots or imageColour');
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
        if (array_key_exists('imageColour', $data)) {
            $changes['imageColour'] = ImageColour::normalize($data['imageColour']);
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
            'colour' => ImageColour::normalize($data['imageColour'] ?? null),
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
