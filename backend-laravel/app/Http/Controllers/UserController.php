<?php

namespace App\Http\Controllers;

use App\Exceptions\ApiException;
use App\Models\RefreshToken;
use App\Models\User;
use App\Support\ApiResponse;
use App\Support\Pagination;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;

class UserController extends Controller
{
    // Reset a user's password on their behalf.
    // - Admins may reset anyone's password.
    // - Dealers may only reset accounts they created themselves (the business
    //   logins they hand out), never staff accounts.
    // All of the target's refresh tokens are revoked so old sessions sign out.
    public function resetPassword(Request $request, string $id)
    {
        $data = $request->validate(['password' => ['required', 'string', 'min:8', 'max:72']]);
        $auth = $request->attributes->get('auth');

        $target = User::find($id);
        if (! $target) {
            throw ApiException::notFound('User not found');
        }

        if ($auth['role'] === 'DEALER') {
            $isStaff = in_array($target->role, ['ADMIN', 'DEALER'], true);
            if ($isStaff || $target->createdById !== $auth['sub']) {
                throw ApiException::forbidden('You can only reset passwords for accounts you created');
            }
        } elseif ($auth['role'] !== 'ADMIN') {
            throw ApiException::forbidden();
        }

        $target->update(['passwordHash' => Hash::make($data['password'])]);
        RefreshToken::where('userId', $target->id)->whereNull('revokedAt')->update(['revokedAt' => now()]);

        return ApiResponse::ok([
            'id' => $target->id,
            'email' => $target->email,
            'firstName' => $target->firstName,
            'lastName' => $target->lastName,
        ]);
    }

    // The accounts this staff member created (a dealer's handed-out business
    // logins), so they can be listed and managed from the dashboard.
    public function listCreated(Request $request)
    {
        $auth = $request->attributes->get('auth');
        $pagination = Pagination::parse($request->query());

        $query = User::where('createdById', $auth['sub']);
        if ($search = $request->query('search')) {
            $query->where(function ($q) use ($search) {
                $q->where('email', 'like', "%{$search}%")
                    ->orWhere('firstName', 'like', "%{$search}%")
                    ->orWhere('lastName', 'like', "%{$search}%");
            });
        }

        $total = (clone $query)->count();
        $items = $query->orderByDesc('createdAt')
            ->skip($pagination['skip'])->take($pagination['take'])
            ->withCount('businesses')
            ->with(['businesses' => fn ($q) => $q->orderByDesc('createdAt')->select('id', 'ownerId', 'name', 'slug', 'status')])
            ->get(['id', 'email', 'phone', 'firstName', 'lastName', 'role', 'status', 'createdAt'])
            ->map(fn ($u) => [
                'id' => $u->id, 'email' => $u->email, 'phone' => $u->phone,
                'firstName' => $u->firstName, 'lastName' => $u->lastName,
                'role' => $u->role, 'status' => $u->status, 'createdAt' => $u->createdAt,
                '_count' => ['businesses' => $u->businesses_count],
                'businesses' => $u->businesses->map(fn ($b) => [
                    'id' => $b->id, 'name' => $b->name, 'slug' => $b->slug, 'status' => $b->status,
                ]),
            ]);

        return ApiResponse::paginated($items, ['page' => $pagination['page'], 'pageSize' => $pagination['pageSize'], 'total' => $total]);
    }
}
