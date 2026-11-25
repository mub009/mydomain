<?php

namespace Tests\Feature;

use App\Models\BrokerAccount;
use App\Models\BrokerHolding;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Http;
use Tests\TestCase;

/** Zerodha holdings are saved in the database; refresh replaces them and reports sold stocks. */
class HoldingsSyncTest extends TestCase
{
    use RefreshDatabase;

    /** What the fake Zerodha account holds right now: symbol => quantity. */
    private array $holds = ['INFY' => 10, 'ITC' => 20];

    private bool $sessionEnded = false;

    protected function setUp(): void
    {
        parent::setUp();
        config(['services.frontend_url' => 'https://desk.example']);
        Http::fake(function ($request) {
            if ($this->sessionEnded) {
                return Http::response(['status' => 'error', 'error_type' => 'TokenException', 'message' => 'Session expired'], 403);
            }
            if (str_contains($request->url(), '/portfolio/holdings')) {
                return Http::response(['status' => 'success', 'data' => array_map(fn ($sym, $qty) => [
                    'tradingsymbol' => $sym, 'exchange' => 'NSE', 'quantity' => $qty, 'average_price' => 100.25, 'last_price' => 110.5,
                    'close_price' => 108, 'pnl' => $qty * 10.25, 'day_change_percentage' => 2.31,
                ], array_keys($this->holds), $this->holds)]);
            }

            return Http::response(['status' => 'success', 'data' => ['net' => [
                ['tradingsymbol' => 'SBIN', 'exchange' => 'NSE', 'product' => 'MIS', 'quantity' => 5, 'average_price' => 800, 'last_price' => 810, 'pnl' => 50, 'm2m' => 50],
            ]]]);
        });
    }

    private function account(): array
    {
        $u = User::factory()->create();
        $app = $this->actingAs($u)->postJson('/api/zerodha/apps', ['api_key' => 'testkey', 'api_secret' => 'testsecret'])->json('app.id');
        $acc = BrokerAccount::create(['user_id' => $u->id, 'kite_app_id' => $app, 'client_id' => 'ZX1234', 'access_token' => 'accZX1234', 'expires_at' => now()->addHours(5)]);

        return [$u, $acc];
    }

    public function test_first_load_saves_holdings_and_positions(): void
    {
        [$u, $acc] = $this->account();
        $r = $this->actingAs($u)->getJson('/api/zerodha')->assertOk();
        $r->assertJsonPath('accounts.0.connected', true)->assertJsonCount(2, 'accounts.0.holdings')->assertJsonCount(1, 'accounts.0.positions');
        $r->assertJsonPath('accounts.0.holdings.0.avgPrice', 100.25)->assertJsonPath('accounts.0.positions.0.symbol', 'SBIN');
        $this->assertSame(3, BrokerHolding::count());
        $this->assertNotNull($acc->fresh()->synced_at);
        $this->assertNotNull($r->json('accounts.0.syncedAt'));
    }

    public function test_later_loads_come_from_the_database(): void
    {
        [$u] = $this->account();
        $this->actingAs($u)->getJson('/api/zerodha');
        Http::fake(fn () => throw new \RuntimeException('Zerodha must not be called'));
        $this->actingAs($u)->getJson('/api/zerodha')->assertOk()->assertJsonCount(2, 'accounts.0.holdings');
    }

    public function test_refresh_removes_sold_stocks_and_reports_new_ones(): void
    {
        [$u] = $this->account();
        $this->actingAs($u)->getJson('/api/zerodha');
        $this->holds = ['INFY' => 10, 'TCS' => 3]; // sold ITC, bought TCS
        $r = $this->actingAs($u)->postJson('/api/zerodha/refresh')->assertOk();
        $r->assertJsonPath('refreshed.removed.0.symbol', 'ITC')->assertJsonPath('refreshed.removed.0.qty', 20)
            ->assertJsonPath('refreshed.added.0.symbol', 'TCS');
        $this->assertSame(['INFY', 'TCS'], collect($r->json('accounts.0.holdings'))->pluck('symbol')->sort()->values()->all());
        $this->assertFalse(BrokerHolding::where('symbol', 'ITC')->exists());
    }

    public function test_an_ended_session_keeps_the_saved_holdings(): void
    {
        [$u, $acc] = $this->account();
        $this->actingAs($u)->getJson('/api/zerodha');
        $this->sessionEnded = true;
        $r = $this->actingAs($u)->postJson('/api/zerodha/refresh')->assertOk();
        $r->assertJsonPath('refreshed.errors.0.clientId', 'ZX1234')->assertJsonPath('accounts.0.connected', false)
            ->assertJsonCount(2, 'accounts.0.holdings');
        $this->assertNull($acc->fresh()->access_token);
        // Refreshing again skips it (nothing to call) and still shows the saved data.
        $this->actingAs($u)->postJson('/api/zerodha/refresh')->assertOk()->assertJsonCount(0, 'refreshed.errors')->assertJsonCount(2, 'accounts.0.holdings');
    }

    public function test_removing_the_account_deletes_its_holdings(): void
    {
        [$u, $acc] = $this->account();
        $this->actingAs($u)->getJson('/api/zerodha');
        $this->actingAs($u)->deleteJson("/api/zerodha/accounts/{$acc->id}")->assertOk();
        $this->assertSame(0, BrokerHolding::count());
    }

    public function test_others_cannot_see_your_holdings(): void
    {
        [$u] = $this->account();
        $this->actingAs($u)->getJson('/api/zerodha');
        $other = User::factory()->create();
        $this->actingAs($other)->getJson('/api/zerodha')->assertOk()->assertJsonCount(0, 'accounts');
        $this->actingAs($other)->postJson('/api/zerodha/refresh')->assertOk()->assertJsonCount(0, 'accounts');
    }
}
