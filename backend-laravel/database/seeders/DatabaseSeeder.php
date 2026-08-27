<?php

namespace Database\Seeders;

use App\Models\Business;
use App\Models\BusinessPhoto;
use App\Models\Category;
use App\Models\PointTransaction;
use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;

class DatabaseSeeder extends Seeder
{
    public function run(): void
    {
        $passwordHash = Hash::make('Password123!');

        $admin = User::updateOrCreate(
            ['email' => 'admin@mydomain.dev'],
            ['passwordHash' => $passwordHash, 'firstName' => 'Ada', 'lastName' => 'Admin', 'role' => 'ADMIN', 'status' => 'ACTIVE'],
        );

        $owner = User::updateOrCreate(
            ['email' => 'owner@mydomain.dev'],
            ['passwordHash' => $passwordHash, 'firstName' => 'Olivia', 'lastName' => 'Owner', 'role' => 'BUSINESS_OWNER', 'status' => 'ACTIVE'],
        );

        User::updateOrCreate(
            ['email' => 'customer@mydomain.dev'],
            ['passwordHash' => $passwordHash, 'firstName' => 'Cara', 'lastName' => 'Customer', 'role' => 'CUSTOMER', 'status' => 'ACTIVE'],
        );

        $dealer = User::updateOrCreate(
            ['email' => 'dealer@mydomain.dev'],
            [
                'passwordHash' => $passwordHash, 'firstName' => 'Derek', 'lastName' => 'Dealer',
                'role' => 'DEALER', 'status' => 'ACTIVE',
                'privileges' => ['MANAGE_LISTINGS', 'MANAGE_LEADS', 'MANAGE_BOOKINGS'], 'points' => 10,
            ],
        );

        if (PointTransaction::where('userId', $dealer->id)->count() === 0) {
            PointTransaction::create([
                'userId' => $dealer->id, 'type' => 'ADMIN_GRANT', 'amount' => 10,
                'balanceAfter' => 10, 'note' => 'Seed allocation', 'grantedById' => $admin->id,
            ]);
        }

        $restaurants = Category::updateOrCreate(
            ['slug' => 'restaurants'],
            ['name' => 'Restaurants', 'description' => 'Dining and food outlets'],
        );
        Category::updateOrCreate(
            ['slug' => 'home-services'],
            ['name' => 'Home Services', 'description' => 'Plumbers, electricians, cleaners'],
        );
        Category::updateOrCreate(
            ['slug' => 'manufacturing-supplies'],
            ['name' => 'Manufacturing & Supplies', 'description' => 'B2B raw materials and equipment'],
        );

        $business = Business::updateOrCreate(
            ['slug' => 'spice-route-kitchen'],
            [
                'ownerId' => $owner->id,
                'name' => 'Spice Route Kitchen',
                'description' => 'Authentic North Indian cuisine in the heart of the city. Spice Route Kitchen serves freshly prepared tandoori dishes, rich curries, and hand-rolled breads in a warm, family-friendly setting.',
                'categoryId' => $restaurants->id,
                'status' => 'PUBLISHED',
                'isVerified' => true,
                'phone' => '+91-9876543210',
                'email' => 'hello@spicerouteexample.com',
                'website' => 'https://spicerouteexample.com',
                'addressLine1' => '12 MG Road, 2nd Floor, Near Trinity Metro',
                'city' => 'Bengaluru',
                'state' => 'Karnataka',
                'postalCode' => '560001',
                'country' => 'IN',
                'latitude' => 12.9716,
                'longitude' => 77.5946,
                'avgRating' => 4.3,
                'reviewCount' => 3,
            ],
        );

        $photoSeeds = ['restaurant-interior', 'indian-food-thali', 'restaurant-dining', 'tandoori-kitchen', 'restaurant-bar'];
        foreach ($photoSeeds as $i => $seed) {
            BusinessPhoto::updateOrCreate(
                ['businessId' => $business->id, 'sortOrder' => $i],
                ['url' => "https://picsum.photos/seed/{$seed}/800/600", 'caption' => str_replace('-', ' ', $seed)],
            );
        }
    }
}
