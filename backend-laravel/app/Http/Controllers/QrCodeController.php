<?php

namespace App\Http\Controllers;

use App\Exceptions\ApiException;
use App\Models\Business;
use App\Models\ReviewQrCode;
use App\Models\ReviewScan;
use App\Support\ApiResponse;
use App\Support\Pagination;
use App\Support\ReviewChannels;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class QrCodeController extends Controller
{
    // Unambiguous alphabet: no O/0, I/1, S/5 — these codes get read off a
    // printed board and typed in by hand when a camera struggles.
    private const ALPHABET = 'ABCDEFGHJKLMNPQRTUVWXYZ23456789';

    private const CODE_LENGTH = 6;

    private function generateCode(): string
    {
        $body = '';
        for ($i = 0; $i < self::CODE_LENGTH; $i++) {
            $body .= self::ALPHABET[random_int(0, strlen(self::ALPHABET) - 1)];
        }

        return "MK-{$body}";
    }

    // Normalise whatever the shop typed or scanned: "mk 7f3k2a" -> "MK-7F3K2A".
    private function normalizeCode(string $raw): string
    {
        $cleaned = preg_replace('/[^A-Z0-9]/', '', strtoupper(trim($raw)));
        $body = str_starts_with($cleaned, 'MK') ? substr($cleaned, 2) : $cleaned;

        return "MK-{$body}";
    }

    /**
     * Who may attach a board to a business. Admins may attach anywhere; an
     * owner to their own shops; and a dealer to the shops they registered —
     * the dealer hands out the printed boards, and the shop's own login
     * belongs to the business team, not to them.
     *
     * Note this governs *attaching only*. Detaching or moving a board
     * between businesses stays admin-only (see updateAdmin).
     */
    private function canAssignBoardTo(array $actor, Business $business): bool
    {
        if ($actor['role'] === 'ADMIN') {
            return true;
        }
        if ($business->ownerId === $actor['sub']) {
            return true;
        }

        return $actor['role'] === 'DEALER' && $business->createdById === $actor['sub'];
    }

    // --- Admin ---------------------------------------------------------

    // Admin issues a batch of boards, optionally all pointing at one
    // platform (picked from the list). Codes are unique; collisions are
    // retried.
    public function generateBatch(Request $request)
    {
        $data = $request->validate([
            'count' => ['required', 'integer', 'min:1', 'max:500'],
            'batchLabel' => ['sometimes', 'nullable', 'string', 'max:100'],
            'channel' => ['sometimes', 'nullable', 'in:'.implode(',', ReviewChannels::ALL)],
        ]);

        $created = [];
        for ($i = 0; $i < $data['count']; $i++) {
            for ($attempts = 0; ; $attempts++) {
                $code = $this->generateCode();
                try {
                    ReviewQrCode::create([
                        'code' => $code,
                        'batchLabel' => $data['batchLabel'] ?? null,
                        'channel' => $data['channel'] ?? null,
                        'status' => 'UNASSIGNED',
                        'scanCount' => 0,
                    ]);
                    $created[] = $code;
                    break;
                } catch (\Illuminate\Database\QueryException $e) {
                    if ($e->getCode() === '23000' && $attempts < 5) {
                        continue;
                    }
                    throw $e;
                }
            }
        }

        return ApiResponse::created(['created' => count($created), 'codes' => $created, 'batchLabel' => $data['batchLabel'] ?? null]);
    }

    public function index(Request $request)
    {
        $request->validate([
            'status' => ['sometimes', 'in:UNASSIGNED,ASSIGNED,DISABLED'],
            'search' => ['sometimes', 'string', 'max:100'],
            'batchLabel' => ['sometimes', 'string', 'max:100'],
        ]);
        $pagination = Pagination::parse($request->query());

        $query = ReviewQrCode::query();
        if ($status = $request->query('status')) {
            $query->where('status', $status);
        }
        if ($batchLabel = $request->query('batchLabel')) {
            $query->where('batchLabel', $batchLabel);
        }
        if ($search = $request->query('search')) {
            $query->where(function ($q) use ($search) {
                $q->where('code', 'like', '%'.strtoupper($search).'%')
                    ->orWhereHas('business', fn ($b) => $b->where('name', 'like', "%{$search}%"));
            });
        }

        $total = (clone $query)->count();
        $items = $query->orderByDesc('createdAt')->skip($pagination['skip'])->take($pagination['take'])
            ->with('business:id,name,slug,city')->get();

        return response()->json([
            'success' => true,
            'data' => $items,
            'meta' => [
                'page' => $pagination['page'], 'pageSize' => $pagination['pageSize'], 'total' => $total,
                'totalPages' => $pagination['pageSize'] > 0 ? ((int) ceil($total / $pagination['pageSize']) ?: 1) : 1,
            ],
            'summary' => [
                'unassigned' => ReviewQrCode::where('status', 'UNASSIGNED')->count(),
                'assigned' => ReviewQrCode::where('status', 'ASSIGNED')->count(),
            ],
        ]);
    }

    // Admin actions: detach a board (back to the pool) or disable a lost one.
    public function updateAdmin(Request $request, string $id)
    {
        $data = $request->validate([
            'status' => ['sometimes', 'in:UNASSIGNED,ASSIGNED,DISABLED'],
            'businessId' => ['sometimes', 'nullable', 'uuid'],
            'channel' => ['sometimes', 'nullable', 'in:'.implode(',', ReviewChannels::ALL)],
        ]);

        if (! array_key_exists('status', $data) && ! array_key_exists('businessId', $data) && ! array_key_exists('channel', $data)) {
            throw ApiException::badRequest('Provide a status, business, or channel to change');
        }

        $qr = ReviewQrCode::find($id);
        if (! $qr) {
            throw ApiException::notFound('QR code not found');
        }

        $patch = [];
        if (array_key_exists('channel', $data)) {
            $patch['channel'] = $data['channel'];
        }

        if (array_key_exists('businessId', $data)) {
            if ($data['businessId'] === null) {
                $patch['businessId'] = null;
                $patch['status'] = 'UNASSIGNED';
                $patch['assignedAt'] = null;
                $patch['assignedById'] = null;
            } else {
                if (! Business::find($data['businessId'])) {
                    throw ApiException::badRequest('Target business not found');
                }
                $patch['businessId'] = $data['businessId'];
                $patch['status'] = 'ASSIGNED';
                $patch['assignedAt'] = now();
            }
        }

        // An explicit status wins, except that ASSIGNED needs a business attached.
        if (! empty($data['status'])) {
            $targetBusinessId = array_key_exists('businessId', $data) ? $data['businessId'] : $qr->businessId;
            if ($data['status'] === 'ASSIGNED' && ! $targetBusinessId) {
                throw ApiException::badRequest('Attach the code to a business before marking it assigned');
            }
            $patch['status'] = $data['status'];
            if ($data['status'] === 'UNASSIGNED') {
                $patch['businessId'] = null;
                $patch['assignedAt'] = null;
                $patch['assignedById'] = null;
            }
        }

        $qr->update($patch);
        $qr->load('business:id,name,slug,city');

        return ApiResponse::ok($qr);
    }

    // --- Shop-facing -----------------------------------------------------

    // Public lookup used by the confirm screen after a shop scans a board.
    // Deliberately returns only what the claim screen needs.
    public function lookup(string $code)
    {
        $qr = ReviewQrCode::where('code', $this->normalizeCode($code))->with('business:id,name,slug,city')->first();
        if (! $qr) {
            throw ApiException::notFound('That QR code was not recognised. Check the code printed on the board.');
        }

        return ApiResponse::ok([
            'code' => $qr->code, 'status' => $qr->status, 'channel' => $qr->channel,
            'batchLabel' => $qr->batchLabel, 'scanCount' => $qr->scanCount,
            'assignedAt' => $qr->assignedAt, 'business' => $qr->business,
        ]);
    }

    // The businesses this actor may attach a board to, for the picker on
    // the claim screen. A dealer sees the shops they registered even
    // though the listings belong to the shops' own accounts.
    public function assignableBusinesses(Request $request)
    {
        $actor = $request->attributes->get('auth');
        $search = $request->query('search');

        $query = Business::query();
        if ($actor['role'] === 'ADMIN') {
            // Search-driven rather than an attempt to return every listing.
        } elseif ($actor['role'] === 'DEALER') {
            $query->where(fn ($q) => $q->where('ownerId', $actor['sub'])->orWhere('createdById', $actor['sub']));
        } else {
            $query->where('ownerId', $actor['sub']);
        }

        if ($term = trim((string) $search)) {
            $query->where(fn ($q) => $q->where('name', 'like', "%{$term}%")
                ->orWhere('city', 'like', "%{$term}%")
                ->orWhere('slug', 'like', "%{$term}%"));
        }

        $items = $query->orderByDesc('createdAt')->take(50)
            ->withCount('reviewQrCodes')
            ->get(['id', 'name', 'slug', 'city', 'ownerId', 'createdById'])
            ->map(fn ($b) => [
                'id' => $b->id, 'name' => $b->name, 'slug' => $b->slug, 'city' => $b->city,
                'ownerId' => $b->ownerId, 'createdById' => $b->createdById,
                '_count' => ['reviewQrCodes' => $b->review_qr_codes_count],
            ]);

        return ApiResponse::ok($items);
    }

    // A shop owner (or dealer/admin) confirms the scanned board and
    // attaches it to one of their businesses.
    public function claim(Request $request)
    {
        $actor = $request->attributes->get('auth');
        $data = $request->validate([
            'code' => ['required', 'string', 'min:4', 'max:20'],
            'businessId' => ['required', 'uuid'],
            'channel' => ['sometimes', 'nullable', 'in:'.implode(',', ReviewChannels::ALL)],
        ]);

        $code = $this->normalizeCode($data['code']);
        $qr = ReviewQrCode::where('code', $code)->first();
        $business = Business::find($data['businessId']);

        if (! $qr) {
            throw ApiException::notFound('That QR code was not recognised. Check the code printed on the board.');
        }
        if (! $business) {
            throw ApiException::notFound('Business not found');
        }
        if (! $this->canAssignBoardTo($actor, $business)) {
            throw ApiException::forbidden('You can only attach a QR board to a business you own or registered');
        }
        if ($qr->status === 'DISABLED') {
            throw ApiException::badRequest('This QR board has been disabled. Please contact the admin for a replacement.');
        }
        // A board whose business was deleted keeps status ASSIGNED but
        // loses the link; treat that as free rather than leaving the board
        // unusable forever.
        if ($qr->status === 'ASSIGNED' && $qr->businessId) {
            if ($qr->businessId === $data['businessId']) {
                throw ApiException::conflict('This QR board is already attached to this business.');
            }
            throw ApiException::conflict('This QR board is already attached to another business. Contact the admin to reassign it.');
        }

        $qr->update([
            'businessId' => $data['businessId'],
            'status' => 'ASSIGNED',
            'assignedAt' => now(),
            'assignedById' => $actor['sub'],
            ...(! empty($data['channel']) ? ['channel' => $data['channel']] : []),
        ]);
        $qr->load('business');

        // Warn the owner if the board will not lead anywhere useful yet.
        $channels = ReviewChannels::available($business);
        $effective = $qr->channel ?? $business->preferredReviewChannel ?? ($channels[0] ?? null);

        return ApiResponse::ok([
            'code' => $qr->code,
            'status' => $qr->status,
            'channel' => $qr->channel,
            'business' => $qr->business->only(['id', 'name', 'slug', 'city']),
            'assignedAt' => $qr->assignedAt,
            'reviewChannelsConfigured' => $channels,
            'needsReviewLinks' => count($channels) === 0,
            'effectiveChannel' => $effective,
            'effectiveUrl' => $effective ? ReviewChannels::resolve($business, $effective) : null,
        ]);
    }

    // The owner re-points one of their boards at a different platform.
    public function setBoardChannel(Request $request, string $id, string $qrId)
    {
        $actor = $request->attributes->get('auth');
        $data = $request->validate(['channel' => ['required', 'nullable', 'in:'.implode(',', ReviewChannels::ALL)]]);

        $qr = ReviewQrCode::with('business')->find($qrId);
        if (! $qr) {
            throw ApiException::notFound('QR board not found');
        }
        if (! $qr->business) {
            throw ApiException::badRequest('Attach this board to a business first');
        }
        if (! $this->canAssignBoardTo($actor, $qr->business)) {
            throw ApiException::forbidden('You do not manage this business');
        }
        if (! empty($data['channel']) && ! ReviewChannels::resolve($qr->business, $data['channel'])) {
            $label = strtolower($data['channel']);
            throw ApiException::badRequest("Add your {$label} link in \"Connect your review pages\" before pointing a board at it");
        }

        $qr->update(['channel' => $data['channel']]);

        return ApiResponse::ok($qr->only(['id', 'code', 'channel', 'status', 'scanCount', 'assignedAt']));
    }

    // The boards attached to a business, for its dashboard.
    public function businessQrCodes(Request $request, string $id)
    {
        $actor = $request->attributes->get('auth');
        $business = Business::find($id);
        if (! $business) {
            throw ApiException::notFound('Business not found');
        }
        if (! $this->canAssignBoardTo($actor, $business)) {
            throw ApiException::forbidden('You do not manage this business');
        }

        $items = ReviewQrCode::where('businessId', $id)->orderByDesc('assignedAt')
            ->get(['id', 'code', 'channel', 'status', 'scanCount', 'assignedAt']);

        return ApiResponse::ok($items);
    }

    // --- Public scan -------------------------------------------------------

    // The printed board encodes this URL. A claimed board redirects the
    // customer to the review page; an unclaimed one sends the shop to the
    // confirm screen.
    public function scan(string $code)
    {
        $normalized = $this->normalizeCode($code);
        $origin = config('frontend.origin');
        $qr = ReviewQrCode::where('code', $normalized)->with('business')->first();

        if (! $qr || $qr->status === 'DISABLED') {
            return redirect()->away("{$origin}/qr/{$normalized}?unknown=1");
        }
        if (! $qr->business) {
            return redirect()->away("{$origin}/qr/{$qr->code}");
        }

        $business = $qr->business;
        $channels = ReviewChannels::available($business);
        if (count($channels) === 0) {
            return redirect()->away("{$origin}/business/{$business->slug}");
        }

        // The board's own purpose wins — that's what was picked from the
        // list when it was issued or claimed. Fall back to the shop's
        // default, then to whatever it has configured, so a scan always
        // lands somewhere.
        $channel = ($qr->channel && ReviewChannels::resolve($business, $qr->channel)) ? $qr->channel : null;
        $channel ??= ($business->preferredReviewChannel && ReviewChannels::resolve($business, $business->preferredReviewChannel))
            ? $business->preferredReviewChannel : null;
        $channel ??= $channels[0];

        $url = ReviewChannels::resolve($business, $channel);
        if (! $url) {
            return redirect()->away("{$origin}/business/{$business->slug}");
        }

        // Analytics must never delay the customer's redirect, but this is a
        // synchronous framework — keep it as a best-effort fire-and-forget.
        try {
            $userAgent = request()->userAgent();
            DB::transaction(function () use ($business, $qr, $channel, $userAgent) {
                ReviewScan::create(['businessId' => $business->id, 'qrCodeId' => $qr->id, 'channel' => $channel, 'userAgent' => $userAgent]);
                $qr->increment('scanCount');
            });
        } catch (\Throwable) {
            // Never let analytics failures block the redirect.
        }

        return redirect()->away($url);
    }
}
