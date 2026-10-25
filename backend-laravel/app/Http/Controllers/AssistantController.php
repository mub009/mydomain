<?php

namespace App\Http\Controllers;

use App\Exceptions\ApiException;
use App\Models\Business;
use App\Support\ApiResponse;
use App\Support\BusinessAccess;
use App\Support\Gemini;
use App\Support\SiteAssistant;
use Illuminate\Http\Client\ConnectionException;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use RuntimeException;

// The website assistant (App\Support\SiteAssistant): plan changes from what
// the owner said, then apply them once the owner has confirmed.
class AssistantController extends Controller
{
    private function business(Request $request, string $id): Business
    {
        $business = Business::find($id);
        if (! $business) {
            throw ApiException::notFound('Business not found');
        }
        BusinessAccess::assertCanManage($request->attributes->get('auth'), $business);

        return $business;
    }

    public function plan(Request $request, string $id)
    {
        $business = $this->business($request, $id);
        $data = $request->validate([
            'message' => ['required', 'string', 'min:1', 'max:1000'],
            'history' => ['sometimes', 'array', 'max:20'],
            'history.*.role' => ['required', 'in:user,assistant'],
            'history.*.text' => ['required', 'string', 'max:2000'],
        ]);

        if (! Gemini::configured()) {
            throw new ApiException(503, 'ASSISTANT_NOT_CONFIGURED', 'The assistant needs a Gemini API key on the server (GEMINI_API_KEY)');
        }

        try {
            return ApiResponse::ok(SiteAssistant::plan($business, $data['message'], $data['history'] ?? []));
        } catch (RuntimeException|ConnectionException $e) {
            Log::warning('Website assistant could not plan', ['message' => $e->getMessage()]);
            throw str_contains($e->getMessage(), 'HTTP 429')
                ? new ApiException(429, 'ASSISTANT_BUSY', 'The assistant has reached its free limit for now — try again later, or make the change in the sections below')
                : new ApiException(502, 'ASSISTANT_FAILED', "Sorry, I couldn't work that out just now — please try again");
        }
    }

    public function apply(Request $request, string $id)
    {
        $business = $this->business($request, $id);
        $request->validate([
            'actions' => ['required', 'array', 'min:1', 'max:20'],
            'actions.*' => ['array'],
            'actions.*.type' => ['required', 'string'],
        ]);

        // The whole actions, not just the validated "type" keys: SiteAssistant
        // checks each one's contents itself.
        $done = SiteAssistant::apply($request->attributes->get('auth'), $business, $request->input('actions'));

        return ApiResponse::ok(['applied' => $done]);
    }
}
