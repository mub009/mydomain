<?php

namespace App\Http\Controllers;

use App\Exceptions\ApiException;
use App\Models\Visitor;
use App\Support\ApiResponse;
use App\Support\Pagination;
use Illuminate\Http\Request;

class VisitorController extends Controller
{
    // Normalise to the bare 10-digit number so "+919876543210" and
    // "9876543210" are the same visitor.
    private function normalizePhone(string $raw): string
    {
        $digits = preg_replace('/\D/', '', $raw);

        return substr($digits, -10);
    }

    // Record (or refresh) a visitor who shared their number in the welcome
    // popup. Re-visits update the last-seen timestamp and bump the visit
    // counter rather than creating duplicates, so the popup only needs to
    // ask once.
    public function store(Request $request)
    {
        $data = $request->validate([
            'phone' => ['required', 'string', 'regex:/^(\+?91)?[6-9]\d{9}$/'],
            'latitude' => ['sometimes', 'numeric', 'min:-90', 'max:90'],
            'longitude' => ['sometimes', 'numeric', 'min:-180', 'max:180'],
            'city' => ['sometimes', 'string', 'max:100'],
            'consent' => ['required', 'accepted'],
        ]);

        $phone = $this->normalizePhone($data['phone']);
        $hasLocation = isset($data['latitude']) && isset($data['longitude']);
        $now = now();

        $visitor = Visitor::where('phone', $phone)->first();
        if ($visitor) {
            $update = [
                'lastSeenAt' => $now,
                'visitCount' => $visitor->visitCount + 1,
            ];
            if ($hasLocation) {
                $update['latitude'] = $data['latitude'];
                $update['longitude'] = $data['longitude'];
                $update['locationAt'] = $now;
            }
            if (! empty($data['city'])) {
                $update['city'] = $data['city'];
            }
            if ($request->userAgent()) {
                $update['userAgent'] = $request->userAgent();
            }
            $visitor->update($update);
        } else {
            $visitor = Visitor::create([
                'phone' => $phone,
                'latitude' => $data['latitude'] ?? null,
                'longitude' => $data['longitude'] ?? null,
                'city' => $data['city'] ?? null,
                'userAgent' => $request->userAgent(),
                'consentAt' => $now,
                'locationAt' => $hasLocation ? $now : null,
                'lastSeenAt' => $now,
                'visitCount' => 1,
            ]);
        }

        return ApiResponse::created(['id' => $visitor->id, 'phone' => $visitor->phone]);
    }

    // Attach coordinates to an already-captured visitor. The browser prompts
    // for permission separately, so this often arrives after the number.
    public function updateLocation(Request $request, string $id)
    {
        $data = $request->validate([
            'latitude' => ['required', 'numeric', 'min:-90', 'max:90'],
            'longitude' => ['required', 'numeric', 'min:-180', 'max:180'],
            'city' => ['sometimes', 'string', 'max:100'],
        ]);

        $visitor = Visitor::find($id);
        if (! $visitor) {
            throw ApiException::notFound('Visitor not found');
        }

        $visitor->update([
            'latitude' => $data['latitude'],
            'longitude' => $data['longitude'],
            'city' => $data['city'] ?? null,
            'locationAt' => now(),
        ]);

        return ApiResponse::ok(['id' => $id, 'located' => true]);
    }

    public function index(Request $request)
    {
        $request->validate([
            'search' => ['sometimes', 'string', 'max:100'],
            'withLocation' => ['sometimes', 'in:true,false'],
        ]);
        $pagination = Pagination::parse($request->query());

        $query = Visitor::query();
        if ($search = $request->query('search')) {
            $query->where(fn ($q) => $q->where('phone', 'like', "%{$search}%")->orWhere('city', 'like', "%{$search}%"));
        }
        if ($request->query('withLocation') === 'true') {
            $query->whereNotNull('latitude');
        }

        $total = (clone $query)->count();
        $located = Visitor::whereNotNull('latitude')->count();
        $todayCount = Visitor::where('createdAt', '>=', now()->startOfDay())->count();

        $items = $query->orderByDesc('lastSeenAt')->skip($pagination['skip'])->take($pagination['take'])->get();

        return response()->json([
            'success' => true,
            'data' => $items,
            'meta' => [
                'page' => $pagination['page'], 'pageSize' => $pagination['pageSize'], 'total' => $total,
                'totalPages' => $pagination['pageSize'] > 0 ? ((int) ceil($total / $pagination['pageSize']) ?: 1) : 1,
            ],
            'summary' => ['located' => $located, 'todayCount' => $todayCount],
        ]);
    }
}
