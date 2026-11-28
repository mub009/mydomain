<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class WatchlistTest extends TestCase
{
    use RefreshDatabase;

    public function test_add_list_update_and_remove(): void
    {
        $u = User::factory()->create();
        $this->actingAs($u)->postJson('/api/watchlist', ['symbol' => 'infy', 'price' => 1500.55])->assertCreated()
            ->assertJsonPath('item.symbol', 'INFY')->assertJsonPath('item.addedPrice', 1500.55);
        $this->actingAs($u)->postJson('/api/watchlist', ['symbol' => 'M&M'])->assertCreated();
        // Adding again updates the note and keeps the first price.
        $this->actingAs($u)->postJson('/api/watchlist', ['symbol' => 'INFY', 'note' => 'Wait for 1400', 'price' => 9])->assertOk()
            ->assertJsonPath('item.note', 'Wait for 1400')->assertJsonPath('item.addedPrice', 1500.55);
        $this->actingAs($u)->getJson('/api/watchlist')->assertOk()->assertJsonCount(2, 'items')->assertJsonPath('items.0.symbol', 'M&M');
        $this->actingAs($u)->deleteJson('/api/watchlist/'.rawurlencode('M&M'))->assertOk();
        $this->actingAs($u)->getJson('/api/watchlist')->assertJsonCount(1, 'items');
    }

    public function test_bad_symbols_and_other_users(): void
    {
        $u = User::factory()->create();
        $this->actingAs($u)->postJson('/api/watchlist', ['symbol' => 'DROP TABLE'])->assertStatus(422);
        $this->actingAs($u)->postJson('/api/watchlist', ['symbol' => 'TCS']);
        $other = User::factory()->create();
        $this->actingAs($other)->getJson('/api/watchlist')->assertJsonCount(0, 'items');
        $this->actingAs($other)->deleteJson('/api/watchlist/TCS')->assertOk();
        $this->actingAs($u)->getJson('/api/watchlist')->assertJsonCount(1, 'items');
    }

    public function test_needs_login(): void
    {
        $this->getJson('/api/watchlist')->assertUnauthorized();
    }
}
