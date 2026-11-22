<?php

namespace App\Http\Controllers;

use App\Models\BrokerAccount;
use App\Services\Kite;
use App\Services\KiteException;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;

/**
 * Zerodha accounts for the logged-in user: connect (Kite login), list with
 * holdings and positions (read-only), disconnect.
 */
class ZerodhaController extends Controller
{
    /** The user's connected accounts with holdings and positions, plus totals across them. */
    public function index(Request $request): JsonResponse
    {
        $apps = Kite::apps();
        if (! $apps) {
            return response()->json(['configured' => false, 'apps' => [], 'accounts' => []]);
        }
        $expired = false;
        $accounts = [];
        foreach ($request->user()->brokerAccounts()->where('broker', 'zerodha')->orderBy('id')->get() as $acc) {
            $app = $apps[$acc->app_slot] ?? null;
            if (! $app || $acc->expires_at->isPast()) {
                $acc->delete();
                $expired = true;

                continue;
            }
            $base = [
                'id' => $acc->id, 'slot' => $acc->app_slot, 'connected' => true,
                'user' => ['id' => $acc->client_id, 'name' => $acc->name], 'expiresAt' => $acc->expires_at->toIso8601String(),
            ];
            try {
                $accounts[] = $base + Kite::portfolio($app, $acc->access_token);
            } catch (KiteException $e) {
                if ($e->sessionEnded()) {
                    $acc->delete();
                    $expired = true;
                } else {
                    $accounts[] = $base + ['error' => $e->getMessage()];
                }
            }
        }
        $t = array_values(array_filter(array_map(fn ($a) => $a['totals'] ?? null, $accounts)));
        $combined = count($t) > 1 ? Kite::totals(
            array_sum(array_column($t, 'invested')), array_sum(array_column($t, 'value')),
            array_sum(array_column($t, 'dayPnl')), array_sum(array_column($t, 'positionsPnl')),
        ) : null;

        return response()->json([
            'configured' => true, 'apps' => array_keys($apps), 'accounts' => $accounts,
            'combined' => $combined, 'expired' => $expired, 'at' => now()->toIso8601String(),
        ]);
    }

    /** Starts a Zerodha login: returns the Kite login URL to open. */
    public function connect(Request $request): JsonResponse
    {
        $slot = (int) $request->input('slot', array_key_first(Kite::apps()) ?? 1);
        $app = Kite::app($slot);
        if (! $app) {
            return response()->json(['message' => 'Zerodha is not set up on the server.'], 422);
        }
        // Zerodha returns the browser to the callback without our token, so a
        // one-time value ties the login to this user for 10 minutes.
        $state = Str::random(40);
        Cache::put("kite_state:{$state}", ['user' => $request->user()->id, 'slot' => $slot], now()->addMinutes(10));

        return response()->json(['url' => Kite::loginUrl($app, $state)]);
    }

    /** Zerodha sends the browser here after login (the app's Redirect URL). */
    public function callback(Request $request): RedirectResponse
    {
        $back = fn (string $q) => redirect()->away(rtrim(config('services.frontend_url'), '/')."/positions?broker={$q}");
        $token = (string) $request->query('request_token');
        $state = Cache::pull('kite_state:'.$request->query('state'));
        if ($request->query('status') !== 'success' || ! preg_match('/^[A-Za-z0-9]{6,64}$/', $token)) {
            return $back('cancelled');
        }
        if (! $state || ! ($app = Kite::app($state['slot']))) {
            return $back('failed');
        }
        try {
            $s = Kite::createSession($app, $token);
        } catch (KiteException $e) {
            Log::warning('Zerodha login failed', ['slot' => $state['slot'], 'error' => $e->getMessage()]);

            return $back('failed');
        }
        BrokerAccount::updateOrCreate(
            ['user_id' => $state['user'], 'broker' => 'zerodha', 'client_id' => $s['client_id']],
            ['app_slot' => $app['slot'], 'name' => $s['name'], 'access_token' => $s['token'], 'expires_at' => Kite::sessionExpiry()],
        );

        return $back('connected');
    }

    /** Disconnects one account (ends its Kite session). */
    public function destroy(Request $request, BrokerAccount $account): JsonResponse
    {
        abort_unless($account->user_id === $request->user()->id, 404);
        if ($app = Kite::app($account->app_slot)) {
            Kite::endSession($app, $account->access_token);
        }
        $account->delete();

        return response()->json(['ok' => true]);
    }
}
