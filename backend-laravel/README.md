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
- Admin: platform stats (leads/bookings/RFQs report as 0 — see below), the
  business-creators report, user management (list/create/update, including
  the last-admin-can't-be-demoted guard), business management (list/pending/
  update/approve/reject/suspend/reassign), and dealer points admin
  (grant/deduct + transaction history).
- Leads (create — anonymous or signed-in — list, status updates), gated by
  the `MANAGE_LEADS` dealer privilege.
- Bookings (create with business-hours + double-booking validation, list
  mine/for-business, status transitions with the same
  customer-can-only-cancel rule), gated by `MANAGE_BOOKINGS`.
- Points "mine" (a dealer's own balance/ledger — the admin grant/deduct side
  was already ported with the admin module).
- Storefront/e-commerce: product catalogue (CRUD, auto-incrementing slugs,
  compare-at-price validation), orders (list with summary stats,
  status transitions that restock on cancel, customer report grouped by
  phone), and the public storefront (product listing + checkout with
  server-recomputed pricing/stock). Site type switching
  (WEBSITE/ECOMMERCE) and publish/unpublish are ported too — but only the
  fields storefront needs (`siteType`, `isPublished`, delivery settings).

**Not ported** (still Node-only — see `backend/src/modules/`): payments/
Stripe, B2B RFQ/quotes, visitors (welcome-popup capture), review-QR boards
(`/admin/qr-codes`, the `/r/<code>` redirect), the drag-and-drop **brochure
website builder** (`PUT /:id/site` for `projectData`/`html`/`css`, template
preview/rendering, HTML sanitization — `SiteType.WEBSITE` only; e-commerce
sites don't use it), WhatsApp broadcasts, Poster Studio (`/admin/posters`),
notifications, email sending (new-order and business-welcome emails are
no-ops here). Each is a self-contained subsystem with its own tables —
`admin/stats`'s `leadCount`/`bookingCount`/`openRfqCount` still report `0`
since bookings/leads exist but aren't aggregated into that endpoint yet, and
RFQs aren't ported at all. Porting any of these follows the same pattern
established here — see "Porting another module" below.

### A recurring gotcha ported modules hit twice

Eloquent does **not** reload a row after `Model::create()`/`updateOrCreate()`
— a column with only a DB-level default (`points`, `isActive`, `status`
enums with a Prisma `@default`, …) comes back `null` on the in-memory model
even though the row itself has the real default value. Always pass the
default explicitly in the `create()` array (see `AdminController::createUser`,
`BookingController::store`, `LeadController::store`), or call `->refresh()`
after an `updateOrCreate()` that might have just inserted a row (see
`SiteController::updateType`).

### Laravel positional route-parameter binding gotcha

A controller method's non-`Request` parameters are matched to route
`{placeholders}` **by position, not by name** — a route like
`/businesses/{id}/orders/{orderId}` calling a method that only declares
`string $orderId` silently receives the *business* id instead (this broke
`OrderController@show`/`updateStatus` and `ProductController@update`/
`destroy` during the storefront port; caught by feature tests, not by
inspection). Always declare **every** route segment as a method parameter,
in the same order they appear in the route, even ones the method body never
reads.

## Requirements

- PHP 8.2+, Composer
- MySQL — the configured and tested default, matching `backend/`. SQLite
  also works for local dev (and is what the automated test suite uses,
  via `phpunit.xml`, regardless of what `.env` points at) except the search
  endpoint's geo (`lat`/`lng`) radius filter, which uses MySQL-specific SQL
  (`radians`, `acos`, `least`, `greatest`) and needs a real MySQL connection
  to exercise.

## Getting started

`.env.example` defaults to MySQL — the same `mydomain`/`mydomain`/`mydomain`
database/user/password the repo's `docker-compose.yml` provisions for the
Node backend, so either backend can point at the same server.

```bash
cd backend-laravel
cp .env.example .env    # fill in JWT secrets; DB_* already points at MySQL
composer install
php artisan key:generate   # only if APP_KEY is blank

# Start MySQL: either `docker compose up -d mysql` from the repo root, or
# point DB_HOST/DB_DATABASE/DB_USERNAME/DB_PASSWORD in .env at your own server.
php artisan migrate
php artisan db:seed         # admin/owner/dealer/customer + one demo listing
php artisan serve --port=4000
```

Seeded accounts (password `Password123!`), same as `backend/`:
`admin@mydomain.dev`, `owner@mydomain.dev`, `dealer@mydomain.dev`,
`customer@mydomain.dev`.

For a zero-setup local start without MySQL, switch `.env` to
`DB_CONNECTION=sqlite` (comment out the `DB_HOST`/etc lines) and
`touch database/database.sqlite` — everything works except the search
endpoint's geo (`lat`/`lng`) radius filter, which uses MySQL-specific SQL
(`radians`, `acos`, `least`, `greatest`).

## Tests

```bash
php artisan test
```

47 feature tests cover auth, business creation (owner/dealer paths, points
spend, ownership checks), categories, reviews, admin (stats, user/business
management, points admin, approval flow), leads, bookings (hours/conflict
validation, status transitions), points, and the storefront (catalogue,
checkout pricing/stock recompute, orders, customer report).

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
