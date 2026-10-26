<?php

namespace App\Http\Controllers;

use App\Exceptions\ApiException;
use App\Models\Business;
use App\Models\GoldRate;
use App\Models\GoldRateLogo;
use App\Models\GoldRatePreset;
use App\Models\GoldRateTemplate;
use App\Support\ApiResponse;
use App\Support\GoldRates\BusinessCard;
use App\Support\GoldRates\GoldRateFiles;
use App\Support\GoldRates\TemplateLayout;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Throwable;

// The admin's gold-rate poster maker: today's rates, the logo library and
// the templates (master PNG + layout). Admin-only (routes/api.php). The
// poster itself is drawn and downloaded in the browser
// (resources/js/lib/gold-rate-render.js), so nothing here renders images.
class GoldRateController extends Controller
{
    // ---------------------------------------------------------------
    // Rates
    // ---------------------------------------------------------------

    public function rates()
    {
        return ApiResponse::ok(GoldRate::current());
    }

    // Rates are typed in by the admin. A purity left empty is cleared, and
    // shows as "—" on the poster.
    public function updateRates(Request $request)
    {
        $rules = ['rates' => ['required', 'array:'.implode(',', GoldRate::PURITIES)]];
        foreach (GoldRate::PURITIES as $purity) {
            $rules["rates.{$purity}"] = ['nullable', 'numeric', 'min:0', 'max:9999999999'];
        }
        $data = $request->validate($rules);
        $actor = $request->attributes->get('auth');

        DB::transaction(function () use ($data, $actor) {
            foreach ($data['rates'] as $purity => $rate) {
                GoldRate::updateOrCreate(['purity' => $purity], [
                    'rate' => $rate === null ? null : round((float) $rate, 2),
                    'updatedById' => $actor['sub'],
                ]);
            }
        });

        return ApiResponse::ok(GoldRate::current());
    }

    // ---------------------------------------------------------------
    // Logos
    // ---------------------------------------------------------------

    public function logos()
    {
        return ApiResponse::ok(GoldRateLogo::withCount('templates')->orderByDesc('createdAt')->get());
    }

    public function storeLogo(Request $request)
    {
        $data = $request->validate(['name' => ['nullable', 'string', 'max:100']]);
        $file = $request->file('file');
        $stored = GoldRateFiles::storeLogo($file);
        $name = trim($data['name'] ?? '') ?: mb_substr(pathinfo($file->getClientOriginalName(), PATHINFO_FILENAME), 0, 100);

        try {
            $logo = GoldRateLogo::create(['name' => $name ?: 'Logo', ...$stored]);
        } catch (Throwable $e) {
            GoldRateFiles::delete($stored['path']);
            throw $e;
        }

        return ApiResponse::created($logo);
    }

    // Templates using it keep their layout and just show no logo until
    // another is picked.
    public function destroyLogo(string $id)
    {
        $logo = GoldRateLogo::find($id) ?? throw ApiException::notFound('Logo not found');
        $logo->delete();
        GoldRateFiles::delete($logo->path);

        return ApiResponse::noContent();
    }

    // ---------------------------------------------------------------
    // Businesses
    // ---------------------------------------------------------------

    // What a poster can show about a business, for the editor when one is
    // linked.
    public function businessCard(string $id)
    {
        return ApiResponse::ok(BusinessCard::for(Business::find($id) ?? throw ApiException::notFound('Business not found')));
    }

    // ---------------------------------------------------------------
    // Presets (rate-box designs saved from the editor)
    // ---------------------------------------------------------------

    public function presets()
    {
        return ApiResponse::ok(GoldRatePreset::orderBy('createdAt')->get());
    }

    public function storePreset(Request $request)
    {
        $data = $request->validate(['name' => ['required', 'string', 'min:1', 'max:60'], ...TemplateLayout::presetRules()]);

        return ApiResponse::created(GoldRatePreset::create([
            'name' => trim($data['name']),
            'style' => TemplateLayout::normalizePreset($data['style']),
            'createdById' => $request->attributes->get('auth')['sub'],
        ]));
    }

    // Templates already styled with it keep their look — a preset is only
    // copied into a rate box when applied.
    public function destroyPreset(string $id)
    {
        (GoldRatePreset::find($id) ?? throw ApiException::notFound('Preset not found'))->delete();

        return ApiResponse::noContent();
    }

    // ---------------------------------------------------------------
    // Templates
    // ---------------------------------------------------------------

    public function templates()
    {
        return ApiResponse::ok(GoldRateTemplate::with(['logo', 'business.hours'])->orderByDesc('updatedAt')->get());
    }

    public function showTemplate(string $id)
    {
        return ApiResponse::ok($this->findTemplate($id)->load('logo'));
    }

    // Upload a master PNG. It starts with a default layout to adjust in the
    // editor.
    public function storeTemplate(Request $request)
    {
        $data = $request->validate([
            'name' => ['required', 'string', 'min:1', 'max:100'],
            'logoId' => ['nullable', 'uuid', 'exists:gold_rate_logos,id'],
        ]);
        $stored = GoldRateFiles::storeTemplate($request->file('file'));
        $logo = isset($data['logoId']) ? GoldRateLogo::find($data['logoId']) : null;

        try {
            $template = GoldRateTemplate::create([
                'name' => trim($data['name']),
                'imagePath' => $stored['path'],
                'thumbPath' => $stored['thumbPath'],
                'imageWidth' => $stored['width'],
                'imageHeight' => $stored['height'],
                'logoId' => $data['logoId'] ?? null,
                'layout' => TemplateLayout::default($stored['width'], $stored['height'], $logo ? $logo->width / $logo->height : null),
                'createdById' => $request->attributes->get('auth')['sub'],
            ]);
        } catch (Throwable $e) {
            GoldRateFiles::delete($stored['path'], $stored['thumbPath']);
            throw $e;
        }

        return ApiResponse::created($template->load('logo'));
    }

    // Name, logo and/or layout. A new master image goes through
    // replaceTemplateImage().
    public function updateTemplate(Request $request, string $id)
    {
        $template = $this->findTemplate($id);
        $rules = [
            'name' => ['sometimes', 'string', 'min:1', 'max:100'],
            'logoId' => ['sometimes', 'nullable', 'uuid', 'exists:gold_rate_logos,id'],
            'businessId' => ['sometimes', 'nullable', 'uuid', 'exists:businesses,id'],
        ];
        if ($request->has('layout')) {
            $rules += TemplateLayout::rules($template->imageWidth, $template->imageHeight);
        }
        $data = $request->validate($rules);

        if (isset($data['layout'])) {
            $data['layout'] = TemplateLayout::normalize($data['layout'], $template->imageWidth, $template->imageHeight);
        }
        if (isset($data['name'])) {
            $data['name'] = trim($data['name']);
        }
        $template->update($data);

        return ApiResponse::ok($template->fresh('logo'));
    }

    // A new master image for the template. The new PNG is stored as
    // uploaded, like any master (the old file is removed, never edited);
    // the logo, rates and styles stay, scaled if the new image is another
    // size.
    public function replaceTemplateImage(Request $request, string $id)
    {
        $template = $this->findTemplate($id);
        $stored = GoldRateFiles::storeTemplate($request->file('file'));
        $old = [$template->imagePath, $template->thumbPath];

        try {
            $template->update([
                'imagePath' => $stored['path'],
                'thumbPath' => $stored['thumbPath'],
                'layout' => TemplateLayout::scale($template->layout, $template->imageWidth, $template->imageHeight, $stored['width'], $stored['height']),
                'imageWidth' => $stored['width'],
                'imageHeight' => $stored['height'],
            ]);
        } catch (Throwable $e) {
            GoldRateFiles::delete($stored['path'], $stored['thumbPath']);
            throw $e;
        }
        GoldRateFiles::delete(...$old);

        return ApiResponse::ok($template->fresh('logo'));
    }

    // A copy with the same background, logo and layout, to adapt without
    // touching the original.
    public function duplicateTemplate(Request $request, string $id)
    {
        $source = $this->findTemplate($id);
        $imagePath = GoldRateFiles::copy($source->imagePath);
        $thumbPath = GoldRateFiles::copyThumb($source->thumbPath);

        try {
            $copy = GoldRateTemplate::create([
                'name' => mb_substr("{$source->name} (Copy)", 0, 100),
                'imagePath' => $imagePath,
                'thumbPath' => $thumbPath,
                'imageWidth' => $source->imageWidth,
                'imageHeight' => $source->imageHeight,
                'logoId' => $source->logoId,
                'businessId' => $source->businessId,
                'layout' => $source->layout,
                'createdById' => $request->attributes->get('auth')['sub'],
            ]);
        } catch (Throwable $e) {
            GoldRateFiles::delete($imagePath, $thumbPath);
            throw $e;
        }

        return ApiResponse::created($copy->load('logo'));
    }

    public function destroyTemplate(string $id)
    {
        $template = $this->findTemplate($id);
        $template->delete();
        GoldRateFiles::delete($template->imagePath, $template->thumbPath);

        return ApiResponse::noContent();
    }

    private function findTemplate(string $id): GoldRateTemplate
    {
        return GoldRateTemplate::find($id) ?? throw ApiException::notFound('Template not found');
    }
}
