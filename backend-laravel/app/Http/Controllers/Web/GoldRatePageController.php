<?php

namespace App\Http\Controllers\Web;

use App\Exceptions\ApiException;
use App\Http\Controllers\Controller;
use App\Models\Business;
use App\Models\GoldRate;
use App\Models\GoldRatePreset;
use App\Models\GoldRateTemplate;
use App\Support\GoldRates\BusinessCard;
use App\Support\GoldRates\GoldRateFiles;
use App\Support\GoldRates\TemplateLayout;

// The gold-rate template editor page, and the template and business logo
// images it draws with. The images live on the private disk; serving them from here
// (same origin, admin session) keeps them private and lets the browser
// export the canvas they're drawn on.
class GoldRatePageController extends Controller
{
    public function editor(string $id)
    {
        $template = GoldRateTemplate::with('business.hours')->findOrFail($id);

        return view('pages.admin.gold-rate-editor', [
            'template' => $template,
            'editorData' => [
                'template' => $template,
                'presets' => GoldRatePreset::orderBy('createdAt')->get(),
                'rates' => GoldRate::current(),
                'purities' => GoldRate::PURITIES,
                'fonts' => TemplateLayout::FONTS,
                'weights' => TemplateLayout::WEIGHTS,
            ],
        ]);
    }

    public function templateImage(string $id)
    {
        $template = GoldRateTemplate::findOrFail($id);

        return GoldRateFiles::response($template->imagePath, 'image/png');
    }

    public function templateThumb(string $id)
    {
        $template = GoldRateTemplate::findOrFail($id);

        return GoldRateFiles::response($template->thumbPath ?? $template->imagePath, 'image/png');
    }

    // A linked business's logo, through the server so the canvas can export
    // it (BusinessCard::logo() decides which addresses may be fetched).
    public function businessLogo(string $id)
    {
        $business = Business::findOrFail($id);
        try {
            $logo = BusinessCard::logo($business);
        } catch (ApiException $e) {
            return response($e->getMessage(), $e->statusCode)->header('Content-Type', 'text/plain');
        }

        return response(base64_decode($logo['body']), 200, [
            'Content-Type' => $logo['mime'],
            'X-Content-Type-Options' => 'nosniff',
            'Content-Security-Policy' => "default-src 'none'",
            'Cache-Control' => 'private, max-age=3600',
        ]);
    }
}
