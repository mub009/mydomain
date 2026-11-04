<?php

namespace App\Http\Controllers;

use App\Exceptions\ApiException;
use App\Models\CommissionPayment;
use App\Models\User;
use App\Support\ApiResponse;
use App\Support\Commission;
use App\Support\Pagination;
use Illuminate\Http\Request;

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
