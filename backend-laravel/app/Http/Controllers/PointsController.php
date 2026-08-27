<?php

namespace App\Http\Controllers;

use App\Exceptions\ApiException;
use App\Models\PointTransaction;
use App\Models\User;
use App\Support\ApiResponse;
use App\Support\Pagination;
use App\Support\Points;
use Illuminate\Http\Request;

class PointsController extends Controller
{
    // A dealer's own balance plus how many businesses it can still register.
    public function mine(Request $request)
    {
        $auth = $request->attributes->get('auth');
        $user = User::find($auth['sub']);
        if (! $user) {
            throw ApiException::notFound('User not found');
        }

        $spent = (int) abs(PointTransaction::where('userId', $user->id)->where('type', 'BUSINESS_CREATED')->sum('amount'));

        return ApiResponse::ok([
            'points' => $user->points,
            'pointsPerBusiness' => Points::PER_BUSINESS,
            'businessesRemaining' => intdiv($user->points, Points::PER_BUSINESS),
            'totalSpent' => $spent,
            // Non-dealers are not charged, so their balance is informational only.
            'chargeable' => $user->role === 'DEALER',
        ]);
    }

    public function mineTransactions(Request $request)
    {
        $auth = $request->attributes->get('auth');
        $pagination = Pagination::parse($request->query());
        [$items, $total] = Points::listTransactions($auth['sub'], $pagination);

        return ApiResponse::paginated($items, ['page' => $pagination['page'], 'pageSize' => $pagination['pageSize'], 'total' => $total]);
    }
}
