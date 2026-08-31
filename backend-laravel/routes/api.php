<?php

use App\Http\Controllers\AdminController;
use App\Http\Controllers\AnalyticsController;
use App\Http\Controllers\AuthController;
use App\Http\Controllers\BookingController;
use App\Http\Controllers\BusinessController;
use App\Http\Controllers\CategoryController;
use App\Http\Controllers\ClassifiedCategoryController;
use App\Http\Controllers\ClassifiedConversationController;
use App\Http\Controllers\ClassifiedFavoriteController;
use App\Http\Controllers\ClassifiedFollowController;
use App\Http\Controllers\ClassifiedListingController;
use App\Http\Controllers\ClassifiedReportController;
use App\Http\Controllers\LeadController;
use App\Http\Controllers\OrderController;
use App\Http\Controllers\PointsController;
use App\Http\Controllers\ProductController;
use App\Http\Controllers\QrCodeController;
use App\Http\Controllers\ReviewController;
use App\Http\Controllers\ReviewLinkController;
use App\Http\Controllers\SearchController;
use App\Http\Controllers\SiteController;
use App\Http\Controllers\StorefrontController;
use App\Http\Controllers\UploadController;
use App\Http\Controllers\UserController;
use App\Http\Controllers\VisitorController;
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

// Behind every "upload an image" button — see UploadController for the
// purposes it accepts and what each is gated to.
Route::post('/uploads/image', [UploadController::class, 'image'])->middleware('auth.jwt');

Route::prefix('categories')->group(function () {
    Route::get('/', [CategoryController::class, 'index']);
    Route::get('/{slug}', [CategoryController::class, 'show']);
    Route::middleware(['auth.jwt', 'role:ADMIN'])->group(function () {
        Route::post('/', [CategoryController::class, 'store']);
        Route::patch('/{id}', [CategoryController::class, 'update']);
        Route::delete('/{id}', [CategoryController::class, 'destroy']);
    });
});

Route::prefix('classified-categories')->group(function () {
    Route::get('/', [ClassifiedCategoryController::class, 'index']);
    Route::get('/{slug}', [ClassifiedCategoryController::class, 'show']);
    Route::middleware(['auth.jwt', 'role:ADMIN'])->group(function () {
        Route::post('/', [ClassifiedCategoryController::class, 'store']);
        Route::patch('/{id}', [ClassifiedCategoryController::class, 'update']);
        Route::delete('/{id}', [ClassifiedCategoryController::class, 'destroy']);
    });
});

// OLX-style classifieds — any signed-in user can post, edit, and manage
// their own listings; browsing and viewing a listing is public.
Route::prefix('classifieds')->group(function () {
    Route::get('/', [ClassifiedListingController::class, 'index']);
    // All of these must be registered ahead of the "/{id}" show route below,
    // or they'd be swallowed as a listing id.
    Route::middleware('auth.jwt')->group(function () {
        Route::get('/mine', [ClassifiedListingController::class, 'mine']);
        Route::get('/favorites', [ClassifiedFavoriteController::class, 'index']);
        Route::post('/', [ClassifiedListingController::class, 'store']);
        Route::get('/following', [ClassifiedFollowController::class, 'index']);
        Route::get('/conversations', [ClassifiedConversationController::class, 'index']);
        Route::get('/conversations/unread-count', [ClassifiedConversationController::class, 'unreadCount']);
        Route::get('/conversations/{id}/messages', [ClassifiedConversationController::class, 'messages']);
        Route::post('/conversations/{id}/messages', [ClassifiedConversationController::class, 'reply']);
        Route::post('/conversations/{id}/read', [ClassifiedConversationController::class, 'markRead']);
    });
    Route::get('/sellers/{sellerId}', [ClassifiedListingController::class, 'sellerProfile']);
    Route::get('/sellers/{sellerId}/follow', [ClassifiedFollowController::class, 'status'])->middleware('auth.optional');
    Route::middleware('auth.jwt')->group(function () {
        Route::post('/sellers/{sellerId}/follow', [ClassifiedFollowController::class, 'store']);
        Route::delete('/sellers/{sellerId}/follow', [ClassifiedFollowController::class, 'destroy']);
    });
    Route::get('/batch', [ClassifiedListingController::class, 'batch']);
    Route::get('/{id}', [ClassifiedListingController::class, 'show']);

    Route::middleware('auth.jwt')->group(function () {
        Route::patch('/{id}', [ClassifiedListingController::class, 'update']);
        Route::delete('/{id}', [ClassifiedListingController::class, 'destroy']);
        Route::post('/{id}/sold', [ClassifiedListingController::class, 'markSold']);
        Route::post('/{id}/pause', [ClassifiedListingController::class, 'pause']);
        Route::post('/{id}/activate', [ClassifiedListingController::class, 'activate']);
        Route::post('/{id}/renew', [ClassifiedListingController::class, 'renew']);
        Route::post('/{id}/favorite', [ClassifiedFavoriteController::class, 'store']);
        Route::delete('/{id}/favorite', [ClassifiedFavoriteController::class, 'destroy']);
        Route::post('/{id}/messages', [ClassifiedConversationController::class, 'store']);
        Route::post('/{id}/reports', [ClassifiedReportController::class, 'store']);
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

    // Anonymous visitors can leave a lead (e.g. a contact-form callback
    // request); listing them still requires owning the business.
    Route::post('/{businessId}/leads', [LeadController::class, 'store'])->middleware('auth.optional');
    Route::get('/{businessId}/leads', [LeadController::class, 'index'])->middleware(['auth.jwt', 'privilege:MANAGE_LEADS']);

    Route::post('/{businessId}/bookings', [BookingController::class, 'store'])->middleware('auth.jwt');
    Route::get('/{businessId}/bookings', [BookingController::class, 'forBusiness'])->middleware(['auth.jwt', 'privilege:MANAGE_BOOKINGS']);

    // Storefront settings (site type, delivery fee, publish) and the
    // drag-and-drop brochure-website builder (starter page, template
    // preview, save-with-sanitization).
    Route::middleware('auth.jwt')->group(function () {
        Route::get('/{id}/site', [SiteController::class, 'show']);
        Route::put('/{id}/site', [SiteController::class, 'save']);
        Route::get('/{id}/site/templates/{templateId}', [SiteController::class, 'previewTemplate']);
        Route::patch('/{id}/site/type', [SiteController::class, 'updateType']);
        Route::post('/{id}/site/publish', [SiteController::class, 'publish']);
    });

    // Owner-facing catalogue, orders, and customer report.
    Route::middleware('auth.jwt')->group(function () {
        Route::get('/{id}/products', [ProductController::class, 'index']);
        Route::get('/{id}/orders', [OrderController::class, 'index']);
        Route::get('/{id}/orders/{orderId}', [OrderController::class, 'show']);
        Route::get('/{id}/customers', [OrderController::class, 'customers']);

        Route::middleware('privilege:MANAGE_LISTINGS')->group(function () {
            Route::post('/{id}/products', [ProductController::class, 'store']);
            Route::patch('/{id}/products/{productId}', [ProductController::class, 'update']);
            Route::delete('/{id}/products/{productId}', [ProductController::class, 'destroy']);
            Route::patch('/{id}/orders/{orderId}/status', [OrderController::class, 'updateStatus']);
        });
    });

    // Review links (Google/Instagram/Facebook/YouTube/website) + the QR
    // boards attached to this business.
    Route::middleware('auth.jwt')->group(function () {
        Route::get('/{id}/review-links', [ReviewLinkController::class, 'show']);
        Route::patch('/{id}/review-links', [ReviewLinkController::class, 'update'])->middleware('privilege:MANAGE_LISTINGS');
        Route::get('/{id}/qr-codes', [QrCodeController::class, 'businessQrCodes']);
        Route::patch('/{id}/qr-codes/{qrId}', [QrCodeController::class, 'setBoardChannel'])->middleware('privilege:MANAGE_LISTINGS');
    });
});

// Public: what a shopper on a published storefront can reach. Checkout is
// open to guests — most buyers will not have an account.
Route::prefix('sites')->group(function () {
    Route::get('/{slug}', [SiteController::class, 'published']);
    Route::get('/{slug}/products', [StorefrontController::class, 'publicProducts']);
    Route::post('/{slug}/orders', [StorefrontController::class, 'checkout'])->middleware('auth.optional');
});

Route::prefix('reviews')->middleware('auth.jwt')->group(function () {
    Route::post('/{reviewId}/reply', [ReviewController::class, 'reply']);
    Route::delete('/{reviewId}', [ReviewController::class, 'destroy']);
});

Route::prefix('leads')->middleware(['auth.jwt', 'privilege:MANAGE_LEADS'])->group(function () {
    Route::patch('/{leadId}/status', [LeadController::class, 'updateStatus']);
});

Route::prefix('bookings')->middleware('auth.jwt')->group(function () {
    Route::get('/mine', [BookingController::class, 'mine']);
    Route::patch('/{bookingId}/status', [BookingController::class, 'updateStatus'])->middleware('privilege:MANAGE_BOOKINGS');
});

Route::prefix('points')->middleware(['auth.jwt', 'role:DEALER,ADMIN'])->group(function () {
    Route::get('/mine', [PointsController::class, 'mine']);
    Route::get('/mine/transactions', [PointsController::class, 'mineTransactions']);
});

Route::prefix('search')->group(function () {
    Route::get('/cities', [SearchController::class, 'cities']);
    Route::get('/', [SearchController::class, 'index']);
});

Route::prefix('users')->middleware(['auth.jwt', 'role:DEALER,ADMIN'])->group(function () {
    Route::get('/created', [UserController::class, 'listCreated']);
    Route::patch('/{id}/password', [UserController::class, 'resetPassword']);
});

// Shop-facing QR board lookup/claim (the admin side is under /admin below).
Route::prefix('qr-codes')->group(function () {
    Route::get('/lookup/{code}', [QrCodeController::class, 'lookup']);
    Route::middleware(['auth.jwt', 'role:BUSINESS_OWNER,DEALER,ADMIN'])->group(function () {
        Route::get('/assignable-businesses', [QrCodeController::class, 'assignableBusinesses']);
        Route::post('/claim', [QrCodeController::class, 'claim']);
    });
});

// Public: the welcome popup posts here once the visitor consents.
Route::prefix('visitors')->group(function () {
    Route::post('/', [VisitorController::class, 'store']);
    Route::patch('/{id}/location', [VisitorController::class, 'updateLocation']);
});

// Public: every page load pings here (frontend's usePageViewTracking
// hook) — no visitor action needed. auth.optional so a logged-in view is
// attributed to that user without requiring one.
Route::post('/analytics/pageview', [AnalyticsController::class, 'pageview'])->middleware('auth.optional');

// Admin. Poster Studio is not part of this Laravel port yet — see
// backend-laravel/README.md.
Route::prefix('admin')->middleware(['auth.jwt', 'role:ADMIN'])->group(function () {
    Route::get('/stats', [AdminController::class, 'stats']);
    Route::get('/reports/business-creators', [AdminController::class, 'businessCreatorsReport']);

    Route::get('/users', [AdminController::class, 'listUsers']);
    Route::post('/users', [AdminController::class, 'createUser']);
    Route::patch('/users/{id}', [AdminController::class, 'updateUser']);
    Route::patch('/users/{id}/points', [AdminController::class, 'adjustPoints']);
    Route::get('/users/{id}/points/transactions', [AdminController::class, 'userTransactions']);

    Route::get('/businesses', [AdminController::class, 'listBusinesses']);
    Route::get('/businesses/pending', [AdminController::class, 'listPendingBusinesses']);
    Route::patch('/businesses/{id}', [AdminController::class, 'updateBusiness']);
    Route::post('/businesses/{id}/approve', [AdminController::class, 'approveBusiness']);
    Route::post('/businesses/{id}/reject', [AdminController::class, 'rejectBusiness']);
    Route::post('/businesses/{id}/suspend', [AdminController::class, 'suspendBusiness']);
    Route::post('/businesses/{id}/reassign', [AdminController::class, 'reassignBusiness']);

    Route::get('/visitors', [VisitorController::class, 'index']);

    Route::get('/analytics/online', [AnalyticsController::class, 'online']);
    Route::get('/analytics/pages', [AnalyticsController::class, 'pages']);

    Route::get('/qr-codes', [QrCodeController::class, 'index']);
    Route::post('/qr-codes/batch', [QrCodeController::class, 'generateBatch']);
    Route::patch('/qr-codes/{id}', [QrCodeController::class, 'updateAdmin']);

    Route::get('/classifieds', [AdminController::class, 'listClassifieds']);
    Route::post('/classifieds/{id}/remove', [AdminController::class, 'removeClassified']);
    Route::delete('/classifieds/{id}', [AdminController::class, 'deleteClassified']);

    Route::get('/classifieds/reports', [ClassifiedReportController::class, 'index']);
    Route::patch('/classifieds/reports/{id}', [ClassifiedReportController::class, 'updateStatus']);
});
