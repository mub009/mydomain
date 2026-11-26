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
    // New boards are numbered: MK-100001, MK-100002, … — each batch carries on
    // from the highest number issued so far (older boards with letter codes
    // keep working as they are).
    private const FIRST_NUMBER = 100001;

    private function nextNumber(): int
    {
        $highest = ReviewQrCode::where('code', 'like', 'MK-%')->pluck('code')
            ->map(fn ($code) => substr($code, 3))
            ->filter(fn ($n) => $n !== '' && ctype_digit($n))
            ->map(fn ($n) => (int) $n)
            ->max();

        return max(self::FIRST_NUMBER, ($highest ?? 0) + 1);
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
    // Dealers make boards for the shops they sign up: up to 100 at a time.
    public const DEALER_BATCH_MAX = 100;

    // A dealer sees the boards they generated, and any they attached to a shop.
    private function scopeToDealer($query, array $actor)
    {
        return $actor['role'] === 'DEALER'
            ? $query->where(fn ($q) => $q->where('createdById', $actor['sub'])->orWhere('assignedById', $actor['sub']))
            : $query;
    }

    public function generateBatch(Request $request)
    {
        $actor = $request->attributes->get('auth');
        $data = $request->validate([
            'count' => ['required', 'integer', 'min:1', 'max:'.($actor['role'] === 'DEALER' ? self::DEALER_BATCH_MAX : 500)],
            'batchLabel' => ['sometimes', 'nullable', 'string', 'max:100'],
            'channel' => ['sometimes', 'nullable', 'in:'.implode(',', ReviewChannels::ALL)],
        ]);

        $created = [];
        $number = $this->nextNumber();
        for ($i = 0; $i < $data['count']; $i++) {
            for ($attempts = 0; ; $attempts++) {
                // The next number; if someone else took it meanwhile, the one after.
                $code = 'MK-'.$number++;
                try {
                    ReviewQrCode::create([
                        'code' => $code,
                        'batchLabel' => $data['batchLabel'] ?? null,
                        'channel' => $data['channel'] ?? null,
                        'status' => 'UNASSIGNED',
                        'scanCount' => 0,
                        'createdById' => $actor['sub'] ?? null,
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
            'status' => ['sometimes', 'nullable', 'in:UNASSIGNED,ASSIGNED,DISABLED'],
            'search' => ['sometimes', 'nullable', 'string', 'max:100'],
            'batchLabel' => ['sometimes', 'nullable', 'string', 'max:100'],
        ]);
        $pagination = Pagination::parse($request->query());
        $actor = $request->attributes->get('auth');
        $mine = fn () => $this->scopeToDealer(ReviewQrCode::query(), $actor);

        $query = $mine();
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
                'unassigned' => $mine()->where('status', 'UNASSIGNED')->count(),
                'assigned' => $mine()->where('status', 'ASSIGNED')->count(),
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

    /**
     * The boards asked for as QR images, one PNG each (named by its code),
     * in one ZIP — what the admin prints or sends to the printer. Each QR
     * holds the board's scan address on this site (/r/q/<code>).
     */
    public function downloadZip(Request $request)
    {
        $wanted = collect(explode(',', (string) $request->query('codes')))
            ->map(fn ($c) => $this->normalizeCode($c))->filter(fn ($c) => strlen($c) > 3)->unique()->take(500)->values();
        $codes = $this->webScoped()->whereIn('code', $wanted)->pluck('code')->sort()->values();
        abort_if($codes->isEmpty(), 404);

        return $this->zipResponse($codes, $this->publicBase($request));
    }

    // Boards the signed-in page user may download or share: a dealer, their own.
    private function webScoped()
    {
        $user = \App\Support\WebAuth::user();

        return $this->scopeToDealer(ReviewQrCode::query(), ['role' => $user?->role, 'sub' => $user?->id]);
    }

    // The address the QR codes carry: the QR domain (mydomainbook.com), so a
    // board prints the same wherever it was made.
    private function publicBase(Request $request): string
    {
        return rtrim((string) config('frontend.qr_origin'), '/') ?: rtrim($request->getSchemeAndHttpHost(), '/');
    }

    // A board's QR as a large PNG, high error correction so a scuffed board still scans.
    private function qrPng(string $base, string $code): string
    {
        return (new \chillerlan\QRCode\QRCode(new \chillerlan\QRCode\QROptions([
            'outputInterface' => \chillerlan\QRCode\Output\QRGdImagePNG::class,
            'eccLevel' => \chillerlan\QRCode\Common\EccLevel::H,
            'scale' => 16,
            'quietzoneSize' => 2,
            'outputBase64' => false,
        ])))->render("{$base}/r/q/{$code}");
    }

    private function zipResponse(\Illuminate\Support\Collection $codes, string $base)
    {
        $path = tempnam(sys_get_temp_dir(), 'qr');
        $zip = new \ZipArchive;
        $zip->open($path, \ZipArchive::OVERWRITE);
        foreach ($codes as $code) {
            $zip->addFromString("{$code}.png", $this->qrPng($base, $code));
        }
        $zip->close();
        $name = $codes->count() === 1 ? "{$codes[0]}-qr.zip" : "qr-boards-{$codes->first()}-to-{$codes->last()}.zip";

        return response()->download($path, $name, ['Content-Type' => 'application/zip'])->deleteFileAfterSend();
    }

    // --- Shared QR links ---------------------------------------------------
    // The admin can share a set of boards as one link (e.g. on WhatsApp).
    // Whoever opens it sees every QR and can download each one, or all of them
    // as a ZIP. The link carries the codes, packed short ("100001-100020"), and
    // a signature, so it can't be edited to show other boards.

    // MK-100001…MK-100020 -> "100001-100020"; other codes as they are, joined by "_".
    private function packCodes(\Illuminate\Support\Collection $codes): string
    {
        $numbers = $codes->map(fn ($c) => substr($c, 3))->filter(fn ($n) => ctype_digit($n))->map(fn ($n) => (int) $n)->sort()->values();
        $others = $codes->map(fn ($c) => substr($c, 3))->reject(fn ($n) => ctype_digit($n))->values();
        $parts = [];
        $from = $prev = null;
        foreach ($numbers as $n) {
            if ($prev !== null && $n === $prev + 1) {
                $prev = $n;

                continue;
            }
            if ($from !== null) {
                $parts[] = $from === $prev ? "{$from}" : "{$from}-{$prev}";
            }
            $from = $prev = $n;
        }
        if ($from !== null) {
            $parts[] = $from === $prev ? "{$from}" : "{$from}-{$prev}";
        }

        return implode('_', array_merge($parts, $others->all()));
    }

    private function unpackCodes(string $packed): \Illuminate\Support\Collection
    {
        $codes = collect();
        foreach (explode('_', $packed) as $part) {
            if (preg_match('/^(\d+)-(\d+)$/', $part, $m)) {
                $from = (int) $m[1];
                $to = min((int) $m[2], $from + 499);
                for ($n = $from; $n <= $to; $n++) {
                    $codes->push("MK-{$n}");
                }
            } elseif (preg_match('/^[A-Z0-9]+$/', $part)) {
                $codes->push("MK-{$part}");
            }
            if ($codes->count() >= 500) {
                break;
            }
        }

        return $codes->take(500)->unique()->values();
    }

    private function shareSignature(string $packed): string
    {
        return substr(hash_hmac('sha256', "qr-share|{$packed}", (string) config('app.key')), 0, 24);
    }

    // The boards a shared link names — 404 when the link was changed or names none.
    private function sharedBoards(Request $request): array
    {
        $packed = (string) $request->query('c');
        abort_unless($packed !== '' && hash_equals($this->shareSignature($packed), (string) $request->query('s')), 404);
        $boards = ReviewQrCode::whereIn('code', $this->unpackCodes($packed))->orderBy('code')->get();
        abort_if($boards->isEmpty(), 404);

        return [$packed, $boards];
    }

    private function shareQuery(string $packed): string
    {
        return http_build_query(['c' => $packed, 's' => $this->shareSignature($packed)]);
    }

    // Admin: the share link for a set of boards (?codes=MK-100001,MK-100002).
    public function shareLink(Request $request)
    {
        $wanted = collect(explode(',', (string) $request->query('codes')))
            ->map(fn ($c) => $this->normalizeCode($c))->filter(fn ($c) => strlen($c) > 3)->unique()->take(500)->values();
        $codes = $this->webScoped()->whereIn('code', $wanted)->pluck('code')->values();
        abort_if($codes->isEmpty(), 404);
        $packed = $this->packCodes($codes);

        return response()->json(['url' => $this->publicBase($request).'/qr-share?'.$this->shareQuery($packed), 'count' => $codes->count()]);
    }

    // Public: the shared page with every QR and its Download button.
    public function sharePage(Request $request)
    {
        [$packed, $boards] = $this->sharedBoards($request);
        $query = $this->shareQuery($packed);

        return view('pages.qr-share', [
            'boards' => $boards,
            'query' => $query,
            'shareUrl' => $this->publicBase($request).'/qr-share?'.$query,
        ]);
    }

    // Public: one QR from a shared link, shown on the page or downloaded (?download=1).
    public function sharePng(Request $request, string $code)
    {
        [, $boards] = $this->sharedBoards($request);
        $code = $this->normalizeCode($code);
        abort_unless($boards->contains('code', $code), 404);
        $headers = ['Content-Type' => 'image/png', 'Cache-Control' => 'public, max-age=86400'];
        if ($request->boolean('download')) {
            $headers['Content-Disposition'] = "attachment; filename=\"{$code}-qr.png\"";
        }

        return response($this->qrPng($this->publicBase($request), $code), 200, $headers);
    }

    // Public: every QR from a shared link in one ZIP.
    public function shareZip(Request $request)
    {
        [, $boards] = $this->sharedBoards($request);

        return $this->zipResponse($boards->pluck('code')->sort()->values(), $this->publicBase($request));
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
