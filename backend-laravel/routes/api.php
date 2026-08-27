<?php

use App\Http\Controllers\AuthController;
use App\Http\Controllers\BusinessController;
use App\Http\Controllers\CategoryController;
use App\Http\Controllers\ReviewController;
use App\Http\Controllers\SearchController;
use App\Http\Controllers\UserController;
use Illuminate\Support\Facades\Route;

Route::middleware('throttle:auth')->prefix('auth')->group(function () {
    Route::post('/register', [AuthController::class, 'register']);
    Route::post('/login', [AuthController::class, 'login']);
});
Route::prefix('auth')->group(function () {
    Route::post('/refresh', [AuthController::class, 'refresh']);
    Route::post('/logout', [AuthController::class, 'logout']);
    Route::get('/me', [AuthController::class, 'me'])->middleware('auth.jwt');
});

Route::prefix('categories')->group(function () {
    Route::get('/', [CategoryController::class, 'index']);
    Route::get('/{slug}', [CategoryController::class, 'show']);
    Route::middleware(['auth.jwt', 'role:ADMIN'])->group(function () {
        Route::post('/', [CategoryController::class, 'store']);
        Route::patch('/{id}', [CategoryController::class, 'update']);
        Route::delete('/{id}', [CategoryController::class, 'destroy']);
    });
});

Route::prefix('businesses')->group(function () {
    Route::get('/', [BusinessController::class, 'index']);
    Route::get('/mine', [BusinessController::class, 'mine'])
        ->middleware(['auth.jwt', 'role:BUSINESS_OWNER,DEALER,ADMIN']);
    Route::get('/{id}/manage', [BusinessController::class, 'manage'])->middleware('auth.jwt');
    Route::get('/{slug}', [BusinessController::class, 'show']);

    Route::middleware(['auth.jwt', 'privilege:MANAGE_LISTINGS'])->group(function () {
        Route::post('/', [BusinessController::class, 'store'])->middleware('role:BUSINESS_OWNER,DEALER,ADMIN');
        Route::patch('/{id}', [BusinessController::class, 'update']);
        Route::delete('/{id}', [BusinessController::class, 'destroy']);
        Route::post('/{id}/submit', [BusinessController::class, 'submit']);

        Route::post('/{id}/photos', [BusinessController::class, 'addPhoto']);
        Route::delete('/{id}/photos/{photoId}', [BusinessController::class, 'removePhoto']);

        Route::put('/{id}/hours', [BusinessController::class, 'setHours']);

        Route::post('/{id}/services', [BusinessController::class, 'addService']);
        Route::patch('/{id}/services/{serviceId}', [BusinessController::class, 'updateService']);
        Route::delete('/{id}/services/{serviceId}', [BusinessController::class, 'deleteService']);
    });

    Route::post('/{businessId}/reviews', [ReviewController::class, 'store'])->middleware('auth.jwt');
    Route::get('/{businessId}/reviews', [ReviewController::class, 'index']);
});

Route::prefix('reviews')->middleware('auth.jwt')->group(function () {
    Route::post('/{reviewId}/reply', [ReviewController::class, 'reply']);
    Route::delete('/{reviewId}', [ReviewController::class, 'destroy']);
});

Route::prefix('search')->group(function () {
    Route::get('/cities', [SearchController::class, 'cities']);
    Route::get('/', [SearchController::class, 'index']);
});

Route::prefix('users')->middleware(['auth.jwt', 'role:DEALER,ADMIN'])->group(function () {
    Route::get('/created', [UserController::class, 'listCreated']);
    Route::patch('/{id}/password', [UserController::class, 'resetPassword']);
});
