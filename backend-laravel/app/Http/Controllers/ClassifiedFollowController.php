<?php

namespace App\Http\Controllers;

use App\Exceptions\ApiException;
use App\Models\ClassifiedFollow;
use App\Models\User;
use App\Support\ApiResponse;
use App\Support\Pagination;
use Illuminate\Http\Request;

class ClassifiedFollowController extends Controller
{
    public function store(Request $request, string $sellerId)
    {
        $actor = $request->attributes->get('auth');
        if ($sellerId === $actor['sub']) {
            throw ApiException::badRequest('You cannot follow yourself');
        }
        if (! User::where('id', $sellerId)->exists()) {
            throw ApiException::notFound('Seller not found');
        }

        ClassifiedFollow::firstOrCreate(['followerId' => $actor['sub'], 'sellerId' => $sellerId]);

        return ApiResponse::created(['sellerId' => $sellerId]);
    }

    public function destroy(Request $request, string $sellerId)
    {
        $actor = $request->attributes->get('auth');
        ClassifiedFollow::where('followerId', $actor['sub'])->where('sellerId', $sellerId)->delete();

        return ApiResponse::noContent();
    }

    // Sellers I follow, so "My follows" can list them.
    public function index(Request $request)
    {
        $actor = $request->attributes->get('auth');
        $pagination = Pagination::parse($request->query());

        $query = ClassifiedFollow::where('followerId', $actor['sub']);
        $total = (clone $query)->count();
        $sellers = $query->orderByDesc('createdAt')
            ->skip($pagination['skip'])->take($pagination['take'])
            ->with('seller:id,firstName,lastName')
            ->get()
            ->pluck('seller')
            ->filter()
            ->values();

        return ApiResponse::paginated($sellers, ['page' => $pagination['page'], 'pageSize' => $pagination['pageSize'], 'total' => $total]);
    }

    // Used on a seller profile page to show "Following" vs "Follow" and a
    // follower count, for whoever is (or isn't) signed in.
    public function status(Request $request, string $sellerId)
    {
        $actor = $request->attributes->get('auth');
        $followerCount = ClassifiedFollow::where('sellerId', $sellerId)->count();
        $following = $actor ? ClassifiedFollow::where('followerId', $actor['sub'])->where('sellerId', $sellerId)->exists() : false;

        return ApiResponse::ok(['following' => $following, 'followerCount' => $followerCount]);
    }
}
