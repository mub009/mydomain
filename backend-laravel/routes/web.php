<?php

use App\Http\Controllers\QrCodeController;
use Illuminate\Support\Facades\Route;

Route::get('/', function () {
    return view('welcome');
});

Route::get('/health', function () {
    return response()->json(['status' => 'ok', 'timestamp' => now()->toIso8601String()]);
});

// Short public path encoded on a printed QR board: /r/q/<code>
Route::get('/r/q/{code}', [QrCodeController::class, 'scan']);
