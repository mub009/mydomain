<?php

namespace App\Support;

use Illuminate\Http\JsonResponse;

class ApiResponse
{
    public static function ok(mixed $data, int $status = 200): JsonResponse
    {
        return response()->json(['success' => true, 'data' => $data], $status);
    }

    public static function created(mixed $data): JsonResponse
    {
        return self::ok($data, 201);
    }

    public static function noContent(): JsonResponse
    {
        return response()->json(null, 204);
    }

    public static function paginated(iterable $items, array $meta): JsonResponse
    {
        $total = $meta['total'];
        $pageSize = $meta['pageSize'];

        return response()->json([
            'success' => true,
            'data' => $items,
            'meta' => [
                'page' => $meta['page'],
                'pageSize' => $pageSize,
                'total' => $total,
                'totalPages' => $pageSize > 0 ? (int) ceil($total / $pageSize) ?: 1 : 1,
            ],
        ]);
    }
}
