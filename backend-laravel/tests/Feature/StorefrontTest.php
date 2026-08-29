<?php

namespace Tests\Feature;

use App\Models\Business;
use App\Models\BusinessSite;
use App\Models\Category;
use App\Models\Product;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Tests\TestCase;

class StorefrontTest extends TestCase
{
    use RefreshDatabase;

    private function user(array $overrides = []): User
    {
        return User::create([
            'email' => $overrides['email'] ?? 'user'.uniqid().'@example.com',
            'passwordHash' => Hash::make('Password123!'),
            'firstName' => 'Test', 'lastName' => 'User', 'status' => 'ACTIVE',
            ...$overrides,
        ]);
    }

    private function token(User $user): string
    {
        return $this->postJson('/api/v1/auth/login', ['email' => $user->email, 'password' => 'Password123!'])
            ->json('data.accessToken');
    }

    private function business(User $owner): Business
    {
        $category = Category::create(['name' => 'Restaurants', 'slug' => 'restaurants']);

        return Business::create([
            'ownerId' => $owner->id, 'name' => 'Shop', 'slug' => 'shop', 'categoryId' => $category->id,
            'status' => 'PUBLISHED', 'phone' => '9998887777', 'addressLine1' => '1 Main St',
            'city' => 'Pune', 'state' => 'MH', 'postalCode' => '411001', 'latitude' => 18.5, 'longitude' => 73.8,
        ]);
    }

    public function test_owner_adds_products_with_auto_incrementing_slugs(): void
    {
        $owner = $this->user(['role' => 'BUSINESS_OWNER']);
        $business = $this->business($owner);
        $token = $this->token($owner);

        $first = $this->postJson("/api/v1/businesses/{$business->id}/products", [
            'name' => 'Masala Dosa', 'priceCents' => 15000,
        ], ['Authorization' => "Bearer {$token}"]);
        $first->assertStatus(201)->assertJsonPath('data.slug', 'masala-dosa');

        $second = $this->postJson("/api/v1/businesses/{$business->id}/products", [
            'name' => 'Masala Dosa', 'priceCents' => 16000,
        ], ['Authorization' => "Bearer {$token}"]);
        $second->assertStatus(201)->assertJsonPath('data.slug', 'masala-dosa-2');
    }

    public function test_compare_at_price_must_be_higher_than_selling_price(): void
    {
        $owner = $this->user(['role' => 'BUSINESS_OWNER']);
        $business = $this->business($owner);
        $token = $this->token($owner);

        $this->postJson("/api/v1/businesses/{$business->id}/products", [
            'name' => 'Item', 'priceCents' => 1000, 'compareAtCents' => 900,
        ], ['Authorization' => "Bearer {$token}"])->assertStatus(400);
    }

    public function test_shop_must_be_published_as_ecommerce_before_it_accepts_orders(): void
    {
        $owner = $this->user(['role' => 'BUSINESS_OWNER']);
        $business = $this->business($owner);

        $this->getJson("/api/v1/sites/{$business->slug}/products")->assertStatus(404);

        $this->postJson("/api/v1/sites/{$business->slug}/orders", [
            'items' => [['productId' => 'whatever', 'quantity' => 1]],
            'customerName' => 'Alice', 'customerPhone' => '9990001111', 'addressLine1' => '2 Lane', 'city' => 'Pune',
        ])->assertStatus(400);
    }

    public function test_publishing_an_ecommerce_site_requires_a_product(): void
    {
        $owner = $this->user(['role' => 'BUSINESS_OWNER']);
        $business = $this->business($owner);
        $token = $this->token($owner);

        $this->patchJson("/api/v1/businesses/{$business->id}/site/type", ['siteType' => 'ECOMMERCE'], ['Authorization' => "Bearer {$token}"])
            ->assertStatus(200)
            ->assertJsonPath('data.siteType', 'ECOMMERCE')
            ->assertJsonPath('data.isPublished', false);

        $this->postJson("/api/v1/businesses/{$business->id}/site/publish", ['isPublished' => true], ['Authorization' => "Bearer {$token}"])
            ->assertStatus(400);

        $this->postJson("/api/v1/businesses/{$business->id}/products", ['name' => 'Item', 'priceCents' => 1000], ['Authorization' => "Bearer {$token}"]);

        $this->postJson("/api/v1/businesses/{$business->id}/site/publish", ['isPublished' => true], ['Authorization' => "Bearer {$token}"])
            ->assertStatus(200)->assertJsonPath('data.isPublished', true);
    }

    public function test_checkout_recomputes_totals_and_decrements_tracked_stock(): void
    {
        $owner = $this->user(['role' => 'BUSINESS_OWNER']);
        $business = $this->business($owner);
        BusinessSite::create(['businessId' => $business->id, 'siteType' => 'ECOMMERCE', 'isPublished' => true, 'deliveryFeeCents' => 5000]);
        $product = Product::create([
            'businessId' => $business->id, 'name' => 'Widget', 'slug' => 'widget',
            'priceCents' => 10000, 'trackStock' => true, 'stock' => 3, 'isActive' => true,
        ]);

        $response = $this->postJson("/api/v1/sites/{$business->slug}/orders", [
            // Two lines for the same product fold into one line of quantity 2 —
            // the client cannot inflate the price by tampering with the cart.
            'items' => [['productId' => $product->id, 'quantity' => 1], ['productId' => $product->id, 'quantity' => 1]],
            'customerName' => 'Alice', 'customerPhone' => '9990001111', 'addressLine1' => '2 Lane', 'city' => 'Pune',
        ]);

        $response->assertStatus(201)
            ->assertJsonPath('data.subtotalCents', 20000)
            ->assertJsonPath('data.deliveryFeeCents', 5000)
            ->assertJsonPath('data.totalCents', 25000);

        $this->assertSame(1, $product->fresh()->stock);
    }

    public function test_checkout_rejects_more_than_available_stock(): void
    {
        $owner = $this->user(['role' => 'BUSINESS_OWNER']);
        $business = $this->business($owner);
        BusinessSite::create(['businessId' => $business->id, 'siteType' => 'ECOMMERCE', 'isPublished' => true]);
        $product = Product::create([
            'businessId' => $business->id, 'name' => 'Widget', 'slug' => 'widget',
            'priceCents' => 10000, 'trackStock' => true, 'stock' => 1, 'isActive' => true,
        ]);

        $this->postJson("/api/v1/sites/{$business->slug}/orders", [
            'items' => [['productId' => $product->id, 'quantity' => 2]],
            'customerName' => 'Alice', 'customerPhone' => '9990001111', 'addressLine1' => '2 Lane', 'city' => 'Pune',
        ])->assertStatus(400);
    }

    public function test_free_delivery_threshold_waives_the_delivery_fee(): void
    {
        $owner = $this->user(['role' => 'BUSINESS_OWNER']);
        $business = $this->business($owner);
        BusinessSite::create([
            'businessId' => $business->id, 'siteType' => 'ECOMMERCE', 'isPublished' => true,
            'deliveryFeeCents' => 5000, 'freeDeliveryAboveCents' => 15000,
        ]);
        $product = Product::create([
            'businessId' => $business->id, 'name' => 'Widget', 'slug' => 'widget', 'priceCents' => 20000, 'isActive' => true,
        ]);

        $this->postJson("/api/v1/sites/{$business->slug}/orders", [
            'items' => [['productId' => $product->id, 'quantity' => 1]],
            'customerName' => 'Alice', 'customerPhone' => '9990001111', 'addressLine1' => '2 Lane', 'city' => 'Pune',
        ])->assertStatus(201)->assertJsonPath('data.deliveryFeeCents', 0);
    }

    public function test_owner_sees_orders_with_a_summary_and_can_cancel_to_restock(): void
    {
        $owner = $this->user(['role' => 'BUSINESS_OWNER']);
        $business = $this->business($owner);
        BusinessSite::create(['businessId' => $business->id, 'siteType' => 'ECOMMERCE', 'isPublished' => true]);
        $product = Product::create([
            'businessId' => $business->id, 'name' => 'Widget', 'slug' => 'widget',
            'priceCents' => 10000, 'trackStock' => true, 'stock' => 5, 'isActive' => true,
        ]);

        $order = $this->postJson("/api/v1/sites/{$business->slug}/orders", [
            'items' => [['productId' => $product->id, 'quantity' => 2]],
            'customerName' => 'Alice', 'customerPhone' => '9990001111', 'addressLine1' => '2 Lane', 'city' => 'Pune',
        ])->json('data');
        $this->assertSame(3, $product->fresh()->stock);

        $token = $this->token($owner);
        $this->getJson("/api/v1/businesses/{$business->id}/orders", ['Authorization' => "Bearer {$token}"])
            ->assertStatus(200)
            ->assertJsonPath('meta.total', 1)
            ->assertJsonPath('summary.total', 1)
            ->assertJsonPath('summary.revenueCents', 20000);

        $this->getJson("/api/v1/businesses/{$business->id}/orders/{$order['id']}", ['Authorization' => "Bearer {$token}"])
            ->assertStatus(200)->assertJsonPath('data.orderNumber', $order['orderNumber']);

        $this->patchJson("/api/v1/businesses/{$business->id}/orders/{$order['id']}/status", ['status' => 'CANCELLED'], ['Authorization' => "Bearer {$token}"])
            ->assertStatus(200)->assertJsonPath('data.status', 'CANCELLED');

        $this->assertSame(5, $product->fresh()->stock);

        $this->getJson("/api/v1/businesses/{$business->id}/customers", ['Authorization' => "Bearer {$token}"])
            ->assertStatus(200)->assertJsonPath('data.0.phone', '9990001111');
    }

    public function test_owner_updates_and_deletes_a_product(): void
    {
        $owner = $this->user(['role' => 'BUSINESS_OWNER']);
        $business = $this->business($owner);
        $token = $this->token($owner);

        $product = $this->postJson("/api/v1/businesses/{$business->id}/products", [
            'name' => 'Widget', 'priceCents' => 1000,
        ], ['Authorization' => "Bearer {$token}"])->json('data');

        $this->patchJson("/api/v1/businesses/{$business->id}/products/{$product['id']}", ['priceCents' => 2000], ['Authorization' => "Bearer {$token}"])
            ->assertStatus(200)->assertJsonPath('data.priceCents', 2000);

        $this->deleteJson("/api/v1/businesses/{$business->id}/products/{$product['id']}", [], ['Authorization' => "Bearer {$token}"])
            ->assertStatus(200)->assertJsonPath('data.id', $product['id']);

        $this->assertDatabaseMissing('products', ['id' => $product['id']]);
    }

    public function test_only_the_owner_can_manage_products(): void
    {
        $owner = $this->user(['role' => 'BUSINESS_OWNER']);
        $other = $this->user(['role' => 'BUSINESS_OWNER']);
        $business = $this->business($owner);

        $token = $this->token($other);
        $this->postJson("/api/v1/businesses/{$business->id}/products", ['name' => 'Item', 'priceCents' => 1000], ['Authorization' => "Bearer {$token}"])
            ->assertStatus(403);
    }

    public function test_public_site_404s_when_nothing_is_published(): void
    {
        $owner = $this->user(['role' => 'BUSINESS_OWNER']);
        $business = $this->business($owner);

        $this->getJson("/api/v1/sites/{$business->slug}")->assertStatus(404);

        BusinessSite::create(['businessId' => $business->id, 'siteType' => 'ECOMMERCE', 'isPublished' => false]);
        $this->getJson("/api/v1/sites/{$business->slug}")->assertStatus(404);
    }

    public function test_public_site_renders_a_published_ecommerce_storefront_with_its_theme(): void
    {
        $owner = $this->user(['role' => 'BUSINESS_OWNER']);
        $business = $this->business($owner);
        BusinessSite::create([
            'businessId' => $business->id, 'siteType' => 'ECOMMERCE', 'isPublished' => true,
            'templateId' => 'vibrant', 'deliveryFeeCents' => 5000, 'freeDeliveryAboveCents' => 20000,
        ]);

        $this->getJson("/api/v1/sites/{$business->slug}")
            ->assertStatus(200)
            ->assertJsonPath('data.siteType', 'ECOMMERCE')
            ->assertJsonPath('data.business.slug', $business->slug)
            ->assertJsonPath('data.templateId', 'vibrant')
            ->assertJsonPath('data.theme.accent', '#7c3aed')
            ->assertJsonPath('data.storefront.deliveryFeeCents', 5000)
            ->assertJsonPath('data.storefront.freeDeliveryAboveCents', 20000)
            ->assertJsonPath('data.html', '');
    }

    public function test_public_site_renders_a_published_brochure_website(): void
    {
        $owner = $this->user(['role' => 'BUSINESS_OWNER']);
        $business = $this->business($owner);
        BusinessSite::create([
            'businessId' => $business->id, 'siteType' => 'WEBSITE', 'isPublished' => true,
            'templateId' => 'classic', 'html' => '<h1>Welcome</h1>', 'css' => 'h1{color:red}',
        ]);

        $this->getJson("/api/v1/sites/{$business->slug}")
            ->assertStatus(200)
            ->assertJsonPath('data.siteType', 'WEBSITE')
            ->assertJsonPath('data.html', '<h1>Welcome</h1>')
            ->assertJsonPath('data.css', 'h1{color:red}')
            ->assertJsonPath('data.storefront', null);
    }

    public function test_public_site_404s_for_a_website_marked_published_with_no_saved_html(): void
    {
        $owner = $this->user(['role' => 'BUSINESS_OWNER']);
        $business = $this->business($owner);
        BusinessSite::create(['businessId' => $business->id, 'siteType' => 'WEBSITE', 'isPublished' => true]);

        $this->getJson("/api/v1/sites/{$business->slug}")->assertStatus(404);
    }
}
