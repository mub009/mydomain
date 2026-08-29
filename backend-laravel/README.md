# Markkito backend — Laravel 11 port

A Laravel 11 port of the [Node/Express backend](../backend) in `backend/`.
Same database shape (camelCase columns matching the original Prisma schema,
so the existing `frontend/` can point at either backend without changes) and
the same JSON API contract: `{ success, data }` / `{ success, data, meta }`
on success, `{ success: false, error: { code, message, details } }` on
failure, including the `error.details.issues[].path/.message` shape the
frontend's `apiErrorMessage()` reads for validation errors.

## Deploying (shared hosting / cPanel)

Point the domain's **Document Root** directly at `backend-laravel/public` —
that's the setup Laravel expects, and it's what keeps `.env`, `app/`,
`vendor/`, etc. outside the web server's reach. If your host doesn't let
you set the Document Root below the account's fixed webroot, this repo
also ships a root-level `backend-laravel/.htaccess` that transparently
forwards every request into `public/` internally (so the URL never shows
`/public/`) — a fallback, not a replacement for setting the Document Root
correctly when you can.

Either way, on the server you still need to:

- `composer install --no-dev` (a `vendor/` uploaded without running this,
  or without matching the account's PHP version, is a common cause of a
  blank/500 response)
- Copy `.env.example` to `.env`, then set real `DB_*` credentials,
  `JWT_ACCESS_SECRET`/`JWT_REFRESH_SECRET` (never the `change-me-*`
  placeholders), `APP_URL`, `APP_ENV=production`, `APP_DEBUG=false`
- `php artisan key:generate` — a missing `APP_KEY` raises
  `MissingAppKeyException` on every request
- `chmod -R 775 storage bootstrap/cache` (must be writable by the web
  server user)
- `php artisan migrate` (and `php artisan db:seed` for the demo data, if wanted)

### Deploying the frontend together with this backend

`frontend/src/api/client.ts` calls the API with a **relative** base URL
(`/api/v1`), not a full URL — it's built to be served from the exact same
origin as the API, not a separate domain. On shared hosting with no
Node runtime and no reverse proxy available, that's the simplest possible
setup: the frontend ships as static files sitting right next to Laravel's
own `public/`, so there's no CORS to configure and no second server to run.

1. `cd frontend && npm install && npm run build` — produces `frontend/dist/`
   (`index.html` + a hashed `assets/` folder).
2. Copy the **contents** of `dist/` directly into `backend-laravel/public/`
   (`cp -r frontend/dist/* backend-laravel/public/`) — merges alongside
   Laravel's own `index.php`/`.htaccess`/`favicon.ico`/`robots.txt`, no
   filename collisions. **Don't** put it in a subfolder like `public/cus/` —
   the built `index.html` references its JS/CSS with root-absolute paths
   (`/assets/...`), so anywhere but `public/` itself breaks it (blank page,
   404s on the JS/CSS in the browser console).
3. `git add backend-laravel/public && git commit` — the build output *is*
   committed here specifically so a host with no Node runtime (most cPanel
   accounts) can deploy a frontend change with nothing more than `git pull`.
   Every rebuild replaces the previous `assets/*` files with new
   content-hashed filenames, so stale ones don't linger — `git status` after
   a build shows exactly what changed.
4. `routes/web.php` has a catch-all `Route::fallback()` that serves the
   SPA's `index.html` for anything not matched by a real route (so
   client-side routes like `/business/some-slug` work on a hard
   refresh/direct link too), while leaving `api/v1/*` alone so a bad API
   route still 404s as JSON, not HTML, and real files under `assets/` are
   served directly by Apache since they exist on disk.

### Image uploads (DigitalOcean Spaces)

Every "upload a photo" button in the app — business photos/logo/cover,
product images, and category icons — goes through one endpoint,
`POST /api/v1/uploads/image` (`UploadController`), which stores the file to
a DigitalOcean Space (S3-compatible object storage, via
`league/flysystem-aws-s3-v3` on Laravel's `spaces` disk — see
`config/filesystems.php`) and returns its CDN URL. That URL is then just
saved into the same field a pasted URL would have gone into — no schema or
API-contract change. `posters` is one of the accepted `purpose` values and
already sanitizes SVG artwork (`App\Support\Uploads\SvgSanitizer`, ported
from the Node poster module's DOM-walking sanitizer, strips `<script>`,
event-handler attributes, `javascript:` URLs, unsafe CSS), ready for when
the Poster Studio module itself is ported — that module's designer/
renderer/template-slot logic is not part of this change and Poster Studio
remains otherwise unported (see "Not ported" below).

To set it up, create a Space and a Spaces API key pair in the DigitalOcean
dashboard (**Spaces Object Storage** → Create a Space, with its CDN
enabled; **API** → **Spaces Keys** → Generate New Key), then fill in 5
vars in `.env`:

```
DO_SPACES_KEY=            # the Spaces access key
DO_SPACES_SECRET=         # the Spaces secret key
DO_SPACES_REGION=blr1     # the region code chosen when creating the Space
DO_SPACES_BUCKET=your-space-name
DO_SPACES_ENDPOINT=https://blr1.digitaloceanspaces.com          # region endpoint
DO_SPACES_CDN_ENDPOINT=https://your-space-name.blr1.cdn.digitaloceanspaces.com
```

Until these are set, uploads fail with a clear `INTERNAL_ERROR` response
rather than a stack trace — everything else in the app works unaffected.
Raster images (PNG/JPEG/GIF/WebP) are capped at 5MB, SVG (posters only) at
2MB; both content-sniffed rather than trusted from the client's declared
mime type.

### Analytics (admin "Analytics" tab)

Every page load — the frontend's `usePageViewTracking` hook, on every route
change — pings `POST /api/v1/analytics/pageview` (public, no visitor action
needed) with a client-generated `visitorId` (persisted in `localStorage`,
not a cookie) and the path. `AnalyticsController` records it with the
request's IP, an IP → city/country lookup (`App\Support\Analytics\GeoLocator`,
via the free `ip-api.com` API, cached in `ip_geolocations` since an IP's
city essentially never changes and the free tier is rate-limited — a failed
or unreachable lookup just leaves location blank rather than failing the
page view), and a lightweight User-Agent sniff for device/browser
(`App\Support\Analytics\UserAgentParser`). This is broader than
`VisitorController`/the "Visitors" tab, which only records people who
explicitly shared their phone through the welcome popup.

Two admin endpoints read that table: `GET /admin/analytics/online` (the
latest page view per `visitorId` in the last 5 minutes — "who's on the site
right now") and `GET /admin/analytics/pages` (page path, view count, and
unique-visitor count, ranked, over `?range=today|7d|30d|all`). The
`page_views.createdAt` column is microsecond-precision (`timestamp(...,
6)`, with `PageView::$dateFormat` overridden to match) — Eloquent's default
second-precision timestamp otherwise makes several page views in the same
second order arbitrarily, which breaks "the latest page" for a fast SPA
navigation.

Since this tracks every visitor passively rather than only those who
opt in, it has a bigger privacy footprint than the existing Visitors
capture — worth a line in your privacy policy.

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
  The public `GET /sites/:slug` page a shopper actually lands on is ported
  for both site types: for `ECOMMERCE` it returns the business + a static
  theme keyed by `templateId` (`SiteThemes`, matching the 4 built-in
  designs) for `<Storefront/>` to render; for `WEBSITE` it serves back
  whatever `html`/`css` a site has saved.
- The drag-and-drop **brochure website** builder (`SiteType.WEBSITE` only —
  e-commerce sites don't use it): `GET /:id/site` opens the editor and, on a
  business's first visit, seeds a starter page rendered straight from the
  listing's own data (name, contact details, opening hours, services,
  photos) rather than a blank canvas; `GET /:id/site/templates/:templateId`
  previews any of the 4 built-in designs (classic/modern/elegant/vibrant)
  without saving; `PUT /:id/site` saves the editor's `html`/`css`/
  `projectData`, sanitizing `html`/`css` before they are stored (`<script>`/
  `<object>`/`<embed>`/`<base>`, inline event handlers,
  `javascript:`/`vbscript:`/`data:` URLs, and non-Google-Maps iframes are
  stripped; CSS `expression()`/`behavior`/`@import` too) — everything a
  visitor's browser would otherwise render as-is on the public site. Publish
  requires a saved `html` first (`App\Support\SiteBuilder`: `Helpers`
  builds the shared template context, `Icons` holds the inline SVGs,
  `Sanitizer` the HTML/CSS cleanup, `Templates\*` the 4 page generators,
  `TemplateRegistry` ties them together).
- Visitors (welcome-popup phone capture, revisit dedup, admin list).
- Review-QR boards: admin batch-generation and management
  (`/admin/qr-codes*`), shop-facing lookup/claim/re-point-a-board, the
  per-business review-links (Google/Instagram/Facebook/YouTube/website,
  scan-count report), and the public `/r/q/<code>` scan redirect (resolves
  to the board's channel, the shop's default, or the claim/listing page,
  with best-effort scan analytics). A deleted business releases its boards
  back to the unassigned pool.

**Not ported** (still Node-only — see `backend/src/modules/`): payments/
Stripe, B2B RFQ/quotes, WhatsApp broadcasts, Poster Studio
(`/admin/posters`), notifications, email
sending (new-order and business-welcome emails are no-ops here). Each is a
self-contained subsystem with its own tables — `admin/stats`'s
`leadCount`/`bookingCount`/`openRfqCount` still report `0`
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

### PHP regex + `strtoupper` ordering gotcha

`preg_replace('/[^A-Z0-9]/', '', $raw)` only matches *already-uppercase*
letters — run it before `strtoupper()` and it silently strips every lowercase
letter instead of keeping it (`QrCodeController::normalizeCode` did this:
`"mk-scan01"` came out as `"MK-01"`, dropping every letter). Always uppercase
first, then strip. Caught by a feature test asserting a full round-trip
(claim a code, then scan it), not by a test that only checked the normalized
*shape*.

### Empty-string query params become `null`, not `""`

Laravel's default global middleware (`ConvertEmptyStringsToNull`) turns every
empty-string input — query params included — into `null` *before*
validation runs. A cleared "All categories" dropdown or search box submits
`?categorySlug=`, which arrives as `null`, not `""`. Node's zod treats an
optional `z.string()` field as satisfied by an actual empty string, so this
is a real behavior difference, not just a message wording issue: a bare
`['sometimes', 'string']` rule rejects `null` outright ("The category slug
field must be a string"), 400ing on what should be "no filter applied".
Every optional **filter** field (used only in an `if ($x = ...)` — never
written to the database) needs `'nullable'` alongside `'sometimes'`. Don't
reflexively add `'nullable'` to fields that get written straight into
`Model::create()`/`update()` without a `?? $default` fallback first — the
column may be `NOT NULL`, and passing `null` through validation just turns a
clean 400 into a database error later.

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

68 feature tests cover auth, business creation (owner/dealer paths, points
spend, ownership checks), categories, reviews, admin (stats, user/business
management, points admin, approval flow), leads, bookings (hours/conflict
validation, status transitions), points, the storefront (catalogue, checkout
pricing/stock recompute, orders, customer report, the public site page for
both ECOMMERCE and WEBSITE), visitors, and review-QR boards (batch
generation, claim/conflict rules, scan redirects, review-link resolution).

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
