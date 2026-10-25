<?php

namespace App\Http\Controllers;

use App\Exceptions\ApiException;
use App\Models\Business;
use App\Models\BusinessHours;
use App\Models\BusinessPhoto;
use App\Models\BusinessSite;
use App\Models\Category;
use App\Models\Product;
use App\Models\ReviewQrCode;
use App\Models\Service;
use App\Models\User;
use App\Support\ApiResponse;
use App\Support\BusinessAccess;
use App\Support\Pagination;
use App\Support\Points;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;

class BusinessController extends Controller
{
    private function assertOwnerOrAdmin(array $actor, Business $business): void
    {
        BusinessAccess::assertCanManage($actor, $business);
    }

    private function businessRules(bool $partial = false): array
    {
        $required = $partial ? 'sometimes' : 'required';

        return [
            'name' => [$required, 'string', 'min:2', 'max:150'],
            // Optional on create — generated from the name when left out.
            'slug' => ['sometimes', 'string', 'min:2', 'max:150', 'regex:/^[a-z0-9-]+$/'],
            'description' => ['nullable', 'string', 'max:2000'],
            'categoryId' => [$required, 'uuid'],
            // A label for discovery, not a different feature set — B2B
            // businesses are ordinary listings, just filterable by this.
            'businessType' => ['sometimes', 'nullable', 'in:B2C,B2B'],
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
            ...self::ownerRules('sometimes'),
        ];
    }

    private function uniqueSlug(string $value): string
    {
        $base = trim(preg_replace('/[^a-z0-9]+/', '-', strtolower($value)), '-');
        $base = substr($base, 0, 140) ?: 'business';
        for ($attempt = 0; $attempt < 50; $attempt++) {
            $candidate = $attempt === 0 ? $base : "{$base}-".($attempt + 1);
            if (! Business::where('slug', $candidate)->exists()) {
                return $candidate;
            }
        }

        return "{$base}-".substr(bin2hex(random_bytes(3)), 0, 6);
    }

    // The login a dealer or admin can set up for a business's own team: an
    // email or a mobile number as the username, and a password.
    private static function ownerRules(string $presence): array
    {
        return [
            'owner' => [$presence, 'array'],
            'owner.firstName' => ['required_with:owner', 'string', 'min:1', 'max:80'],
            'owner.lastName' => ['required_with:owner', 'string', 'min:1', 'max:80'],
            'owner.username' => ['required_with:owner', 'string', 'max:255'],
            'owner.phone' => ['nullable', 'string', 'min:7', 'max:20'],
            'owner.password' => ['required_with:owner', 'string', 'min:8', 'max:72'],
        ];
    }

    // Works out the email/phone the username stands for and checks it can
    // be used, before anything is written. An existing customer or owner
    // account is reused; a staff account never is.
    private function checkOwnerLogin(array $owner): array
    {
        $username = trim($owner['username']);
        if (str_contains($username, '@')) {
            if (filter_var($username, FILTER_VALIDATE_EMAIL) === false) {
                throw ApiException::badRequest('Enter a valid email address or 10-digit mobile number as the username');
            }
            $email = strtolower($username);
            $phone = ! empty($owner['phone']) ? (User::normalizePhone($owner['phone']) ?? $owner['phone']) : null;
        } else {
            $phone = User::normalizePhone($username);
            if (! $phone) {
                throw ApiException::badRequest('Enter a valid email address or 10-digit mobile number as the username');
            }
            $email = null;
        }

        $existing = User::findByLogin($username);
        if ($existing && in_array($existing->role, ['ADMIN', 'DEALER'], true)) {
            throw ApiException::badRequest("This username belongs to a staff account and can't be used as a business login");
        }
        foreach (['email' => $email, 'phone' => $phone] as $field => $value) {
            if (! $value) {
                continue;
            }
            $taken = User::where($field, $value)->first();
            if ($taken && $taken->id !== $existing?->id) {
                throw ApiException::conflict(
                    ($field === 'email' ? 'That email' : 'That phone number').' is already registered to another account'
                );
            }
        }

        return ['owner' => $owner, 'email' => $email, 'phone' => $phone, 'existing' => $existing];
    }

    // Inside the caller's transaction: the account the listing goes to.
    private function ownerAccount(array $login, array $actor): User
    {
        $account = $login['existing'];
        if ($account) {
            // Reuse the account; promote a plain customer to a business owner.
            if ($account->role === 'CUSTOMER') {
                $account->update(['role' => 'BUSINESS_OWNER']);
            }

            return $account;
        }

        return User::create([
            'email' => $login['email'],
            'phone' => $login['phone'],
            'passwordHash' => Hash::make($login['owner']['password']),
            'firstName' => $login['owner']['firstName'],
            'lastName' => $login['owner']['lastName'],
            'role' => 'BUSINESS_OWNER',
            'status' => 'ACTIVE',
            // Remember who set this account up so the dealer can manage it
            // later (e.g. reset the password on the owner's behalf).
            'createdById' => $actor['sub'],
        ]);
    }

    private function ownerAccountPayload(User $account, array $login): array
    {
        return [
            'username' => $account->email ?? $account->phone,
            'email' => $account->email,
            'created' => ! $login['existing'],
        ];
    }

    public function store(Request $request)
    {
        $data = $request->validate($this->businessRules());
        $actor = $request->attributes->get('auth');
        $owner = $data['owner'] ?? null;
        unset($data['owner']);
        $data['country'] = $data['country'] ?? 'IN';
        // Explicit rather than relying on the DB column default — Eloquent
        // doesn't reload a row after create(), so the response would show
        // null here instead of the value MySQL actually stored.
        $data['businessType'] = $data['businessType'] ?? 'B2C';
        $data['slug'] = $this->uniqueSlug($data['slug'] ?? $data['name']);

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

        $login = $this->checkOwnerLogin($owner);

        $result = DB::transaction(function () use ($data, $actor, $initialStatus, $isStaff, $login) {
            $ownerRecord = $this->ownerAccount($login, $actor);

            $business = Business::create([
                ...$data,
                'ownerId' => $ownerRecord->id,
                'createdById' => $actor['sub'],
                'status' => $initialStatus,
                'isVerified' => $isStaff,
            ]);

            Points::spendForBusiness($actor, $business->id);

            return [...$business->toArray(), 'ownerAccount' => $this->ownerAccountPayload($ownerRecord, $login)];
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

        // Dealers also see the listings they created and handed to a
        // business team's own login, so they can keep managing them.
        $query = $actor['role'] === 'DEALER'
            ? Business::where(fn ($q) => $q->where('ownerId', $actor['sub'])->orWhere('createdById', $actor['sub']))
            : Business::where('ownerId', $actor['sub']);
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
        $this->assertOwnerOrAdmin($actor, $business);

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
        $this->assertOwnerOrAdmin($actor, $business);

        $data = $request->validate($this->businessRulesForUpdate());
        $business->update($data);

        return ApiResponse::ok($business);
    }

    private function businessRulesForUpdate(): array
    {
        $rules = $this->businessRules(partial: true);
        unset($rules['owner'], $rules['owner.firstName'], $rules['owner.lastName'], $rules['owner.username'], $rules['owner.phone'], $rules['owner.password']);

        return $rules;
    }

    public function destroy(Request $request, string $id)
    {
        $actor = $request->attributes->get('auth');
        $business = $this->findOrFail($id);
        // Deleting stays with the owner and admins — a dealer can edit the
        // listings they created but not remove them.
        if ($actor['role'] !== 'ADMIN' && $actor['sub'] !== $business->ownerId) {
            throw ApiException::forbidden('You do not own this business');
        }

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

    // Dealers only: a draft copy of a listing they manage, as a head start on
    // a similar one (another branch, another shop of the same kind). It
    // copies what the listing shows — details, hours, services, photos,
    // products and website — and costs a point like any new listing. The
    // copy is a different business, so it gets its own login (`owner`, as
    // in store) and is assigned to that account.
    // Reviews, leads, bookings, orders, QR boards and the Google review link
    // belong to the original business and stay with it.
    public function duplicate(Request $request, string $id)
    {
        $actor = $request->attributes->get('auth');
        $source = Business::with(['photos', 'hours', 'services', 'site'])->find($id);
        if (! $source) {
            throw ApiException::notFound('Business not found');
        }
        $this->assertOwnerOrAdmin($actor, $source);
        $owner = $request->validate(self::ownerRules('required'))['owner'];
        Points::assertHasPointsForBusiness($actor);
        $login = $this->checkOwnerLogin($owner);

        return DB::transaction(function () use ($actor, $source, $login) {
            $ownerRecord = $this->ownerAccount($login, $actor);
            $name = mb_substr($source->name, 0, 143).' (Copy)';
            $copy = Business::create([
                ...$source->only([
                    'description', 'categoryId', 'subscriptionPlan', 'businessType', 'email', 'phone', 'website',
                    'addressLine1', 'addressLine2', 'city', 'state', 'postalCode', 'country', 'latitude', 'longitude',
                    'instagramUsername', 'facebookPageUrl', 'youtubeUrl', 'preferredReviewChannel', 'logoUrl', 'coverImageUrl',
                ]),
                'name' => $name,
                'slug' => $this->uniqueSlug($name),
                'ownerId' => $ownerRecord->id,
                'createdById' => $actor['sub'],
                // A draft, so a copy with the same details never shows up
                // publicly until the dealer has made it its own.
                'status' => 'DRAFT',
                'isVerified' => false,
            ]);

            foreach ($source->photos as $photo) {
                BusinessPhoto::create([...$photo->only(['url', 'caption', 'sortOrder']), 'businessId' => $copy->id]);
            }
            foreach ($source->hours as $hours) {
                BusinessHours::create([...$hours->only(['dayOfWeek', 'openTime', 'closeTime', 'isClosed']), 'businessId' => $copy->id]);
            }
            foreach ($source->services as $service) {
                Service::create([...$service->only(['name', 'description', 'priceCents', 'currency', 'durationMins', 'isActive']), 'businessId' => $copy->id]);
            }
            foreach (Product::where('businessId', $source->id)->get() as $product) {
                Product::create([...$product->only([
                    'name', 'slug', 'description', 'priceCents', 'compareAtCents', 'currency',
                    'imageUrl', 'sku', 'trackStock', 'stock', 'isActive', 'sortOrder',
                ]), 'businessId' => $copy->id]);
            }
            if ($source->site) {
                // Offline until the dealer publishes the copy themselves.
                BusinessSite::create([...$source->site->only([
                    'siteType', 'templateId', 'projectData', 'html', 'css', 'sliderImages', 'galleryImages',
                    'deliveryFeeCents', 'freeDeliveryAboveCents', 'acceptsOnlinePayment',
                ]), 'businessId' => $copy->id, 'isPublished' => false]);
            }

            Points::spendForBusiness($actor, $copy->id);

            return ApiResponse::created([...$copy->toArray(), 'ownerAccount' => $this->ownerAccountPayload($ownerRecord, $login)]);
        });
    }

    public function submit(Request $request, string $id)
    {
        $actor = $request->attributes->get('auth');
        $business = $this->findOrFail($id);
        $this->assertOwnerOrAdmin($actor, $business);
        // Staff listings go live without review, as they do when created
        // (see store) — this is how a dealer publishes a cloned draft.
        $isStaff = in_array($actor['role'], ['DEALER', 'ADMIN'], true);
        $business->update(['status' => $isStaff ? 'PUBLISHED' : 'PENDING_APPROVAL']);

        return ApiResponse::ok($business);
    }

    public function addPhoto(Request $request, string $id)
    {
        $actor = $request->attributes->get('auth');
        $business = $this->findOrFail($id);
        $this->assertOwnerOrAdmin($actor, $business);

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
        $this->assertOwnerOrAdmin($actor, $business);
        BusinessPhoto::where('id', $photoId)->delete();

        return ApiResponse::noContent();
    }

    public function setHours(Request $request, string $id)
    {
        $actor = $request->attributes->get('auth');
        $business = $this->findOrFail($id);
        $this->assertOwnerOrAdmin($actor, $business);

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
        $this->assertOwnerOrAdmin($actor, $business);

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
        $this->assertOwnerOrAdmin($actor, $business);

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
        $this->assertOwnerOrAdmin($actor, $business);
        Service::where('id', $serviceId)->delete();

        return ApiResponse::noContent();
    }
}
