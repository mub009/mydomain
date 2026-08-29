<?php

use App\Http\Controllers\QrCodeController;
use Illuminate\Support\Facades\Route;

Route::get('/health', function () {
    return response()->json(['status' => 'ok', 'timestamp' => now()->toIso8601String()]);
});

// Short public path encoded on a printed QR board: /r/q/<code>
Route::get('/r/q/{code}', [QrCodeController::class, 'scan']);

// The React SPA (frontend/dist) is deployed into public/ alongside
// Laravel — see backend-laravel/README.md "Deploying the frontend
// together with this backend". Everything not matched above falls
// through to the SPA's own index.html so client-side routes like
// /business/some-slug work on a hard refresh. A bad api/v1/* request
// must still get Laravel's normal JSON 404, not HTML, so those are
// excluded — index.html doesn't exist until the frontend has actually
// been built and copied in, so this degrades to Laravel's own 404
// until then.
Route::fallback(function (\Illuminate\Http\Request $request) {
    if ($request->is('api/*')) {
        abort(404);
    }

    $spaIndex = public_path('index.html');
    if (! file_exists($spaIndex)) {
        abort(404);
    }

    return response()->file($spaIndex);
});
