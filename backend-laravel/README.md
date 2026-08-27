# Markkito backend — Laravel 11 port

A Laravel 11 port of the [Node/Express backend](../backend) in `backend/`.
Same database shape (camelCase columns matching the original Prisma schema,
so the existing `frontend/` can point at either backend without changes) and
the same JSON API contract: `{ success, data }` / `{ success, data, meta }`
on success, `{ success: false, error: { code, message, details } }` on
failure, including the `error.details.issues[].path/.message` shape the
frontend's `apiErrorMessage()` reads for validation errors.

## Scope of this port

This is a **core-first** conversion. Ported and tested:

- Auth (register/login/refresh/logout/me) — JWT access tokens (`firebase/php-jwt`)
  + opaque refresh tokens stored in `refresh_tokens`, bcrypt password hashing.
- Users (dealer/admin password reset, list-accounts-I-created).
- Categories (public read, admin-only write).
- Businesses (create — including the dealer owner-account-provisioning and
  points-spend flow, list, search-list, manage, update, delete, photos,
  hours, services). Dealer privilege gating (`MANAGE_LISTINGS`) and
  role/ownership checks match the Node backend.
- Search (keyword + category + city + radius Haversine + rating filters,
  sort by relevance/rating/distance/newest) + popular cities.
- Reviews (one per user per business, rating rollup recalculated from the
  `reviews` table, owner replies, delete).

**Not ported** (still Node-only — see `backend/src/modules/`): leads,
bookings, payments/Stripe, B2B RFQ/quotes, admin dashboards, points admin
endpoints (the spend-on-create logic *is* ported, just not the
grant/adjust/list-transactions admin endpoints), visitors, review-QR boards,
site builder, storefront/orders, WhatsApp broadcasts, Poster Studio,
notifications, email sending. Porting any of these follows the same pattern
established here — see "Porting another module" below.

## Requirements

- PHP 8.2+, Composer
- MySQL (production/parity with `backend/`) — SQLite works for local dev and
  is what the test suite uses, except the search endpoint's geo (`lat`/`lng`)
  radius filter, which uses MySQL-specific SQL (`radians`, `acos`, `least`,
  `greatest`) and needs a real MySQL connection to exercise.

## Getting started

```bash
cd backend-laravel
cp .env.example .env    # fill in JWT secrets, DB credentials
composer install
php artisan key:generate   # only if APP_KEY is blank
touch database/database.sqlite   # if using the sqlite default
php artisan migrate
php artisan db:seed         # admin/owner/dealer/customer + one demo listing
php artisan serve --port=4000
```

Seeded accounts (password `Password123!`), same as `backend/`:
`admin@mydomain.dev`, `owner@mydomain.dev`, `dealer@mydomain.dev`,
`customer@mydomain.dev`.

To point at the same MySQL the Node backend uses (`docker compose up -d
mysql`), set `DB_CONNECTION=mysql` and the `DB_HOST`/`DB_DATABASE`/etc vars
in `.env` — see the commented block there.

## Tests

```bash
php artisan test
```

18 feature tests cover auth, business creation (owner/dealer paths, points
spend, ownership checks), categories, and reviews.

## Porting another module

Each ported module follows the same shape, so the pattern is mechanical:

1. Read the Node module's `*.service.ts` (business logic), `*.validation.ts`
   (zod schema → Laravel `$request->validate()` rules), `*.routes.ts`
   (path/middleware → `routes/api.php` entry).
2. Add any new tables as a migration under `database/migrations/` — keep
   column names identical (camelCase) to the Prisma schema so the JSON
   response shape doesn't change.
3. Add the Eloquent model under `app/Models/`, using the `HasUuid` trait and
   `const CREATED_AT`/`UPDATED_AT` overrides already used by the existing
   models.
4. Add a controller under `app/Http/Controllers/` returning
   `App\Support\ApiResponse::ok/created/paginated/noContent`, throwing
   `App\Exceptions\ApiException::*` for error cases — both already produce
   the exact envelope the frontend expects.
5. Wire routes in `routes/api.php` using the `auth.jwt`, `role:`, and
   `privilege:` middleware aliases already registered in `bootstrap/app.php`.
