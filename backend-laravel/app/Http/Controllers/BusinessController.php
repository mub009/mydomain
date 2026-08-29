<?php

namespace App\Http\Controllers;

use App\Exceptions\ApiException;
use App\Models\Business;
use App\Models\BusinessHours;
use App\Models\BusinessPhoto;
use App\Models\Category;
use App\Models\ReviewQrCode;
use App\Models\Service;
use App\Models\User;
use App\Support\ApiResponse;
use App\Support\Pagination;
use App\Support\Points;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;

class BusinessController extends Controller
{
    private function assertOwnerOrAdmin(array $actor, string $ownerId): void
    {
        if ($actor['role'] === 'ADMIN') {
            return;
        }
        if ($actor['sub'] !== $ownerId) {
            throw ApiException::forbidden('You do not own this business');
        }
    }

    private function businessRules(bool $partial = false): array
    {
        $required = $partial ? 'sometimes' : 'required';

        return [
            'name' => [$required, 'string', 'min:2', 'max:150'],
            'slug' => [$required, 'string', 'min:2', 'max:150', 'regex:/^[a-z0-9-]+$/'],
            'description' => ['nullable', 'string', 'max:2000'],
            'categoryId' => [$required, 'uuid'],
            'email' => ['nullable', 'email'],
            'phone' => [$required, 'string', 'min:7', 'max:20'],
            'website' => ['nullable', 'url'],
            'addressLine1' => [$required, 'string', 'min:1', 'max:200'],
            'addressLine2' => ['nullable', 'string', 'max:200'],
            'city' => [$required, 'string', 'min:1', 'max:100'],
            'state' => [$required, 'string', 'min:1', 'max:50'],
            'postalCode' => [$required, 'string', 'min:1', 'max:20'],
            'country' => ['sometimes', 'string', 'size:2'],
            'latitude' => [$required, 'numeric', 'min:-90', 'max:90'],
            'longitude' => [$required, 'numeric', 'min:-180', 'max:180'],
            'logoUrl' => ['nullable', 'url'],
            'coverImageUrl' => ['nullable', 'url'],
            'owner' => ['sometimes', 'array'],
            'owner.firstName' => ['required_with:owner', 'string', 'min:1', 'max:80'],
            'owner.lastName' => ['required_with:owner', 'string', 'min:1', 'max:80'],
            'owner.email' => ['required_with:owner', 'email'],
            'owner.phone' => ['nullable', 'string', 'min:7', 'max:20'],
            'owner.password' => ['required_with:owner', 'string', 'min:8', 'max:72'],
        ];
    }

    public function store(Request $request)
    {
        $data = $request->validate($this->businessRules());
        $actor = $request->attributes->get('auth');
        $owner = $data['owner'] ?? null;
        unset($data['owner']);
        $data['country'] = $data['country'] ?? 'IN';

        if (! Category::find($data['categoryId'])) {
            throw ApiException::badRequest('Invalid categoryId');
        }

        $isStaff = in_array($actor['role'], ['DEALER', 'ADMIN'], true);
        $initialStatus = $isStaff ? 'PUBLISHED' : 'PENDING_APPROVAL';

        // Dealers spend a point per listing — check up front so we never
        // create an owner account and then reject the request.
        Points::assertHasPointsForBusiness($actor);

        // Plain owners always own their listings. Dealers and admins may
        // instead supply a login for the business's own team; the listing is
        // then assigned to that account so the business can sign in and
        // manage it themselves.
        if (! $owner || ! $isStaff) {
            return DB::transaction(function () use ($data, $actor, $initialStatus, $isStaff) {
                $business = Business::create([
                    ...$data,
                    'ownerId' => $actor['sub'],
                    'createdById' => $actor['sub'],
                    'status' => $initialStatus,
                    'isVerified' => $isStaff,
                ]);
                Points::spendForBusiness($actor, $business->id);

                return ApiResponse::created($business);
            });
        }

        $existing = User::where('email', $owner['email'])->first();
        if ($existing && in_array($existing->role, ['ADMIN', 'DEALER'], true)) {
            throw ApiException::badRequest("This email belongs to a staff account and can't be used as a business login");
        }
        if (! empty($owner['phone']) && (! $existing || $existing->phone !== $owner['phone'])) {
            $phoneTaken = User::where('phone', $owner['phone'])->first();
            if ($phoneTaken && $phoneTaken->id !== $existing?->id) {
                throw ApiException::conflict('That phone number is already registered to another account');
            }
        }

        $result = DB::transaction(function () use ($data, $actor, $initialStatus, $isStaff, $owner, $existing) {
            $ownerRecord = $existing;

            if ($ownerRecord) {
                // Reuse the account; promote a plain customer to a business owner.
                if ($ownerRecord->role === 'CUSTOMER') {
                    $ownerRecord->update(['role' => 'BUSINESS_OWNER']);
                }
            } else {
                $ownerRecord = User::create([
                    'email' => $owner['email'],
                    'phone' => $owner['phone'] ?? null,
                    'passwordHash' => Hash::make($owner['password']),
                    'firstName' => $owner['firstName'],
                    'lastName' => $owner['lastName'],
                    'role' => 'BUSINESS_OWNER',
                    'status' => 'ACTIVE',
                    // Remember who set this account up so the dealer can
                    // manage it later (e.g. reset the password on the
                    // owner's behalf).
                    'createdById' => $actor['sub'],
                ]);
            }

            $business = Business::create([
                ...$data,
                'ownerId' => $ownerRecord->id,
                'createdById' => $actor['sub'],
                'status' => $initialStatus,
                'isVerified' => $isStaff,
            ]);

            Points::spendForBusiness($actor, $business->id);

            $payload = $business->toArray();
            $payload['ownerAccount'] = ['email' => $ownerRecord->email, 'created' => ! $existing];

            return $payload;
        });

        // A welcome email with the new login (when a fresh account was
        // created) would be sent here — mailer is not part of this
        // core-module pass, see backend-laravel/README.md.

        return ApiResponse::created($result);
    }

    public function index(Request $request)
    {
        $request->validate([
            'categoryId' => ['sometimes', 'nullable', 'uuid'],
            'city' => ['sometimes', 'nullable', 'string'],
        ]);
        $pagination = Pagination::parse($request->query());

        $query = Business::where('status', 'PUBLISHED');
        if ($categoryId = $request->query('categoryId')) {
            $query->where('categoryId', $categoryId);
        }
        if ($city = $request->query('city')) {
            $query->where('city', $city);
        }

        $total = (clone $query)->count();
        $items = $query->orderByDesc('avgRating')->orderByDesc('reviewCount')
            ->skip($pagination['skip'])->take($pagination['take'])
            ->with(['category', 'photos' => fn ($q) => $q->orderBy('sortOrder')->limit(1)])
            ->get();

        return ApiResponse::paginated($items, ['page' => $pagination['page'], 'pageSize' => $pagination['pageSize'], 'total' => $total]);
    }

    public function mine(Request $request)
    {
        $actor = $request->attributes->get('auth');
        $pagination = Pagination::parse($request->query());

        $query = Business::where('ownerId', $actor['sub']);
        $total = (clone $query)->count();
        $items = $query->orderByDesc('createdAt')
            ->skip($pagination['skip'])->take($pagination['take'])
            ->with('category')->get();

        return ApiResponse::paginated($items, ['page' => $pagination['page'], 'pageSize' => $pagination['pageSize'], 'total' => $total]);
    }

    public function show(string $slug)
    {
        $business = Business::where('slug', $slug)->with([
            'category',
            'photos' => fn ($q) => $q->orderBy('sortOrder'),
            'hours' => fn ($q) => $q->orderBy('dayOfWeek'),
            'services' => fn ($q) => $q->where('isActive', true),
            'reviews' => fn ($q) => $q->orderByDesc('createdAt')->limit(10)->with(['user:id,firstName,lastName,avatarUrl']),
        ])->first();

        if (! $business) {
            throw ApiException::notFound('Business not found');
        }

        $business->increment('viewCount');

        return ApiResponse::ok($business);
    }

    public function manage(Request $request, string $id)
    {
        $actor = $request->attributes->get('auth');
        $business = Business::with([
            'category',
            'photos' => fn ($q) => $q->orderBy('sortOrder'),
            'hours' => fn ($q) => $q->orderBy('dayOfWeek'),
            'services' => fn ($q) => $q->orderBy('createdAt'),
        ])->withCount(['reviews'])->find($id);

        if (! $business) {
            throw ApiException::notFound('Business not found');
        }
        $this->assertOwnerOrAdmin($actor, $business->ownerId);

        return ApiResponse::ok($business);
    }

    private function findOrFail(string $id): Business
    {
        $business = Business::find($id);
        if (! $business) {
            throw ApiException::notFound('Business not found');
        }

        return $business;
    }

    public function update(Request $request, string $id)
    {
        $actor = $request->attributes->get('auth');
        $business = $this->findOrFail($id);
        $this->assertOwnerOrAdmin($actor, $business->ownerId);

        $data = $request->validate($this->businessRulesForUpdate());
        $business->update($data);

        return ApiResponse::ok($business);
    }

    private function businessRulesForUpdate(): array
    {
        $rules = $this->businessRules(partial: true);
        unset($rules['owner'], $rules['owner.firstName'], $rules['owner.lastName'], $rules['owner.email'], $rules['owner.phone'], $rules['owner.password']);

        return $rules;
    }

    public function destroy(Request $request, string $id)
    {
        $actor = $request->attributes->get('auth');
        $business = $this->findOrFail($id);
        $this->assertOwnerOrAdmin($actor, $business->ownerId);

        // Return any issued QR boards to the unassigned pool first. Without
        // this the board keeps its "assigned" status while losing the
        // business behind it, leaving a printed board that can neither be
        // scanned nor re-claimed.
        DB::transaction(function () use ($business, $id) {
            ReviewQrCode::where('businessId', $id)->update([
                'businessId' => null, 'status' => 'UNASSIGNED', 'assignedAt' => null, 'assignedById' => null, 'channel' => null,
            ]);
            $business->delete();
        });

        return ApiResponse::noContent();
    }

    public function submit(Request $request, string $id)
    {
        $actor = $request->attributes->get('auth');
        $business = $this->findOrFail($id);
        $this->assertOwnerOrAdmin($actor, $business->ownerId);
        $business->update(['status' => 'PENDING_APPROVAL']);

        return ApiResponse::ok($business);
    }

    public function addPhoto(Request $request, string $id)
    {
        $actor = $request->attributes->get('auth');
        $business = $this->findOrFail($id);
        $this->assertOwnerOrAdmin($actor, $business->ownerId);

        $data = $request->validate([
            'url' => ['required', 'url'],
            'caption' => ['nullable', 'string', 'max:200'],
            'sortOrder' => ['sometimes', 'integer', 'min:0'],
        ]);
        $data['sortOrder'] = $data['sortOrder'] ?? 0;

        $photo = BusinessPhoto::create([...$data, 'businessId' => $id]);

        return ApiResponse::created($photo);
    }

    public function removePhoto(Request $request, string $id, string $photoId)
    {
        $actor = $request->attributes->get('auth');
        $business = $this->findOrFail($id);
        $this->assertOwnerOrAdmin($actor, $business->ownerId);
        BusinessPhoto::where('id', $photoId)->delete();

        return ApiResponse::noContent();
    }

    public function setHours(Request $request, string $id)
    {
        $actor = $request->attributes->get('auth');
        $business = $this->findOrFail($id);
        $this->assertOwnerOrAdmin($actor, $business->ownerId);

        $data = $request->validate([
            'hours' => ['required', 'array', 'min:1', 'max:7'],
            'hours.*.dayOfWeek' => ['required', 'integer', 'min:0', 'max:6'],
            'hours.*.openTime' => ['required', 'regex:/^\d{2}:\d{2}$/'],
            'hours.*.closeTime' => ['required', 'regex:/^\d{2}:\d{2}$/'],
            'hours.*.isClosed' => ['sometimes', 'boolean'],
        ]);

        DB::transaction(function () use ($id, $data) {
            BusinessHours::where('businessId', $id)->delete();
            foreach ($data['hours'] as $hour) {
                BusinessHours::create([
                    ...$hour,
                    'isClosed' => $hour['isClosed'] ?? false,
                    'businessId' => $id,
                ]);
            }
        });

        return ApiResponse::ok(BusinessHours::where('businessId', $id)->orderBy('dayOfWeek')->get());
    }

    public function addService(Request $request, string $id)
    {
        $actor = $request->attributes->get('auth');
        $business = $this->findOrFail($id);
        $this->assertOwnerOrAdmin($actor, $business->ownerId);

        $data = $request->validate([
            'name' => ['required', 'string', 'min:1', 'max:150'],
            'description' => ['nullable', 'string', 'max:1000'],
            'priceCents' => ['required', 'integer', 'min:0'],
            'currency' => ['sometimes', 'string', 'size:3'],
            'durationMins' => ['sometimes', 'integer', 'min:5', 'max:1440'],
        ]);
        $data['currency'] = $data['currency'] ?? 'INR';
        $data['durationMins'] = $data['durationMins'] ?? 60;
        $data['isActive'] = true;

        return ApiResponse::created(Service::create([...$data, 'businessId' => $id]));
    }

    public function updateService(Request $request, string $id, string $serviceId)
    {
        $actor = $request->attributes->get('auth');
        $business = $this->findOrFail($id);
        $this->assertOwnerOrAdmin($actor, $business->ownerId);

        $data = $request->validate([
            'name' => ['sometimes', 'string', 'min:1', 'max:150'],
            'description' => ['nullable', 'string', 'max:1000'],
            'priceCents' => ['sometimes', 'integer', 'min:0'],
            'currency' => ['sometimes', 'string', 'size:3'],
            'durationMins' => ['sometimes', 'integer', 'min:5', 'max:1440'],
            'isActive' => ['sometimes', 'boolean'],
        ]);

        $service = Service::findOrFail($serviceId);
        $service->update($data);

        return ApiResponse::ok($service);
    }

    public function deleteService(Request $request, string $id, string $serviceId)
    {
        $actor = $request->attributes->get('auth');
        $business = $this->findOrFail($id);
        $this->assertOwnerOrAdmin($actor, $business->ownerId);
        Service::where('id', $serviceId)->delete();

        return ApiResponse::noContent();
    }
}
