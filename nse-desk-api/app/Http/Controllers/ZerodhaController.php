<?php

namespace App\Http\Controllers;

use App\Models\BrokerAccount;
use App\Models\BrokerHolding;
use App\Models\KiteApp;
use App\Services\Kite;
use App\Services\KiteException;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
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
    /**
     * The user's apps and accounts with their saved holdings and positions (from the database,
     * so they stay visible after the daily session ends), plus totals across accounts.
     * An account connected but never synced is synced now.
     */
    public function index(Request $request): JsonResponse
    {
        $user = $request->user();
        foreach ($this->accounts($user) as $acc) {
            if ($acc->synced_at === null && $acc->connected()) {
                $this->sync($acc);
            }
        }

        return response()->json($this->payload($user));
    }

    /**
     * Fetch every connected account again from Zerodha and save the result: stocks that were
     * sold are removed, new ones added. Says what changed.
     */
    public function refresh(Request $request): JsonResponse
    {
        $user = $request->user();
        $removed = [];
        $added = [];
        $errors = [];
        foreach ($this->accounts($user) as $acc) {
            if (! $acc->connected()) {
                continue;
            }
            $r = $this->sync($acc);
            if (isset($r['error'])) {
                $errors[] = ['accountId' => $acc->id, 'clientId' => $acc->client_id, 'message' => $r['error']];

                continue;
            }
            foreach ($r['removed'] as $h) {
                $removed[] = ['accountId' => $acc->id, 'clientId' => $acc->client_id] + $h;
            }
            foreach ($r['added'] as $h) {
                $added[] = ['accountId' => $acc->id, 'clientId' => $acc->client_id] + $h;
            }
        }

        return response()->json($this->payload($user) + ['refreshed' => ['removed' => $removed, 'added' => $added, 'errors' => $errors]]);
    }

    /** @return \Illuminate\Support\Collection<int, BrokerAccount> */
    private function accounts($user)
    {
        return $user->brokerAccounts()->where('broker', 'zerodha')->with('kiteApp')->orderBy('id')->get();
    }

    /**
     * Replace an account's saved holdings and positions with what Zerodha has now.
     * Returns the holdings removed (sold) and added, or an error. An ended session
     * clears the token but keeps the saved data.
     */
    private function sync(BrokerAccount $acc): array
    {
        try {
            $p = Kite::portfolio($acc->kiteApp->credentials(), $acc->access_token);
        } catch (KiteException $e) {
            if ($e->sessionEnded()) {
                $acc->update(['access_token' => null, 'expires_at' => null]);

                return ['error' => 'The Zerodha session has ended. Reconnect to refresh.'];
            }

            return ['error' => $e->getMessage()];
        }
        $key = fn (array $h, string $kind) => $kind.'|'.$h['exchange'].'|'.$h['symbol'].'|'.($h['product'] ?? '');
        $before = $acc->holdings()->where('kind', 'holding')->get()->keyBy(fn ($h) => $h->exchange.'|'.$h->symbol);
        $now = collect($p['holdings'])->keyBy(fn ($h) => $h['exchange'].'|'.$h['symbol']);
        $removed = $before->diffKeys($now)->map(fn ($h) => ['symbol' => $h->symbol, 'exchange' => $h->exchange, 'qty' => $h->qty])->values()->all();
        $added = $acc->synced_at === null ? [] : $now->diffKeys($before)->map(fn ($h) => ['symbol' => $h['symbol'], 'exchange' => $h['exchange'], 'qty' => $h['qty']])->values()->all();

        DB::transaction(function () use ($acc, $p) {
            $acc->holdings()->delete();
            $rows = [];
            $at = now();
            foreach ($p['holdings'] as $h) {
                $rows[] = [
                    'broker_account_id' => $acc->id, 'kind' => 'holding', 'symbol' => $h['symbol'], 'exchange' => $h['exchange'], 'product' => '',
                    'qty' => $h['qty'], 'avg_price' => $h['avgPrice'], 'last_price' => $h['lastPrice'], 'close_price' => $h['closePrice'],
                    'pnl' => $h['pnl'], 'm2m' => null, 'day_change_pct' => $h['dayChangePct'], 'created_at' => $at, 'updated_at' => $at,
                ];
            }
            foreach ($p['positions'] as $h) {
                $rows[] = [
                    'broker_account_id' => $acc->id, 'kind' => 'position', 'symbol' => $h['symbol'], 'exchange' => $h['exchange'], 'product' => $h['product'] ?? '',
                    'qty' => $h['qty'], 'avg_price' => $h['avgPrice'], 'last_price' => $h['lastPrice'], 'close_price' => null,
                    'pnl' => $h['pnl'], 'm2m' => $h['m2m'] ?? null, 'day_change_pct' => null, 'created_at' => $at, 'updated_at' => $at,
                ];
            }
            foreach (array_chunk($rows, 200) as $chunk) {
                BrokerHolding::insert($chunk);
            }
            $acc->update(['synced_at' => $at]);
        });

        return ['removed' => $removed, 'added' => $added];
    }

    /** The saved state for the page: apps, accounts with holdings and positions, and combined totals. */
    private function payload($user): array
    {
        $apps = $user->kiteApps()->orderBy('id')->get();
        $accounts = [];
        $expired = false;
        foreach ($this->accounts($user)->load('holdings') as $acc) {
            $connected = $acc->connected();
            $expired = $expired || ! $connected;
            $holdings = $acc->holdings->where('kind', 'holding')->map(fn (BrokerHolding $h) => $this->holdingJson($h))->sortByDesc('value')->values()->all();
            $positions = $acc->holdings->where('kind', 'position')->map(fn (BrokerHolding $h) => [
                'symbol' => $h->symbol, 'exchange' => $h->exchange, 'product' => $h->product, 'qty' => $h->qty,
                'avgPrice' => $h->avg_price, 'lastPrice' => $h->last_price, 'pnl' => $h->pnl, 'm2m' => $h->m2m ?? 0,
            ])->values()->all();
            $invested = array_sum(array_column($holdings, 'invested'));
            $value = array_sum(array_column($holdings, 'value'));
            $day = array_sum(array_map(fn ($h) => $h['qty'] * ($h['lastPrice'] - $h['closePrice']), $holdings));
            $accounts[] = [
                'id' => $acc->id, 'appId' => $acc->kite_app_id, 'connected' => $connected,
                'user' => ['id' => $acc->client_id, 'name' => $acc->name],
                'expiresAt' => $acc->expires_at?->toIso8601String(), 'syncedAt' => $acc->synced_at?->toIso8601String(),
                'holdings' => $holdings, 'positions' => $positions,
                'totals' => Kite::totals($invested, $value, $day, array_sum(array_column($positions, 'pnl'))),
            ];
        }
        $t = array_column($accounts, 'totals');
        $combined = count($t) > 1 ? Kite::totals(
            array_sum(array_column($t, 'invested')), array_sum(array_column($t, 'value')),
            array_sum(array_column($t, 'dayPnl')), array_sum(array_column($t, 'positionsPnl')),
        ) : null;

        return [
            'configured' => $apps->isNotEmpty(),
            'apps' => $apps->map(fn (KiteApp $a) => $this->appJson($a))->values(),
            'redirectUrl' => url('/api/zerodha/callback'),
            'accounts' => $accounts, 'combined' => $combined, 'expired' => $expired, 'at' => now()->toIso8601String(),
        ];
    }

    private function holdingJson(BrokerHolding $h): array
    {
        $invested = $h->qty * $h->avg_price;
        $value = $h->qty * $h->last_price;

        return [
            'symbol' => $h->symbol, 'exchange' => $h->exchange, 'qty' => $h->qty,
            'avgPrice' => $h->avg_price, 'lastPrice' => $h->last_price, 'closePrice' => $h->close_price ?? $h->last_price,
            'invested' => round($invested, 2), 'value' => round($value, 2), 'pnl' => $h->pnl,
            'pnlPct' => $invested ? round(($value - $invested) / $invested * 100, 2) : 0,
            'dayChangePct' => $h->day_change_pct ?? 0,
        ];
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
            if ($acc->access_token) {
                Kite::endSession($app->credentials(), $acc->access_token);
            }
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
        $acc = BrokerAccount::updateOrCreate(
            ['user_id' => $app->user_id, 'broker' => 'zerodha', 'client_id' => $s['client_id']],
            ['kite_app_id' => $app->id, 'name' => $s['name'], 'access_token' => $s['token'], 'expires_at' => Kite::sessionExpiry()],
        );
        $this->sync($acc->load('kiteApp')); // save the holdings now; a failure here just leaves them for the next refresh

        return $back('connected');
    }

    /** Removes one account: ends its Kite session and deletes its saved holdings. */
    public function destroy(Request $request, BrokerAccount $account): JsonResponse
    {
        abort_unless($account->user_id === $request->user()->id, 404);
        if ($account->kiteApp && $account->access_token) {
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
