<?php

namespace App\Http\Controllers;

use App\Exceptions\ApiException;
use App\Models\CommissionPayment;
use App\Models\User;
use App\Support\ApiResponse;
use App\Support\Commission;
use App\Support\Pagination;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

// The commission report (App\Support\Commission): for a dealer, their own;
// for the admin, any dealer's, plus recording commission received, which
// comes off what the dealer owes.
class CommissionController extends Controller
{
    private function report(Request $request, string $dealerId)
    {
        $pagination = Pagination::parse($request->query());
        [$sales, $total] = Commission::sales($dealerId, $pagination);

        return ApiResponse::ok([
            'summary' => Commission::summary($dealerId),
            'sales' => $sales,
            'salesMeta' => ['page' => $pagination['page'], 'pageSize' => $pagination['pageSize'], 'total' => $total, 'totalPages' => (int) max(1, ceil($total / max(1, $pagination['pageSize'])))],
            'payments' => Commission::payments($dealerId),
        ]);
    }

    public function mine(Request $request)
    {
        $auth = $request->attributes->get('auth');
        if ($auth['role'] !== 'DEALER') {
            throw ApiException::forbidden('Only dealers have a commission report');
        }

        return $this->report($request, $auth['sub']);
    }

    public function forDealer(Request $request, string $id)
    {
        $dealer = User::find($id);
        if (! $dealer || $dealer->role !== 'DEALER') {
            throw ApiException::notFound('Dealer not found');
        }

        return $this->report($request, $dealer->id);
    }

    // Admin: every dealer's collected, commission, paid and due, with totals
    // across all dealers and the latest payments. ?search, ?due=1 (only
    // dealers who owe), ?sort=due|commission|collected|name, ?page.
    public function adminIndex(Request $request)
    {
        $pagination = Pagination::parse($request->query());
        $sales = fn (string $column) => \App\Models\PointTransaction::query()
            ->selectRaw("coalesce(sum({$column}), 0)")
            ->whereColumn('point_transactions.userId', 'users.id')
            ->whereIn('type', Commission::SALE_TYPES);
        $paid = CommissionPayment::query()->selectRaw('coalesce(sum(amountInr), 0)')->whereColumn('commission_payments.dealerId', 'users.id');

        $base = User::query()->where('role', 'DEALER')
            ->select(['users.id', 'users.firstName', 'users.lastName', 'users.phone', 'users.email'])
            ->selectSub($sales('priceInr'), 'collected')
            ->selectSub($sales('commissionInr'), 'commission')
            ->selectSub($paid, 'paid');
        if ($search = trim((string) $request->query('search'))) {
            $like = '%'.str_replace(['%', '_'], ['\\%', '\\_'], $search).'%';
            $base->where(fn ($q) => $q->where('firstName', 'like', $like)->orWhere('lastName', 'like', $like)
                ->orWhere('phone', 'like', $like)->orWhere('email', 'like', $like));
        }
        // Wrapped so due can be filtered and sorted on.
        $rows = DB::query()->fromSub($base, 'd')->selectRaw('d.*, (d.commission - d.paid) as due');
        if ($request->boolean('due')) {
            $rows->whereRaw('(d.commission - d.paid) > 0');
        }
        $sort = in_array($request->query('sort'), ['due', 'commission', 'collected', 'name'], true) ? $request->query('sort') : 'due';
        $sort === 'name' ? $rows->orderBy('d.firstName')->orderBy('d.lastName') : $rows->orderByDesc($sort)->orderBy('d.firstName');

        $total = (clone $rows)->count();
        $dealers = $rows->skip($pagination['skip'])->take($pagination['take'])->get()->map(fn ($d) => [
            'id' => $d->id, 'firstName' => $d->firstName, 'lastName' => $d->lastName, 'phone' => $d->phone, 'email' => $d->email,
            'collected' => (int) $d->collected, 'commission' => (int) $d->commission, 'paid' => (int) $d->paid, 'due' => (int) $d->due,
        ]);

        $dealerIds = User::where('role', 'DEALER')->select('id');
        $allCommission = (int) \App\Models\PointTransaction::whereIn('userId', $dealerIds)->whereIn('type', Commission::SALE_TYPES)->sum('commissionInr');
        $allPaid = (int) CommissionPayment::whereIn('dealerId', $dealerIds)->sum('amountInr');
        $totals = [
            'collected' => (int) \App\Models\PointTransaction::whereIn('userId', $dealerIds)->whereIn('type', Commission::SALE_TYPES)->sum('priceInr'),
            'commission' => $allCommission,
            'paid' => $allPaid,
            'due' => $allCommission - $allPaid,
            'paidThisMonth' => (int) CommissionPayment::where('paidOn', '>=', now()->startOfMonth()->toDateString())->sum('amountInr'),
        ];

        $recent = CommissionPayment::with(['receivedBy:id,firstName,lastName'])
            ->join('users', 'users.id', '=', 'commission_payments.dealerId')
            ->orderByDesc('commission_payments.paidOn')->orderByDesc('commission_payments.createdAt')->limit(10)
            ->get(['commission_payments.*', 'users.firstName as dealerFirstName', 'users.lastName as dealerLastName'])
            ->map(fn ($p) => [
                'id' => $p->id, 'amount' => $p->amountInr, 'paidOn' => $p->paidOn?->format('Y-m-d'), 'note' => $p->note,
                'dealer' => trim($p->dealerFirstName.' '.$p->dealerLastName), 'dealerId' => $p->dealerId,
            ]);

        return ApiResponse::ok([
            'totals' => $totals,
            'dealers' => $dealers,
            'meta' => ['page' => $pagination['page'], 'pageSize' => $pagination['pageSize'], 'total' => $total, 'totalPages' => (int) max(1, ceil($total / max(1, $pagination['pageSize'])))],
            'recentPayments' => $recent,
        ]);
    }

    public function storePayment(Request $request, string $id)
    {
        $data = $request->validate([
            'amount' => ['required', 'integer', 'min:1', 'max:100000000'],
            'paidOn' => ['sometimes', 'nullable', 'date', 'before_or_equal:today'],
            'note' => ['sometimes', 'nullable', 'string', 'max:300'],
        ]);
        $payment = Commission::recordPayment(
            $request->attributes->get('auth')['sub'], $id, $data['amount'],
            $data['paidOn'] ?? now()->toDateString(), $data['note'] ?? null,
        );

        return ApiResponse::created(['payment' => $payment, 'summary' => Commission::summary($id)]);
    }

    // For a payment recorded by mistake: what it covered is owed again.
    public function deletePayment(string $id)
    {
        $payment = CommissionPayment::find($id) ?? throw ApiException::notFound('Payment not found');
        $payment->delete();

        return ApiResponse::ok(['deleted' => true, 'summary' => Commission::summary($payment->dealerId)]);
    }
}
