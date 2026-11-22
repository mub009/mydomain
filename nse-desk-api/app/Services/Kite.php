<?php

namespace App\Services;

use Carbon\CarbonImmutable;
use Illuminate\Http\Client\Response;
use Illuminate\Support\Facades\Http;

/**
 * Zerodha Kite Connect v3, read-only: login, holdings and positions.
 *
 * Apps come from KITE_API_KEY / KITE_API_SECRET, then _2 … _5 for accounts
 * Zerodha won't allow on the first app. One app can hold several accounts
 * when Zerodha allows it.
 */
class Kite
{
    /** @return array<int, array{slot:int, key:string, secret:string}> */
    public static function apps(): array
    {
        $out = [];
        foreach (config('services.kite.apps') as $slot => $app) {
            if (! empty($app['key']) && ! empty($app['secret'])) {
                $out[$slot] = ['slot' => $slot, 'key' => $app['key'], 'secret' => $app['secret']];
            }
        }

        return $out;
    }

    public static function app(int $slot): ?array
    {
        return self::apps()[$slot] ?? null;
    }

    public static function loginUrl(array $app, string $state): string
    {
        return rtrim(config('services.kite.login_root'), '/').'/connect/login?'.http_build_query([
            'v' => 3, 'api_key' => $app['key'], 'redirect_params' => 'state='.$state,
        ]);
    }

    /** Kite's checksum: SHA-256 of api_key + request_token + api_secret. */
    public static function checksum(string $key, string $requestToken, string $secret): string
    {
        return hash('sha256', $key.$requestToken.$secret);
    }

    /** Kite sessions end at the next 06:00 IST. */
    public static function sessionExpiry(?CarbonImmutable $now = null): CarbonImmutable
    {
        $now = ($now ?? CarbonImmutable::now())->setTimezone('Asia/Kolkata');
        $six = $now->setTime(6, 0);

        return ($six->greaterThan($now) ? $six : $six->addDay())->utc();
    }

    /** Swap the one-time request token for a session. */
    public static function createSession(array $app, string $requestToken): array
    {
        $d = self::call('post', '/session/token', null, $app['key'], [
            'api_key' => $app['key'],
            'request_token' => $requestToken,
            'checksum' => self::checksum($app['key'], $requestToken, $app['secret']),
        ]);

        return ['token' => $d['access_token'], 'client_id' => $d['user_id'], 'name' => $d['user_name'] ?? null];
    }

    public static function endSession(array $app, string $token): void
    {
        try {
            self::call('delete', '/session/token?'.http_build_query(['api_key' => $app['key'], 'access_token' => $token]), $token, $app['key']);
        } catch (KiteException) {
            // already ended
        }
    }

    public static function portfolio(array $app, string $token): array
    {
        $holdings = self::normalizeHoldings(self::call('get', '/portfolio/holdings', $token, $app['key']));
        $positions = self::normalizePositions(self::call('get', '/portfolio/positions', $token, $app['key']));
        $invested = array_sum(array_column($holdings, 'invested'));
        $value = array_sum(array_column($holdings, 'value'));
        $day = array_sum(array_map(fn ($h) => $h['qty'] * ($h['lastPrice'] - $h['closePrice']), $holdings));

        return [
            'holdings' => $holdings,
            'positions' => $positions,
            'totals' => self::totals($invested, $value, $day, array_sum(array_column($positions, 'pnl'))),
        ];
    }

    public static function totals(float $invested, float $value, float $day, float $positionsPnl): array
    {
        return [
            'invested' => round($invested, 2), 'value' => round($value, 2), 'pnl' => round($value - $invested, 2),
            'pnlPct' => $invested ? round(($value - $invested) / $invested * 100, 2) : 0,
            'dayPnl' => round($day, 2), 'positionsPnl' => round($positionsPnl, 2),
        ];
    }

    public static function normalizeHoldings(array $raw): array
    {
        $out = [];
        foreach ($raw as $h) {
            $qty = (int) ($h['quantity'] ?? 0) + (int) ($h['t1_quantity'] ?? 0); // bought yesterday, still settling
            if ($qty <= 0) {
                continue;
            }
            $invested = $qty * $h['average_price'];
            $value = $qty * $h['last_price'];
            $close = $h['close_price'] ?? 0;
            $out[] = [
                'symbol' => $h['tradingsymbol'], 'exchange' => $h['exchange'], 'qty' => $qty,
                'avgPrice' => $h['average_price'], 'lastPrice' => $h['last_price'], 'closePrice' => $close,
                'invested' => round($invested, 2), 'value' => round($value, 2),
                'pnl' => round($h['pnl'] ?? $value - $invested, 2),
                'pnlPct' => $invested ? round(($value - $invested) / $invested * 100, 2) : 0,
                'dayChangePct' => round($h['day_change_percentage'] ?? ($close ? ($h['last_price'] - $close) / $close * 100 : 0), 2),
            ];
        }
        usort($out, fn ($a, $b) => $b['value'] <=> $a['value']);

        return $out;
    }

    public static function normalizePositions(array $raw): array
    {
        return array_map(fn ($p) => [
            'symbol' => $p['tradingsymbol'], 'exchange' => $p['exchange'], 'product' => $p['product'],
            'qty' => $p['quantity'], 'avgPrice' => $p['average_price'], 'lastPrice' => $p['last_price'],
            'pnl' => round($p['pnl'], 2), 'm2m' => round($p['m2m'] ?? 0, 2),
        ], $raw['net'] ?? []);
    }

    private static function call(string $method, string $path, ?string $token, string $key, array $form = []): mixed
    {
        $req = Http::withHeaders(['X-Kite-Version' => '3'])->timeout(15);
        if ($token) {
            $req = $req->withHeaders(['Authorization' => "token {$key}:{$token}"]);
        }
        $url = rtrim(config('services.kite.api_root'), '/').$path;
        /** @var Response $res */
        $res = $method === 'post' ? $req->asForm()->post($url, $form) : $req->{$method}($url);
        $j = $res->json();
        if (! $res->successful() || ($j['status'] ?? null) !== 'success') {
            throw new KiteException($j['message'] ?? "Zerodha error {$res->status()}", $res->status(), $j['error_type'] ?? null);
        }

        return $j['data'];
    }
}
