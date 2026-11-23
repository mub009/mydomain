<?php

use App\Http\Controllers\AuthController;
use App\Http\Controllers\ZerodhaController;
use Illuminate\Support\Facades\Route;

Route::middleware('throttle:10,1')->group(function () {
    Route::post('/auth/register', [AuthController::class, 'register']);
    Route::post('/auth/login', [AuthController::class, 'login']);
});

// Zerodha's Redirect URL: the browser arrives here without our token.
Route::get('/zerodha/callback', [ZerodhaController::class, 'callback']);

Route::middleware('auth:sanctum')->group(function () {
    Route::get('/auth/me', [AuthController::class, 'me']);
    Route::post('/auth/logout', [AuthController::class, 'logout']);
    Route::put('/auth/profile', [AuthController::class, 'updateProfile']);
    Route::put('/auth/password', [AuthController::class, 'updatePassword'])->middleware('throttle:10,1');
    Route::get('/auth/devices', [AuthController::class, 'devices']);
    Route::post('/auth/logout-others', [AuthController::class, 'logoutOthers']);
    Route::delete('/auth/account', [AuthController::class, 'destroy'])->middleware('throttle:10,1');

    Route::get('/zerodha', [ZerodhaController::class, 'index']);
    Route::post('/zerodha/connect', [ZerodhaController::class, 'connect']);
    Route::delete('/zerodha/accounts/{account}', [ZerodhaController::class, 'destroy']);
});
