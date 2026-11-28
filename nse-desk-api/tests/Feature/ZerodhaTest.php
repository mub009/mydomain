<?php

namespace Tests\Feature;

use App\Models\BrokerAccount;
use App\Models\User;
use App\Services\Kite;
use Carbon\CarbonImmutable;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;
use Tests\TestCase;

class ZerodhaTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        config(['services.frontend_url' => 'https://desk.example']);
    }

    /** Fake Kite: each request token logs in a different client. */
    private function fakeKite(): void
    {
        Http::fake(function ($request) {
            $url = $request->url();
            if (str_contains($url, '/session/token') && $request->method() === 'POST') {
                $rt = $request->data()['request_token'];
                $this->assertSame(Kite::checksum('testkey', $rt, 'testsecret'), $request->data()['checksum']);
                $id = $rt === 'reqAAAA01' ? 'ZX1234' : 'ZY5678';

                return Http::response(['status' => 'success', 'data' => ['access_token' => "acc{$id}", 'user_id' => $id, 'user_name' => "User {$id}"]]);
            }
            if (str_contains($url, '/session/token')) {
                return Http::response(['status' => 'success', 'data' => true]);
            }
            $auth = $request->header('Authorization')[0] ?? '';
            if (! preg_match('/^token testkey:acc(\w+)$/', $auth, $m) || $m[1] === 'DEAD') {
                return Http::response(['status' => 'error', 'error_type' => 'TokenException', 'message' => 'Session expired'], 403);
            }
            if (str_contains($url, '/portfolio/holdings')) {
                return Http::response(['status' => 'success', 'data' => [
                    ['tradingsymbol' => $m[1] === 'ZX1234' ? 'INFY' : 'ITC', 'exchange' => 'NSE', 'quantity' => 10, 't1_quantity' => 5, 'average_price' => 100, 'last_price' => 110, 'close_price' => 105, 'pnl' => 150, 'day_change_percentage' => 4.76],
                ]]);
            }

            return Http::response(['status' => 'success', 'data' => ['net' => []]]);
        });
    }

    /** Each user saves their own Kite Connect app. */
    private function addApp(User $u): int
    {
        return $this->actingAs($u)->postJson('/api/zerodha/apps', ['label' => 'Mine', 'api_key' => 'testkey', 'api_secret' => 'testsecret'])
            ->assertCreated()->json('app.id');
    }

    private function connect(User $u, string $requestToken): \Illuminate\Testing\TestResponse
    {
        if (! $u->kiteApps()->exists()) {
            $this->addApp($u);
        }
        $url = $this->actingAs($u)->postJson('/api/zerodha/connect')->assertOk()->json('url');
        $this->assertStringStartsWith('https://kite.zerodha.com/connect/login?', $url);
        parse_str(parse_url($url, PHP_URL_QUERY), $q);
        $this->assertSame('testkey', $q['api_key']);
        parse_str($q['redirect_params'], $rp);

        return $this->get('/api/zerodha/callback?'.http_build_query(['status' => 'success', 'request_token' => $requestToken, 'state' => $rp['state']]));
    }

    public function test_two_accounts_on_one_app_with_combined_totals(): void
    {
        $this->fakeKite();
        $u = User::factory()->create();
        $this->connect($u, 'reqAAAA01')->assertRedirect('https://desk.example/positions?broker=connected');
        $this->connect($u, 'reqBBBB02')->assertRedirect('https://desk.example/positions?broker=connected');

        $r = $this->actingAs($u)->getJson('/api/zerodha')->assertOk();
        $this->assertSame(['ZX1234', 'ZY5678'], array_column(array_column($r->json('accounts'), 'user'), 'id'));
        $r->assertJsonPath('accounts.0.holdings.0.qty', 15) // includes shares still settling
            ->assertJsonPath('accounts.0.totals.value', 1650)
            ->assertJsonPath('combined.value', 3300)
            ->assertJsonPath('combined.pnl', 300);
        $this->assertArrayNotHasKey('access_token', $r->json('accounts.0'));
    }

    public function test_token_is_encrypted_at_rest(): void
    {
        $this->fakeKite();
        $u = User::factory()->create();
        $this->connect($u, 'reqAAAA01');
        $raw = DB::table('broker_accounts')->value('access_token');
        $this->assertNotSame('accZX1234', $raw);
        $this->assertSame('accZX1234', BrokerAccount::first()->access_token);
    }

    public function test_callback_needs_a_state_this_api_issued_once(): void
    {
        $this->fakeKite();
        $this->get('/api/zerodha/callback?status=success&request_token=reqAAAA01&state=forged')->assertRedirect('https://desk.example/positions?broker=failed');
        $this->get('/api/zerodha/callback?status=cancelled')->assertRedirect('https://desk.example/positions?broker=cancelled');

        $u = User::factory()->create();
        $this->addApp($u);
        $url = $this->actingAs($u)->postJson('/api/zerodha/connect')->json('url');
        parse_str(parse_url($url, PHP_URL_QUERY), $q);
        parse_str($q['redirect_params'], $rp);
        $cb = '/api/zerodha/callback?'.http_build_query(['status' => 'success', 'request_token' => 'reqAAAA01', 'state' => $rp['state']]);
        $this->get($cb)->assertRedirect('https://desk.example/positions?broker=connected');
        $this->get($cb)->assertRedirect('https://desk.example/positions?broker=failed'); // used once only
        $this->assertSame(1, BrokerAccount::count());
    }

    public function test_users_only_see_and_remove_their_own_accounts(): void
    {
        $this->fakeKite();
        [$a, $b] = User::factory()->count(2)->create();
        $this->connect($a, 'reqAAAA01');
        $acc = BrokerAccount::first();
        $this->actingAs($b)->getJson('/api/zerodha')->assertJsonCount(0, 'accounts');
        $this->actingAs($b)->deleteJson("/api/zerodha/accounts/{$acc->id}")->assertNotFound();
        $this->actingAs($a)->deleteJson("/api/zerodha/accounts/{$acc->id}")->assertOk();
        $this->assertSame(0, BrokerAccount::count());
    }

    public function test_ended_sessions_keep_the_account_without_a_token(): void
    {
        $this->fakeKite();
        $u = User::factory()->create();
        $app = $this->addApp($u);
        BrokerAccount::create(['user_id' => $u->id, 'kite_app_id' => $app, 'client_id' => 'ZQ0001', 'access_token' => 'accDEAD', 'expires_at' => now()->addHour()]);
        BrokerAccount::create(['user_id' => $u->id, 'kite_app_id' => $app, 'client_id' => 'ZQ0002', 'access_token' => 'accZX1234', 'expires_at' => now()->subMinute()]);
        // Ended sessions keep the account (and its saved holdings) but lose the token.
        $r = $this->actingAs($u)->getJson('/api/zerodha')->assertOk()->assertJsonPath('expired', true)->assertJsonCount(2, 'accounts');
        $r->assertJsonPath('accounts.0.connected', false)->assertJsonPath('accounts.1.connected', false);
        $this->assertSame(2, BrokerAccount::count());
        $this->assertNull(BrokerAccount::where('client_id', 'ZQ0001')->first()->access_token);
    }

    public function test_no_app_yet(): void
    {
        $u = User::factory()->create();
        $this->actingAs($u)->getJson('/api/zerodha')->assertJsonPath('configured', false)->assertJsonPath('redirectUrl', url('/api/zerodha/callback'));
        $this->actingAs($u)->postJson('/api/zerodha/connect')->assertStatus(422);
    }

    public function test_apps_are_per_user_with_the_secret_encrypted_and_never_returned(): void
    {
        [$a, $b] = User::factory()->count(2)->create();
        $id = $this->addApp($a);
        $r = $this->actingAs($a)->getJson('/api/zerodha')->assertJsonPath('configured', true)->assertJsonPath('apps.0.apiKey', '•••••••'); // short test key: fully hidden (16-character Kite keys show as abcd••••wxyz)
        $this->assertStringNotContainsString('testsecret', $r->getContent());
        $this->assertNotSame('testsecret', DB::table('kite_apps')->value('api_secret'));
        $this->actingAs($a)->postJson('/api/zerodha/apps', ['api_key' => 'testkey', 'api_secret' => 'other1'])->assertStatus(422)->assertJsonValidationErrors('api_key');
        $this->actingAs($a)->postJson('/api/zerodha/apps', ['api_key' => 'bad key!', 'api_secret' => 'x'])->assertStatus(422)->assertJsonValidationErrors(['api_key', 'api_secret']);
        // someone else can't see, use or remove it
        $this->actingAs($b)->getJson('/api/zerodha')->assertJsonPath('configured', false);
        $this->actingAs($b)->postJson('/api/zerodha/connect', ['app_id' => $id])->assertStatus(422);
        $this->actingAs($b)->deleteJson("/api/zerodha/apps/{$id}")->assertNotFound();
    }

    public function test_removing_an_app_disconnects_its_accounts(): void
    {
        $this->fakeKite();
        $u = User::factory()->create();
        $this->connect($u, 'reqAAAA01');
        $this->assertSame(1, BrokerAccount::count());
        $this->actingAs($u)->deleteJson('/api/zerodha/apps/'.$u->kiteApps()->value('id'))->assertOk();
        $this->assertSame(0, BrokerAccount::count());
    }

    public function test_session_ends_at_six_ist(): void
    {
        $this->assertSame('2026-11-21T00:30:00+00:00', Kite::sessionExpiry(CarbonImmutable::parse('2026-11-20T10:00:00Z'))->toIso8601String());
        $this->assertSame('2026-11-20T00:30:00+00:00', Kite::sessionExpiry(CarbonImmutable::parse('2026-11-20T00:00:00Z'))->toIso8601String());
    }
}
