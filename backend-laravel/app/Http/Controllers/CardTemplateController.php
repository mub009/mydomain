<?php

namespace App\Http\Controllers;

use App\Exceptions\ApiException;
use App\Models\BusinessCard;
use App\Models\CardTemplate;
use App\Support\ApiResponse;
use App\Support\Cards\BackgroundGenerator;
use App\Support\Cards\CardEngine;
use App\Support\Cards\ImageCard;
use App\Support\Cards\ImageColour;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

// Admin management of the digital-visiting-card designs: any number per
// category (or general), each with its layout, background, fonts, colours
// and button style; one default per category; active/inactive.
// A template can instead be an image template: an uploaded card artwork with
// actions placed on it (imageUrl + hotspots, see ImageCard), each linked to
// the details of whichever business wears it.
class CardTemplateController extends Controller
{
    private function rules(bool $partial): array
    {
        $required = $partial ? 'sometimes' : 'required';

        return [
            'name' => [$required, 'string', 'min:2', 'max:80'],
            'categoryId' => ['sometimes', 'nullable', 'uuid', 'exists:categories,id'],
            // Common: offered to every category (only for a design without a category of its own).
            'isCommon' => ['sometimes', 'boolean'],
            'layout' => [$required, 'in:'.implode(',', array_keys(CardEngine::LAYOUTS))],
            'backgroundImageUrl' => ['sometimes', 'nullable', 'url', 'max:500', 'regex:#^https?://[^\s"\'()<>\\\\]+$#i'],
            'isDefault' => ['sometimes', 'boolean'],
            'isActive' => ['sometimes', 'boolean'],
            'isPremium' => ['sometimes', 'boolean'],
            'sortOrder' => ['sometimes', 'integer', 'min:0', 'max:10000'],
            ...self::imageRules(),
            ...CardEngine::designRules(),
        ];
    }

    private static function imageRules(): array
    {
        return [
            'imageUrl' => ['sometimes', 'nullable', 'url', 'max:500', 'regex:#^https?://[^\s"\'()<>\\\\]+$#i'],
            'imageWidth' => ['sometimes', 'nullable', 'integer', 'min:1', 'max:20000'],
            'imageHeight' => ['sometimes', 'nullable', 'integer', 'min:1', 'max:20000'],
            ...ImageCard::rules(),
            // Where a business's colour may go on this design's image (ImageColour::areas).
            'colourAreas' => ['sometimes', 'nullable', 'array', 'max:'.ImageColour::MAX_AREAS],
            'colourAreas.*' => ['array'],
            'colourAreas.*.erase' => ['nullable', 'boolean'],
            'colourAreas.*.points' => ['required', 'array', 'min:3', 'max:'.ImageColour::MAX_AREA_POINTS],
            'colourAreas.*.points.*' => ['array', 'size:2'],
            'colourAreas.*.points.*.*' => ['numeric'],
            // Colour versions: the same design in other colours, each a swatch and its own image.
            'colourVariants' => ['sometimes', 'nullable', 'array', 'max:'.ImageCard::MAX_COLOUR_VARIANTS],
            'colourVariants.*.id' => ['nullable', 'string', 'max:40', 'regex:/^[A-Za-z0-9_-]+$/'],
            'colourVariants.*.colour' => ['required', 'string', 'regex:/^#[0-9a-fA-F]{6}$/'],
            'colourVariants.*.imageUrl' => ['required', 'url', 'max:500', 'regex:#^https?://[^\s"\'()<>\\\\]+$#i'],
            'colourVariants.*.imageWidth' => ['nullable', 'integer', 'min:1', 'max:20000'],
            'colourVariants.*.imageHeight' => ['nullable', 'integer', 'min:1', 'max:20000'],
            // The colours businesses may recolour this design in (none = the standard swatches).
            'colourChoices' => ['sometimes', 'nullable', 'array', 'max:'.ImageCard::MAX_COLOUR_CHOICES],
            'colourChoices.*' => ['string', 'regex:/^#[0-9a-fA-F]{6}$/'],
        ];
    }

    // The image fields as stored: actions checked and kept inside the image,
    // and no size or actions left behind on a template whose image is removed.
    private static function imageFields(array $data): array
    {
        if (array_key_exists('hotspots', $data)) {
            $data['hotspots'] = ImageCard::normalize($data['hotspots'] ?? []);
        }
        if (array_key_exists('colourAreas', $data)) {
            $data['colourAreas'] = ImageColour::areas($data['colourAreas'] ?? null) ?: null;
        }
        if (array_key_exists('colourChoices', $data)) {
            $data['colourChoices'] = ImageCard::colourChoices($data['colourChoices'] ?? null) ?: null;
        }
        if (array_key_exists('colourVariants', $data)) {
            $data['colourVariants'] = ImageCard::colourVariants($data['colourVariants'] ?? null) ?: null;
        }
        // No image, nothing to mark or recolour: its areas and colour versions go with it.
        if (array_key_exists('imageUrl', $data) && $data['imageUrl'] === null) {
            $data['imageWidth'] = $data['imageHeight'] = null;
            $data['colourAreas'] = null;
            $data['colourVariants'] = null;
        }

        return $data;
    }

    private function find(string $id): CardTemplate
    {
        return CardTemplate::with('category')->find($id) ?? throw ApiException::notFound('Template not found');
    }

    private function uniqueSlug(string $name): string
    {
        $base = Str::slug(str_replace('&', 'and', $name)) ?: 'card';
        $slug = $base;
        for ($n = 2; CardTemplate::where('slug', $slug)->exists(); $n++) {
            $slug = "{$base}-{$n}";
        }

        return $slug;
    }

    // One default per category: setting it here clears it on the others.
    private function saveWithDefault(CardTemplate $template): CardTemplate
    {
        // A design for one category isn't also common to all of them.
        if ($template->categoryId) {
            $template->isCommon = false;
        }
        DB::transaction(function () use ($template) {
            $template->save();
            if ($template->isDefault) {
                CardTemplate::where('id', '!=', $template->id)
                    ->where(fn ($q) => $template->categoryId ? $q->where('categoryId', $template->categoryId) : $q->whereNull('categoryId'))
                    ->update(['isDefault' => false]);
            }
        });

        return $template->fresh('category');
    }

    private function payload(CardTemplate $template): array
    {
        return [
            ...CardEngine::summary($template),
            'usedBy' => BusinessCard::where('templateId', $template->id)->count(),
        ];
    }

    public function index(Request $request)
    {
        $data = $request->validate([
            // A category id, "general" for the templates without one, or "common" for those offered to every category.
            'categoryId' => ['nullable', 'string', 'max:40'],
            'status' => ['nullable', 'in:active,inactive'],
            'search' => ['nullable', 'string', 'max:80'],
        ]);
        $query = CardTemplate::with('category')
            ->orderByRaw('categoryId is null')->orderBy('categoryId')->orderByDesc('isDefault')->orderBy('sortOrder')->orderBy('name');
        if (($data['categoryId'] ?? null) === 'common') {
            $query->where('isCommon', true);
        } elseif (($data['categoryId'] ?? null) === 'general') {
            $query->whereNull('categoryId')->where('isCommon', false);
        } elseif (! empty($data['categoryId'])) {
            $query->where('categoryId', $data['categoryId']);
        }
        match ($data['status'] ?? null) {
            'active' => $query->where('isActive', true),
            'inactive' => $query->where('isActive', false),
            default => null,
        };
        if (! empty($data['search'])) {
            $query->where('name', 'like', '%'.$data['search'].'%');
        }
        $templates = $query->get();
        $usage = BusinessCard::whereIn('templateId', $templates->pluck('id'))
            ->selectRaw('templateId, count(*) as n')->groupBy('templateId')->pluck('n', 'templateId');

        return ApiResponse::ok($templates->map(fn ($t) => [...CardEngine::summary($t), 'usedBy' => (int) ($usage[$t->id] ?? 0)])->values());
    }

    public function show(string $id)
    {
        return ApiResponse::ok($this->payload($this->find($id)));
    }

    public function store(Request $request)
    {
        $data = self::imageFields($request->validate($this->rules(false)));
        $template = new CardTemplate([
            ...$data,
            'slug' => $this->uniqueSlug($data['name']),
            'design' => CardEngine::normalizeDesign($data['design'] ?? null),
            'isActive' => $data['isActive'] ?? true,
            'isPremium' => $data['isPremium'] ?? false,
            'isDefault' => $data['isDefault'] ?? false,
            'sortOrder' => $data['sortOrder'] ?? (int) CardTemplate::where('categoryId', $data['categoryId'] ?? null)->max('sortOrder') + 1,
        ]);

        return ApiResponse::created($this->payload($this->saveWithDefault($template)));
    }

    public function update(Request $request, string $id)
    {
        $template = $this->find($id);
        $data = self::imageFields($request->validate($this->rules(true)));
        if (array_key_exists('design', $data)) {
            // Partial design edits keep the rest of the saved design.
            $data['design'] = CardEngine::normalizeDesign(array_replace_recursive($template->design ?? [], $data['design'] ?? []));
        }
        $template->fill($data);

        return ApiResponse::ok($this->payload($this->saveWithDefault($template)));
    }

    public function duplicate(string $id)
    {
        $source = $this->find($id);
        $copy = $source->replicate(['slug']);
        $copy->name = Str::limit("{$source->name} (copy)", 80, '');
        $copy->slug = $this->uniqueSlug($copy->name);
        $copy->isDefault = false;
        // Starts hidden, so it can be finished before businesses see it.
        $copy->isActive = false;
        $copy->save();

        return ApiResponse::created($this->payload($copy->fresh('category')));
    }

    // Cards wearing a deleted design fall back to their category's default.
    public function destroy(string $id)
    {
        $this->find($id)->delete();

        return ApiResponse::noContent();
    }

    // Renders an unsaved design, for the editor's live preview.
    public function preview(Request $request)
    {
        $data = $request->validate([
            'layout' => ['required', 'in:'.implode(',', array_keys(CardEngine::LAYOUTS))],
            'backgroundImageUrl' => ['nullable', 'string', 'max:500'],
            'name' => ['nullable', 'string', 'max:150'],
            'categoryId' => ['nullable', 'uuid'],
            ...self::imageRules(),
            ...CardEngine::designRules(),
        ]);
        $category = ! empty($data['categoryId']) ? \App\Models\Category::whereKey($data['categoryId'])->value('name') : null;
        $sample = CardEngine::sampleDetails($data['name'] ?? null, $category);

        // With an image, the card is that image with its actions; else the layout.
        if (! empty($data['imageUrl'])) {
            return ApiResponse::ok(['html' => ImageCard::renderSource([
                ...$data,
                'hotspots' => ImageCard::normalize($data['hotspots'] ?? [], true),
            ], $sample, true)]);
        }

        return ApiResponse::ok([
            'html' => CardEngine::render($data, $sample, true),
        ]);
    }

    // An AI background for a template, from its category and design. Returns
    // the image's address for the editor's background field; nothing is saved.
    public function generateBackground(Request $request)
    {
        $data = $request->validate([
            'layout' => ['required', 'in:'.implode(',', array_keys(CardEngine::LAYOUTS))],
            'categoryId' => ['nullable', 'uuid'],
            'hint' => ['nullable', 'string', 'max:200'],
            'style' => ['nullable', 'in:'.implode(',', array_keys(BackgroundGenerator::STYLES))],
            ...CardEngine::designRules(),
        ]);
        $category = ! empty($data['categoryId']) ? \App\Models\Category::whereKey($data['categoryId'])->value('name') : null;

        $result = BackgroundGenerator::generate(
            ['category' => $category ?? 'local business'],
            CardEngine::normalizeDesign($data['design'] ?? null),
            $data['layout'],
            $data['hint'] ?? null,
            'cards/backgrounds',
            $data['style'] ?? null,
        );

        return ApiResponse::ok(['url' => $result['url'], 'source' => $result['source'], 'style' => $result['style']]);
    }

    // The editor's choices.
    public function options()
    {
        return ApiResponse::ok([
            'layouts' => CardEngine::LAYOUTS,
            'buttonStyles' => CardEngine::BUTTON_STYLES,
            'fonts' => CardEngine::FONTS,
            'colorKeys' => CardEngine::COLOR_KEYS,
            'defaultDesign' => CardEngine::defaultDesign(),
            'aiStyles' => BackgroundGenerator::STYLES,
            'actions' => ImageCard::actionList(),
            'actionDefaults' => ImageCard::TEMPLATE_DEFAULTS,
        ]);
    }
}
