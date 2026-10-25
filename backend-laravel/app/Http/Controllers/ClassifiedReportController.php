<?php

namespace App\Http\Controllers;

use App\Exceptions\ApiException;
use App\Models\ClassifiedListing;
use App\Models\ClassifiedReport;
use App\Support\ApiResponse;
use App\Support\Pagination;
use Illuminate\Http\Request;

class ClassifiedReportController extends Controller
{
    public function store(Request $request, string $listingId)
    {
        $actor = $request->attributes->get('auth');
        $data = $request->validate([
            'reason' => ['required', 'in:PROHIBITED_ITEM,SCAM_FRAUD,INAPPROPRIATE,SPAM,OTHER'],
            'message' => ['sometimes', 'nullable', 'string', 'max:1000'],
        ]);

        if (! ClassifiedListing::where('id', $listingId)->exists()) {
            throw ApiException::notFound('Listing not found');
        }

        $report = ClassifiedReport::create([
            'listingId' => $listingId,
            'reporterId' => $actor['sub'],
            'reason' => $data['reason'],
            'message' => $data['message'] ?? null,
        ]);

        return ApiResponse::created($report);
    }

    // Admin: queue of reports, newest first, optionally filtered by status.
    public function index(Request $request)
    {
        $request->validate([
            'status' => ['sometimes', 'nullable', 'in:PENDING,REVIEWED,DISMISSED'],
        ]);
        $pagination = Pagination::parse($request->query());

        $query = ClassifiedReport::query();
        if ($status = $request->query('status')) {
            $query->where('status', $status);
        }

        $total = (clone $query)->count();
        $reports = $query->orderByDesc('createdAt')
            ->skip($pagination['skip'])->take($pagination['take'])
            ->with(['listing:id,title,slug,sellerId,status', 'reporter:id,firstName,lastName,email'])
            ->get();

        return ApiResponse::paginated($reports, ['page' => $pagination['page'], 'pageSize' => $pagination['pageSize'], 'total' => $total]);
    }

    // Admin: mark a report reviewed or dismissed after acting on it.
    public function updateStatus(Request $request, string $id)
    {
        $data = $request->validate(['status' => ['required', 'in:REVIEWED,DISMISSED']]);

        $report = ClassifiedReport::find($id);
        if (! $report) {
            throw ApiException::notFound('Report not found');
        }
        $report->update(['status' => $data['status']]);

        return ApiResponse::ok($report);
    }
}
