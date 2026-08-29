<?php

namespace App\Http\Controllers;

use App\Exceptions\ApiException;
use App\Models\Business;
use App\Models\Category;
use App\Models\PointTransaction;
use App\Models\Review;
use App\Models\User;
use App\Support\ApiResponse;
use App\Support\Pagination;
use App\Support\Points;
use App\Support\Privileges;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;

class AdminController extends Controller
{
    private const USER_PUBLIC_COLUMNS = [
        'id', 'email', 'phone', 'firstName', 'lastName', 'role', 'status',
        'privileges', 'points', 'avatarUrl', 'createdAt',
    ];

    // ---------------------------------------------------------------
    // Platform stats / reports
    // ---------------------------------------------------------------

    public function stats()
    {
        return ApiResponse::ok([
            'userCount' => User::count(),
            'dealerCount' => User::where('role', 'DEALER')->count(),
            'businessCount' => Business::count(),
            'publishedBusinessCount' => Business::where('status', 'PUBLISHED')->count(),
            'pendingBusinessCount' => Business::where('status', 'PENDING_APPROVAL')->count(),
            'reviewCount' => Review::count(),
            // Leads, bookings, and B2B RFQs are not part of this Laravel
            // port yet (still Node-only) — reported as 0 rather than
            // querying tables that don't exist here.
            'leadCount' => 0,
            'bookingCount' => 0,
            'openRfqCount' => 0,
        ]);
    }

    // Staff registrations report: which dealers (and admins) registered
    // listings and how many, most active first. Owners registering their
    // own business are not part of this report.
    public function businessCreatorsReport()
    {
        $startOfToday = now()->startOfDay();

        $groups = Business::selectRaw('createdById, COUNT(*) as cnt')->groupBy('createdById')->get();
        $publishedGroups = Business::where('status', 'PUBLISHED')->selectRaw('createdById, COUNT(*) as cnt')->groupBy('createdById')->get()->pluck('cnt', 'createdById');
        $todayGroups = Business::where('createdAt', '>=', $startOfToday)->selectRaw('createdById, COUNT(*) as cnt')->groupBy('createdById')->get()->pluck('cnt', 'createdById');

        $creatorIds = $groups->pluck('createdById')->filter()->values();
        $creators = User::whereIn('id', $creatorIds)->whereIn('role', ['DEALER', 'ADMIN'])
            ->get(['id', 'firstName', 'lastName', 'email', 'role'])->keyBy('id');

        $items = $groups->filter(fn ($g) => $g->createdById && $creators->has($g->createdById))
            ->map(fn ($g) => [
                'creator' => $creators->get($g->createdById),
                'businessCount' => (int) $g->cnt,
                'publishedCount' => (int) ($publishedGroups[$g->createdById] ?? 0),
                'todayCount' => (int) ($todayGroups[$g->createdById] ?? 0),
            ])
            ->sortByDesc('businessCount')
            ->values();

        return ApiResponse::ok([
            'items' => $items,
            'totalBusinesses' => $groups->sum('cnt'),
            'dealerBusinessCount' => $items->filter(fn ($i) => $i['creator']->role === 'DEALER')->sum('businessCount'),
            'registeredToday' => $todayGroups->sum(),
            'dealerRegisteredToday' => $items->sum(fn ($i) => $i['creator']->role === 'DEALER' ? $i['todayCount'] : 0),
        ]);
    }

    // ---------------------------------------------------------------
    // Users
    // ---------------------------------------------------------------

    public function listUsers(Request $request)
    {
        $request->validate([
            'role' => ['sometimes', 'nullable', 'in:CUSTOMER,BUSINESS_OWNER,DEALER,ADMIN'],
            'search' => ['sometimes', 'nullable', 'string', 'max:150'],
        ]);
        $pagination = Pagination::parse($request->query());

        $query = User::query();
        if ($role = $request->query('role')) {
            $query->where('role', $role);
        }
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
            ->get(self::USER_PUBLIC_COLUMNS)
            ->map(fn ($u) => [...$u->only(self::USER_PUBLIC_COLUMNS), '_count' => ['businesses' => $u->businesses_count]]);

        return ApiResponse::paginated($items, ['page' => $pagination['page'], 'pageSize' => $pagination['pageSize'], 'total' => $total]);
    }

    public function createUser(Request $request)
    {
        $data = $request->validate([
            'email' => ['required', 'email'],
            'password' => ['required', 'string', 'min:8', 'max:72'],
            'firstName' => ['required', 'string', 'min:1', 'max:80'],
            'lastName' => ['required', 'string', 'min:1', 'max:80'],
            'phone' => ['nullable', 'string', 'min:7', 'max:20'],
            'role' => ['sometimes', 'in:CUSTOMER,BUSINESS_OWNER,DEALER,ADMIN'],
            'privileges' => ['sometimes', 'array'],
            'privileges.*' => ['in:'.implode(',', Privileges::ALL)],
        ]);
        $role = $data['role'] ?? 'DEALER';

        if (User::where('email', $data['email'])->exists()) {
            throw ApiException::conflict('A user with this email already exists');
        }

        // Only dealers carry a privilege list; default it if none was provided.
        $privileges = $role === 'DEALER' ? Privileges::normalize($data['privileges'] ?? Privileges::DEFAULT_DEALER) : null;

        $actor = $request->attributes->get('auth');
        $user = User::create([
            'email' => $data['email'],
            'passwordHash' => Hash::make($data['password']),
            'firstName' => $data['firstName'],
            'lastName' => $data['lastName'],
            'phone' => $data['phone'] ?? null,
            'role' => $role,
            'status' => 'ACTIVE',
            'privileges' => $privileges,
            'points' => 0,
            'createdById' => $actor['sub'],
        ]);

        return ApiResponse::created($user->only(self::USER_PUBLIC_COLUMNS));
    }

    public function updateUser(Request $request, string $id)
    {
        $data = $request->validate([
            'firstName' => ['sometimes', 'string', 'min:1', 'max:80'],
            'lastName' => ['sometimes', 'string', 'min:1', 'max:80'],
            'email' => ['sometimes', 'email'],
            'phone' => ['sometimes', 'string', 'min:7', 'max:20'],
            'role' => ['sometimes', 'in:CUSTOMER,BUSINESS_OWNER,DEALER,ADMIN'],
            'status' => ['sometimes', 'in:ACTIVE,SUSPENDED,PENDING_VERIFICATION'],
            'privileges' => ['sometimes', 'array'],
            'privileges.*' => ['in:'.implode(',', Privileges::ALL)],
        ]);

        $user = User::find($id);
        if (! $user) {
            throw ApiException::notFound('User not found');
        }

        // Guard against removing the last remaining admin.
        if ($user->role === 'ADMIN' && isset($data['role']) && $data['role'] !== 'ADMIN') {
            if (User::where('role', 'ADMIN')->count() <= 1) {
                throw ApiException::badRequest('Cannot change the role of the last remaining admin');
            }
        }

        $privileges = $data['privileges'] ?? null;
        unset($data['privileges']);

        // Keep privileges consistent with the effective role: dealers get a
        // normalized list, everyone else has it cleared.
        $effectiveRole = $data['role'] ?? $user->role;
        if ($effectiveRole === 'DEALER') {
            if ($privileges !== null) {
                $data['privileges'] = Privileges::normalize($privileges);
            }
        } else {
            $data['privileges'] = null;
        }

        $user->update($data);

        return ApiResponse::ok($user->only(self::USER_PUBLIC_COLUMNS));
    }

    // ---------------------------------------------------------------
    // Points (dealer balances)
    // ---------------------------------------------------------------

    public function adjustPoints(Request $request, string $id)
    {
        $data = $request->validate([
            'amount' => ['required', 'integer', 'min:-1000', 'max:1000', 'not_in:0'],
            'note' => ['nullable', 'string', 'max:300'],
        ]);
        $actor = $request->attributes->get('auth');

        $user = Points::adjust($actor['sub'], $id, $data['amount'], $data['note'] ?? null);

        return ApiResponse::ok($user->only(['id', 'email', 'firstName', 'lastName', 'role', 'points']));
    }

    public function userTransactions(Request $request, string $id)
    {
        $pagination = Pagination::parse($request->query());
        [$items, $total] = Points::listTransactions($id, $pagination);

        return ApiResponse::paginated($items, ['page' => $pagination['page'], 'pageSize' => $pagination['pageSize'], 'total' => $total]);
    }

    // ---------------------------------------------------------------
    // Businesses (admin-wide)
    // ---------------------------------------------------------------

    public function listBusinesses(Request $request)
    {
        $request->validate([
            'status' => ['sometimes', 'nullable', 'string', 'max:30'],
            'search' => ['sometimes', 'nullable', 'string', 'max:150'],
        ]);
        $pagination = Pagination::parse($request->query());

        $query = Business::query();
        if ($status = $request->query('status')) {
            $query->where('status', $status);
        }
        if ($search = $request->query('search')) {
            $query->where(fn ($q) => $q->where('name', 'like', "%{$search}%")->orWhere('city', 'like', "%{$search}%"));
        }

        $total = (clone $query)->count();
        $items = $query->orderByDesc('createdAt')
            ->skip($pagination['skip'])->take($pagination['take'])
            ->with(['category', 'owner:id,email,firstName,lastName,role'])
            ->get();

        return ApiResponse::paginated($items, ['page' => $pagination['page'], 'pageSize' => $pagination['pageSize'], 'total' => $total]);
    }

    public function listPendingBusinesses(Request $request)
    {
        $pagination = Pagination::parse($request->query());

        $query = Business::where('status', 'PENDING_APPROVAL');
        $total = (clone $query)->count();
        $items = $query->orderBy('createdAt')
            ->skip($pagination['skip'])->take($pagination['take'])
            ->with(['category', 'owner:id,email,firstName,lastName'])
            ->get();

        return ApiResponse::paginated($items, ['page' => $pagination['page'], 'pageSize' => $pagination['pageSize'], 'total' => $total]);
    }

    private function findBusinessOrFail(string $id): Business
    {
        $business = Business::find($id);
        if (! $business) {
            throw ApiException::notFound('Business not found');
        }

        return $business;
    }

    public function updateBusiness(Request $request, string $id)
    {
        $business = $this->findBusinessOrFail($id);

        $data = $request->validate([
            'name' => ['sometimes', 'string', 'min:2', 'max:150'],
            'description' => ['sometimes', 'nullable', 'string', 'max:2000'],
            'categoryId' => ['sometimes', 'uuid'],
            'email' => ['sometimes', 'nullable', 'email'],
            'phone' => ['sometimes', 'string', 'min:7', 'max:20'],
            'website' => ['sometimes', 'nullable', 'url'],
            'addressLine1' => ['sometimes', 'string', 'min:1', 'max:200'],
            'addressLine2' => ['sometimes', 'nullable', 'string', 'max:200'],
            'city' => ['sometimes', 'string', 'min:1', 'max:100'],
            'state' => ['sometimes', 'string', 'min:1', 'max:50'],
            'postalCode' => ['sometimes', 'string', 'min:1', 'max:20'],
            'latitude' => ['sometimes', 'numeric', 'min:-90', 'max:90'],
            'longitude' => ['sometimes', 'numeric', 'min:-180', 'max:180'],
            'isVerified' => ['sometimes', 'boolean'],
            'status' => ['sometimes', 'in:DRAFT,PENDING_APPROVAL,PUBLISHED,SUSPENDED'],
        ]);

        if (isset($data['categoryId']) && ! Category::find($data['categoryId'])) {
            throw ApiException::badRequest('Invalid categoryId');
        }

        $business->update($data);

        return ApiResponse::ok($business);
    }

    public function approveBusiness(string $id)
    {
        $business = $this->findBusinessOrFail($id);
        $business->update(['status' => 'PUBLISHED', 'isVerified' => true]);

        return ApiResponse::ok($business);
    }

    public function rejectBusiness(string $id)
    {
        $business = $this->findBusinessOrFail($id);
        $business->update(['status' => 'DRAFT']);

        return ApiResponse::ok($business);
    }

    public function suspendBusiness(string $id)
    {
        $business = $this->findBusinessOrFail($id);
        $business->update(['status' => 'SUSPENDED']);

        return ApiResponse::ok($business);
    }

    public function reassignBusiness(Request $request, string $id)
    {
        $data = $request->validate(['ownerId' => ['required', 'uuid']]);
        $business = $this->findBusinessOrFail($id);

        $newOwner = User::find($data['ownerId']);
        if (! $newOwner) {
            throw ApiException::notFound('Target user not found');
        }
        if (! in_array($newOwner->role, ['BUSINESS_OWNER', 'DEALER', 'ADMIN'], true)) {
            throw ApiException::badRequest('New owner must be a business owner, dealer, or admin');
        }

        $business->update(['ownerId' => $data['ownerId']]);
        $business->load('owner:id,email,firstName,lastName,role');

        return ApiResponse::ok($business);
    }
}
