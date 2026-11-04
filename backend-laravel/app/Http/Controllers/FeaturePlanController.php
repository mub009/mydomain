<?php

namespace App\Http\Controllers;

use App\Exceptions\ApiException;
use App\Models\PricingGroup;
use App\Models\User;
use App\Support\ApiResponse;
use App\Support\BusinessFeatures;
use App\Support\FeaturePlans;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

// Admin: feature pricing (App\Support\FeaturePlans), per pricing group —
// each feature's points to add it, points to renew it, prices and
// commission in rupees, and how long it lasts — and the groups themselves.
// Dealers are put in a group from their user record; a dealer in none pays
// the default group's prices.
class FeaturePlanController extends Controller
{
    private function group(?string $id): PricingGroup
    {
        if (! $id) {
            return FeaturePlans::defaultGroup();
        }

        return PricingGroup::find($id) ?? throw ApiException::notFound('Pricing group not found');
    }

    /** The groups, the chosen one's plans (the default's when none is given), and the durations. */
    public function index(Request $request)
    {
        $group = $this->group($request->query('groupId'));
        $default = FeaturePlans::defaultGroup();
        $counts = User::where('role', 'DEALER')->selectRaw('pricingGroupId, count(*) as n')->groupBy('pricingGroupId')->pluck('n', 'pricingGroupId');
        // A dealer in no group pays the default group's prices.
        $groups = PricingGroup::orderByDesc('isDefault')->orderBy('name')->get()->map(fn ($g) => [
            'id' => $g->id, 'name' => $g->name, 'isDefault' => $g->isDefault,
            'dealers' => (int) ($counts[$g->id] ?? 0) + ($g->id === $default->id ? (int) ($counts[''] ?? 0) : 0),
        ]);

        return ApiResponse::ok([
            'groups' => $groups,
            'group' => ['id' => $group->id, 'name' => $group->name, 'isDefault' => $group->isDefault],
            'plans' => FeaturePlans::present($group->id),
            'durations' => self::durations(),
        ]);
    }

    public function update(Request $request)
    {
        $data = $request->validate([
            'groupId' => ['sometimes', 'nullable', 'string'],
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
        $group = $this->group($data['groupId'] ?? null);

        $plans = [];
        foreach ($data['plans'] as $plan) {
            $months = $plan['months'] === null ? null : (int) $plan['months'];
            if (! in_array($months, FeaturePlans::DURATIONS, true)) {
                throw ApiException::badRequest('Pick 1, 3, 6 or 12 months, or unlimited');
            }
            foreach (['commission' => 'price', 'renewalCommission' => 'renewalPrice'] as $commission => $price) {
                $amount = $plan[$commission] ?? null;
                $of = $plan[$price] ?? null;
                if ($amount !== null && $of !== null && $amount > $of) {
                    throw ApiException::badRequest(BusinessFeatures::LABELS[$plan['feature']].': the commission can\'t be more than the price');
                }
            }
            $plans[$plan['feature']] = [
                'points' => $plan['points'], 'renewalPoints' => $plan['renewalPoints'], 'months' => $months,
                'price' => $plan['price'], 'renewalPrice' => $plan['renewalPrice'] ?? null,
                'commission' => $plan['commission'] ?? null, 'renewalCommission' => $plan['renewalCommission'] ?? null,
            ];
        }
        FeaturePlans::save($group->id, $plans);
        $request->query->set('groupId', $group->id);

        return $this->index($request);
    }

    // A new group starts as a copy of another's prices (the default's).
    public function createGroup(Request $request)
    {
        $data = $request->validate([
            'name' => ['required', 'string', 'min:1', 'max:80'],
            'copyFrom' => ['sometimes', 'nullable', 'string'],
        ]);
        $name = trim($data['name']);
        if (PricingGroup::whereRaw('lower(name) = ?', [mb_strtolower($name)])->exists()) {
            throw ApiException::conflict('A pricing group with this name already exists');
        }
        $from = $this->group($data['copyFrom'] ?? null);

        $group = DB::transaction(function () use ($name, $from) {
            $group = PricingGroup::create(['name' => $name, 'isDefault' => false]);
            FeaturePlans::copy($from->id, $group->id);

            return $group;
        });

        return ApiResponse::created(['id' => $group->id, 'name' => $group->name, 'isDefault' => false]);
    }

    // Rename, or make it the default (the group dealers in none pay).
    public function updateGroup(Request $request, string $id)
    {
        $group = $this->group($id);
        $data = $request->validate([
            'name' => ['sometimes', 'string', 'min:1', 'max:80'],
            'isDefault' => ['sometimes', 'boolean'],
        ]);
        if (isset($data['name'])) {
            $name = trim($data['name']);
            if (PricingGroup::whereRaw('lower(name) = ?', [mb_strtolower($name)])->whereKeyNot($group->id)->exists()) {
                throw ApiException::conflict('A pricing group with this name already exists');
            }
            $group->update(['name' => $name]);
        }
        if (array_key_exists('isDefault', $data)) {
            if (! $data['isDefault']) {
                throw ApiException::badRequest('Make another group the default instead');
            }
            DB::transaction(function () use ($group) {
                PricingGroup::whereKeyNot($group->id)->update(['isDefault' => false]);
                $group->update(['isDefault' => true]);
            });
        }

        return ApiResponse::ok(['id' => $group->id, 'name' => $group->name, 'isDefault' => $group->fresh()->isDefault]);
    }

    // Its dealers move to the default group. The default can't be deleted.
    public function deleteGroup(string $id)
    {
        $group = $this->group($id);
        if ($group->isDefault) {
            throw ApiException::badRequest('The default group can\'t be deleted. Make another group the default first.');
        }
        $moved = User::where('pricingGroupId', $group->id)->count();
        DB::transaction(function () use ($group) {
            User::where('pricingGroupId', $group->id)->update(['pricingGroupId' => null]);
            $group->delete();
        });

        return ApiResponse::ok(['deleted' => true, 'dealersMoved' => $moved]);
    }

    public static function durations(): array
    {
        return array_map(fn ($m) => ['months' => $m, 'label' => FeaturePlans::durationLabel($m)], FeaturePlans::DURATIONS);
    }
}
