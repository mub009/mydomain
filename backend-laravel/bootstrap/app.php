<?php

use App\Exceptions\ApiException;
use App\Http\Middleware\OptionalAuth;
use App\Http\Middleware\RequireAuth;
use App\Http\Middleware\RequirePrivilege;
use App\Http\Middleware\RequireRole;
use Illuminate\Auth\Access\AuthorizationException;
use Illuminate\Database\Eloquent\ModelNotFoundException;
use Illuminate\Database\QueryException;
use Illuminate\Foundation\Application;
use Illuminate\Foundation\Configuration\Exceptions;
use Illuminate\Foundation\Configuration\Middleware;
use Illuminate\Validation\ValidationException;
use Symfony\Component\HttpKernel\Exception\HttpExceptionInterface;
use Symfony\Component\HttpKernel\Exception\NotFoundHttpException;

return Application::configure(basePath: dirname(__DIR__))
    ->withRouting(
        web: __DIR__.'/../routes/web.php',
        api: __DIR__.'/../routes/api.php',
        apiPrefix: 'api/v1',
        commands: __DIR__.'/../routes/console.php',
    )
    ->withMiddleware(function (Middleware $middleware) {
        $middleware->alias([
            'auth.jwt' => RequireAuth::class,
            'auth.optional' => OptionalAuth::class,
            'role' => RequireRole::class,
            'privilege' => RequirePrivilege::class,
        ]);
        $middleware->throttleApi();
    })
    ->withExceptions(function (Exceptions $exceptions) {
        $exceptions->render(function (ApiException $e) {
            return response()->json([
                'success' => false,
                'error' => ['code' => $e->errorCode, 'message' => $e->getMessage(), 'details' => $e->details],
            ], $e->statusCode);
        });

        $exceptions->render(function (ValidationException $e) {
            $issues = [];
            foreach ($e->errors() as $field => $messages) {
                foreach ($messages as $message) {
                    $issues[] = ['path' => $field, 'message' => $message];
                }
            }

            return response()->json([
                'success' => false,
                'error' => [
                    'code' => 'VALIDATION_ERROR',
                    'message' => 'Request validation failed',
                    'details' => ['fieldErrors' => $e->errors(), 'issues' => $issues],
                ],
            ], 400);
        });

        $exceptions->render(function (ModelNotFoundException $e) {
            return response()->json([
                'success' => false,
                'error' => ['code' => 'NOT_FOUND', 'message' => 'Resource not found'],
            ], 404);
        });

        $exceptions->render(function (AuthorizationException $e) {
            return response()->json([
                'success' => false,
                'error' => ['code' => 'FORBIDDEN', 'message' => $e->getMessage() ?: 'Forbidden'],
            ], 403);
        });

        $exceptions->render(function (NotFoundHttpException $e, $request) {
            if ($request->is('api/*')) {
                return response()->json([
                    'success' => false,
                    'error' => ['code' => 'NOT_FOUND', 'message' => "Route {$request->method()} {$request->path()} not found"],
                ], 404);
            }
        });

        $exceptions->render(function (QueryException $e) {
            // MySQL 1062 / SQLite unique-constraint violations.
            if ($e->getCode() === '23000') {
                return response()->json([
                    'success' => false,
                    'error' => ['code' => 'CONFLICT', 'message' => 'A record with these unique fields already exists'],
                ], 409);
            }

            report($e);

            return response()->json([
                'success' => false,
                'error' => [
                    'code' => 'INTERNAL_ERROR',
                    'message' => 'Something went wrong on the server. Check the backend logs for details.',
                    'details' => config('app.debug') ? ['reason' => $e->getMessage()] : null,
                ],
            ], 500);
        });

        $exceptions->render(function (HttpExceptionInterface $e, $request) {
            if ($request->is('api/*')) {
                return response()->json([
                    'success' => false,
                    'error' => ['code' => 'HTTP_ERROR', 'message' => $e->getMessage() ?: 'Request failed'],
                ], $e->getStatusCode());
            }
        });

        $exceptions->render(function (\Throwable $e, $request) {
            if (! $request->is('api/*')) {
                return null;
            }

            report($e);

            return response()->json([
                'success' => false,
                'error' => [
                    'code' => 'INTERNAL_ERROR',
                    'message' => 'Something went wrong on the server. Check the backend logs for details.',
                    'details' => config('app.debug') ? ['reason' => $e->getMessage()] : null,
                ],
            ], 500);
        });
    })->create();
