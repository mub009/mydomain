<?php

namespace App\Http\Controllers;

use App\Exceptions\ApiException;
use App\Support\ApiResponse;
use App\Support\BusinessFeatures;
use App\Support\FeaturePlans;
use Illuminate\Http\Request;

// Admin: feature pricing (App\Support\FeaturePlans) — each feature's points
// to add it, points to renew it, price in rupees, and how long it lasts.
class FeaturePlanController extends Controller
{
    public function index()
    {
        return ApiResponse::ok(['plans' => FeaturePlans::present(), 'durations' => self::durations()]);
    }

    public function update(Request $request)
    {
        $data = $request->validate([
            'plans' => ['required', 'array', 'min:1'],
            'plans.*.feature' => ['required', 'string', 'distinct', 'in:'.implode(',', BusinessFeatures::ALL)],
            'plans.*.points' => ['required', 'integer', 'min:0', 'max:'.FeaturePlans::MAX_POINTS],
            'plans.*.renewalPoints' => ['required', 'integer', 'min:0', 'max:'.FeaturePlans::MAX_POINTS],
            'plans.*.price' => ['present', 'nullable', 'integer', 'min:0', 'max:'.FeaturePlans::MAX_PRICE],
            'plans.*.renewalPrice' => ['sometimes', 'nullable', 'integer', 'min:0', 'max:'.FeaturePlans::MAX_PRICE],
            'plans.*.commission' => ['sometimes', 'nullable', 'integer', 'min:0', 'max:'.FeaturePlans::MAX_PRICE],
            'plans.*.renewalCommission' => ['sometimes', 'nullable', 'integer', 'min:0', 'max:'.FeaturePlans::MAX_PRICE],
            'plans.*.months' => ['present', 'nullable', 'integer'],
        ]);
        $plans = [];
        foreach ($data['plans'] as $plan) {
            $months = $plan['months'] === null ? null : (int) $plan['months'];
            if (! in_array($months, FeaturePlans::DURATIONS, true)) {
                throw ApiException::badRequest('Pick 1, 3, 6 or 12 months, or unlimited');
            }
            foreach (['price', 'renewalPrice', 'commission', 'renewalCommission'] as $money) {
                $amount = $plan[$money] ?? null;
                if ($amount !== null && in_array($money, ['commission', 'renewalCommission'], true)) {
                    $of = $money === 'commission' ? ($plan['price'] ?? null) : ($plan['renewalPrice'] ?? null);
                    if ($of !== null && $amount > $of) {
                        throw ApiException::badRequest(BusinessFeatures::LABELS[$plan['feature']].': the commission can\'t be more than the price');
                    }
                }
            }
            $plans[$plan['feature']] = [
                'points' => $plan['points'], 'renewalPoints' => $plan['renewalPoints'], 'months' => $months,
                'price' => $plan['price'], 'renewalPrice' => $plan['renewalPrice'] ?? null,
                'commission' => $plan['commission'] ?? null, 'renewalCommission' => $plan['renewalCommission'] ?? null,
            ];
        }
        FeaturePlans::save($plans);

        return $this->index();
    }

    public static function durations(): array
    {
        return array_map(fn ($m) => ['months' => $m, 'label' => FeaturePlans::durationLabel($m)], FeaturePlans::DURATIONS);
    }
}
