<?php

namespace App\Http\Controllers;

use App\Exceptions\ApiException;
use App\Models\Business;
use App\Models\Lead;
use App\Support\ApiResponse;
use App\Support\Pagination;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class LeadController extends Controller
{
    public function store(Request $request, string $businessId)
    {
        $data = $request->validate([
            'name' => ['required', 'string', 'min:1', 'max:150'],
            'phone' => ['required', 'string', 'min:7', 'max:20'],
            'email' => ['nullable', 'email'],
            'message' => ['nullable', 'string', 'max:1000'],
            'source' => ['sometimes', 'in:SEARCH,BUSINESS_PROFILE,CALLBACK_REQUEST,QUOTE_REQUEST,B2B_RFQ'],
        ]);
        $data['source'] = $data['source'] ?? 'SEARCH';
        $data['status'] = 'NEW';

        if (! Business::find($businessId)) {
            throw ApiException::notFound('Business not found');
        }

        $auth = $request->attributes->get('auth');

        $lead = DB::transaction(function () use ($businessId, $auth, $data) {
            $lead = Lead::create([...$data, 'businessId' => $businessId, 'customerId' => $auth['sub'] ?? null]);
            Business::where('id', $businessId)->increment('leadCount');

            return $lead;
        });

        return ApiResponse::created($lead);
    }

    public function index(Request $request, string $businessId)
    {
        $auth = $request->attributes->get('auth');
        $request->validate(['status' => ['sometimes', 'in:NEW,CONTACTED,QUALIFIED,CONVERTED,LOST']]);
        $pagination = Pagination::parse($request->query());

        $business = Business::find($businessId);
        if (! $business) {
            throw ApiException::notFound('Business not found');
        }
        if ($business->ownerId !== $auth['sub']) {
            throw ApiException::forbidden('You do not own this business');
        }

        $query = Lead::where('businessId', $businessId);
        if ($status = $request->query('status')) {
            $query->where('status', $status);
        }

        $total = (clone $query)->count();
        $items = $query->orderByDesc('createdAt')->skip($pagination['skip'])->take($pagination['take'])->get();

        return ApiResponse::paginated($items, ['page' => $pagination['page'], 'pageSize' => $pagination['pageSize'], 'total' => $total]);
    }

    public function updateStatus(Request $request, string $leadId)
    {
        $auth = $request->attributes->get('auth');
        $data = $request->validate(['status' => ['required', 'in:NEW,CONTACTED,QUALIFIED,CONVERTED,LOST']]);

        $lead = Lead::with('business')->find($leadId);
        if (! $lead) {
            throw ApiException::notFound('Lead not found');
        }
        if ($lead->business->ownerId !== $auth['sub']) {
            throw ApiException::forbidden('You do not own this business');
        }

        $lead->update(['status' => $data['status']]);

        return ApiResponse::ok($lead);
    }
}
