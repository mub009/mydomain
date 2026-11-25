<?php

namespace App\Http\Controllers;

use App\Models\WatchlistItem;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/** The logged-in user's watchlist: stocks to keep an eye on, separate from holdings. */
class WatchlistController extends Controller
{
    public const MAX = 200;

    public function index(Request $request): JsonResponse
    {
        return response()->json(['items' => $request->user()->watchlist()->orderByDesc('id')->get()->map(fn ($i) => $this->json($i))->values()]);
    }

    /** Add a stock (or update its note); adding one already on the list is fine. */
    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'symbol' => ['required', 'string', 'max:20', 'regex:/^[A-Za-z0-9&\-.]{1,20}$/'],
            'note' => ['nullable', 'string', 'max:200'],
            'price' => ['nullable', 'numeric', 'min:0', 'max:100000000'],
        ], ['symbol.regex' => 'That isn\'t an NSE symbol.']);
        $user = $request->user();
        $symbol = strtoupper($data['symbol']);
        $item = $user->watchlist()->where('symbol', $symbol)->first();
        if (! $item && $user->watchlist()->count() >= self::MAX) {
            return response()->json(['message' => 'Your watchlist is full ('.self::MAX.' stocks). Remove some first.'], 422);
        }
        $item ??= new WatchlistItem(['user_id' => $user->id, 'symbol' => $symbol, 'added_price' => $data['price'] ?? null]);
        if (array_key_exists('note', $data)) {
            $item->note = $data['note'];
        }
        $created = ! $item->exists;
        $item->save();

        return response()->json(['item' => $this->json($item)], $created ? 201 : 200);
    }

    public function destroy(Request $request, string $symbol): JsonResponse
    {
        $request->user()->watchlist()->where('symbol', strtoupper($symbol))->delete();

        return response()->json(['ok' => true]);
    }

    private function json(WatchlistItem $i): array
    {
        return ['symbol' => $i->symbol, 'note' => $i->note, 'addedPrice' => $i->added_price, 'addedAt' => $i->created_at?->toIso8601String()];
    }
}
