<?php

namespace App\Http\Controllers;

use App\Models\BrokerAccount;
use App\Models\KiteApp;
use App\Services\Kite;
use App\Services\KiteException;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;

/**
 * Zerodha for the logged-in user: their own Kite Connect apps (saved in the
 * database), connecting accounts through Kite's login, and holdings and
 * positions (read-only).
 */
class ZerodhaController extends Controller
{
    /** The user's apps and connected accounts with holdings and positions, plus totals across them. */
    public function index(Request $request): JsonResponse
    {
        $user = $request->user();
        $apps = $user->kiteApps()->orderBy('id')->get();
        $expired = false;
        $accounts = [];
        foreach ($user->brokerAccounts()->where('broker', 'zerodha')->with('kiteApp')->orderBy('id')->get() as $acc) {
            if (! $acc->kiteApp || $acc->expires_at->isPast()) {
                $acc->delete();
                $expired = true;

                continue;
            }
            $base = [
                'id' => $acc->id, 'appId' => $acc->kite_app_id, 'connected' => true,
                'user' => ['id' => $acc->client_id, 'name' => $acc->name], 'expiresAt' => $acc->expires_at->toIso8601String(),
            ];
            try {
                $accounts[] = $base + Kite::portfolio($acc->kiteApp->credentials(), $acc->access_token);
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
            'configured' => $apps->isNotEmpty(),
            'apps' => $apps->map(fn (KiteApp $a) => $this->appJson($a))->values(),
            'redirectUrl' => url('/api/zerodha/callback'),
            'accounts' => $accounts, 'combined' => $combined, 'expired' => $expired, 'at' => now()->toIso8601String(),
        ]);
    }

    /** Save a Kite Connect app (API key and secret from developers.kite.trade). */
    public function storeApp(Request $request): JsonResponse
    {
        $user = $request->user();
        $data = $request->validate([
            'label' => ['nullable', 'string', 'max:60'],
            'api_key' => ['required', 'string', 'regex:/^[A-Za-z0-9]{6,64}$/', Rule::unique('kite_apps', 'api_key')->where('user_id', $user->id)],
            'api_secret' => ['required', 'string', 'regex:/^[A-Za-z0-9]{6,128}$/'],
        ], [
            'api_key.regex' => 'That doesn\'t look like a Kite API key (letters and numbers only).',
            'api_secret.regex' => 'That doesn\'t look like a Kite API secret (letters and numbers only).',
            'api_key.unique' => 'You have already added this app.',
        ]);
        if ($user->kiteApps()->count() >= 10) {
            return response()->json(['message' => 'You can add up to 10 Kite Connect apps.'], 422);
        }
        $app = $user->kiteApps()->create(['label' => $data['label'] ?? null, 'api_key' => $data['api_key'], 'api_secret' => $data['api_secret']]);

        return response()->json(['app' => $this->appJson($app)], 201);
    }

    /** Remove an app; accounts connected through it are disconnected. */
    public function destroyApp(Request $request, KiteApp $app): JsonResponse
    {
        abort_unless($app->user_id === $request->user()->id, 404);
        foreach ($app->accounts as $acc) {
            Kite::endSession($app->credentials(), $acc->access_token);
        }
        $app->delete();

        return response()->json(['ok' => true]);
    }

    /** Starts a Zerodha login through one of the user's apps: returns the Kite login URL to open. */
    public function connect(Request $request): JsonResponse
    {
        $user = $request->user();
        $app = $request->filled('app_id')
            ? $user->kiteApps()->find($request->integer('app_id'))
            : $user->kiteApps()->orderBy('id')->first();
        if (! $app) {
            return response()->json(['message' => 'Add your Kite Connect app first.'], 422);
        }
        // Zerodha returns the browser to the callback without our token, so a
        // one-time value ties the login to this user and app for 10 minutes.
        $state = Str::random(40);
        Cache::put("kite_state:{$state}", ['user' => $user->id, 'app' => $app->id], now()->addMinutes(10));

        return response()->json(['url' => Kite::loginUrl($app->credentials(), $state)]);
    }

    /** Zerodha sends the browser here after login (every app's Redirect URL). */
    public function callback(Request $request): RedirectResponse
    {
        $back = fn (string $q) => redirect()->away(rtrim(config('services.frontend_url'), '/')."/positions?broker={$q}");
        $token = (string) $request->query('request_token');
        $state = Cache::pull('kite_state:'.$request->query('state'));
        if ($request->query('status') !== 'success' || ! preg_match('/^[A-Za-z0-9]{6,64}$/', $token)) {
            return $back('cancelled');
        }
        $app = $state ? KiteApp::where('id', $state['app'])->where('user_id', $state['user'])->first() : null;
        if (! $app) {
            return $back('failed');
        }
        try {
            $s = Kite::createSession($app->credentials(), $token);
        } catch (KiteException $e) {
            Log::warning('Zerodha login failed', ['app' => $app->id, 'error' => $e->getMessage()]);

            return $back('failed');
        }
        BrokerAccount::updateOrCreate(
            ['user_id' => $app->user_id, 'broker' => 'zerodha', 'client_id' => $s['client_id']],
            ['kite_app_id' => $app->id, 'name' => $s['name'], 'access_token' => $s['token'], 'expires_at' => Kite::sessionExpiry()],
        );

        return $back('connected');
    }

    /** Disconnects one account (ends its Kite session). */
    public function destroy(Request $request, BrokerAccount $account): JsonResponse
    {
        abort_unless($account->user_id === $request->user()->id, 404);
        if ($account->kiteApp) {
            Kite::endSession($account->kiteApp->credentials(), $account->access_token);
        }
        $account->delete();

        return response()->json(['ok' => true]);
    }

    private function appJson(KiteApp $a): array
    {
        return ['id' => $a->id, 'label' => $a->label, 'apiKey' => $a->maskedKey(), 'accounts' => $a->accounts()->count()];
    }
}
