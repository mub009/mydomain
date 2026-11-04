<?php

namespace App\Http\Controllers;

use App\Exceptions\ApiException;
use App\Support\ApiResponse;
use App\Support\BusinessFeatures;
use App\Support\FeaturePlans;
use Illuminate\Http\Request;

// Admin: feature pricing (App\Support\FeaturePlans) — each feature's cost in
// points and how long it lasts before the dealer has to renew it.
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
            'plans.*.months' => ['present', 'nullable', 'integer'],
        ]);
        $plans = [];
        foreach ($data['plans'] as $plan) {
            $months = $plan['months'] === null ? null : (int) $plan['months'];
            if (! in_array($months, FeaturePlans::DURATIONS, true)) {
                throw ApiException::badRequest('Pick 1, 3, 6 or 12 months, or unlimited');
            }
            $plans[$plan['feature']] = ['points' => $plan['points'], 'months' => $months];
        }
        FeaturePlans::save($plans);

        return $this->index();
    }

    public static function durations(): array
    {
        return array_map(fn ($m) => ['months' => $m, 'label' => FeaturePlans::durationLabel($m)], FeaturePlans::DURATIONS);
    }
}
