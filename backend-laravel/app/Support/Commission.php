<?php

namespace App\Support;

use App\Exceptions\ApiException;
use App\Models\CommissionPayment;
use App\Models\PointTransaction;
use App\Models\User;
use Illuminate\Support\Facades\DB;

/**
 * A dealer's commission account with the admin (FeaturePlans):
 * - collected: the rupee price of every feature the dealer sold or renewed;
 * - commission: the admin's share of those sales;
 * - paid: what the admin has recorded receiving (CommissionPayment);
 * - due: commission minus paid, what the dealer still owes.
 * All net of refunds: turning off an unlimited feature, or deleting its
 * business, takes its price and commission back off (Points::refund*).
 */
class Commission
{
    /** Point-transaction types that are sales, renewals or their refunds. */
    public const SALE_TYPES = ['FEATURE_ADDED', 'FEATURE_RENEWED', 'FEATURE_REMOVED', 'BUSINESS_DELETED'];

    public static function summary(string $dealerId): array
    {
        $sales = PointTransaction::where('userId', $dealerId)->whereIn('type', self::SALE_TYPES);
        $collected = (int) (clone $sales)->sum('priceInr');
        $commission = (int) (clone $sales)->sum('commissionInr');
        $paid = (int) CommissionPayment::where('dealerId', $dealerId)->sum('amountInr');

        return [
            'collected' => $collected,
            'commission' => $commission,
            'paid' => $paid,
            'due' => $commission - $paid,
            // What the dealer keeps of what they collected.
            'earnings' => $collected - $commission,
        ];
    }

    /** Sales, renewals and refunds that carry a price or commission, newest first. */
    public static function sales(string $dealerId, array $pagination): array
    {
        $query = PointTransaction::where('point_transactions.userId', $dealerId)
            ->whereIn('point_transactions.type', self::SALE_TYPES)
            ->where(fn ($q) => $q->whereNotNull('point_transactions.priceInr')->orWhereNotNull('point_transactions.commissionInr'));
        $total = (clone $query)->count();
        $items = $query->leftJoin('businesses', 'businesses.id', '=', 'point_transactions.businessId')
            ->orderByDesc('point_transactions.createdAt')
            ->skip($pagination['skip'])->take($pagination['take'])
            ->get(['point_transactions.*', 'businesses.name as businessName'])
            ->map(fn ($t) => [
                'id' => $t->id,
                'date' => $t->createdAt,
                'type' => $t->type,
                'business' => $t->businessName,
                'feature' => $t->feature,
                'featureLabel' => $t->feature ? (BusinessFeatures::LABELS[$t->feature] ?? $t->feature) : null,
                'price' => $t->priceInr,
                'commission' => $t->commissionInr,
                'note' => $t->note,
            ]);

        return [$items, $total];
    }

    public static function payments(string $dealerId, int $limit = 50)
    {
        return CommissionPayment::where('dealerId', $dealerId)->with('receivedBy:id,firstName,lastName')
            ->orderByDesc('paidOn')->orderByDesc('createdAt')->limit($limit)->get()
            ->map(fn ($p) => [
                'id' => $p->id,
                'amount' => $p->amountInr,
                'paidOn' => $p->paidOn?->format('Y-m-d'),
                'note' => $p->note,
                'receivedBy' => $p->receivedBy ? trim($p->receivedBy->firstName.' '.$p->receivedBy->lastName) : null,
            ]);
    }

    /** Admin: records commission received from a dealer; it comes off what they owe. */
    public static function recordPayment(string $adminId, string $dealerId, int $amount, string $paidOn, ?string $note): CommissionPayment
    {
        $dealer = User::find($dealerId);
        if (! $dealer || $dealer->role !== 'DEALER') {
            throw ApiException::badRequest('Commission payments can only be recorded for dealers');
        }

        return DB::transaction(function () use ($adminId, $dealerId, $amount, $paidOn, $note) {
            User::whereKey($dealerId)->lockForUpdate()->first();
            $due = self::summary($dealerId)['due'];
            if ($amount > $due) {
                throw ApiException::badRequest($due > 0
                    ? 'That is more than the dealer owes (₹'.number_format($due).').'
                    : 'This dealer has no commission due.');
            }

            return CommissionPayment::create([
                'dealerId' => $dealerId, 'amountInr' => $amount, 'paidOn' => $paidOn,
                'note' => $note ? trim($note) : null, 'receivedById' => $adminId,
            ]);
        });
    }
}
