# Architecture

## Style: modular monolith

The backend is a single Express service, but internally partitioned into
self-contained domain modules under `backend/src/modules/*`. Each module
follows the same shape:

```
modules/<domain>/
  <domain>.routes.ts       Express Router — wires middleware to handlers
  <domain>.controller.ts   HTTP glue: parses req, calls service, shapes res
  <domain>.service.ts      Business logic, authorization checks, Prisma calls
  <domain>.validation.ts   Zod schemas for request bodies/queries
```

This keeps route/HTTP concerns out of business logic, and business logic
out of the ORM's model shape (services return the fields callers need, not
raw Prisma rows), while avoiding a premature microservice split — the
domains share one MySQL database and one deploy unit, which is the right
tradeoff at this stage. A domain module is intentionally the seam along
which this could later split into services (e.g., extracting `payments` or
`search` behind a queue) without cross-cutting rewrites, because each
module only talks to Prisma and to other modules' exported service
functions — never reaching into another module's internals.

## Request lifecycle

`app.ts` composes: `helmet` → `cors` → `compression` → request logging →
(Stripe webhook route, raw body) → JSON body parser → rate limiting →
module routers → 404 handler → centralized `errorHandler`.

Errors are raised as `AppError` (with an HTTP status + machine-readable
`code`) from anywhere in a service and caught once, centrally — handlers
never need their own try/catch for expected failure modes. Prisma's known
error codes (unique constraint violations, missing records) and Zod
validation errors are translated to the same envelope shape.

## Data model

See `backend/prisma/schema.prisma` for the full model. The core entity
graph:

```
User ──owns──> Business ──has──> Category
                  │                 │
                  ├─ BusinessHours  └─ (self-referencing tree)
                  ├─ BusinessPhoto
                  ├─ Service ──has bookings──> Booking ──customer──> User
                  ├─ Review <──author── User
                  └─ Lead <──customer(optional)── User

User ──buyer──> Rfq ──category──> Category
                  ├─ RfqInvite ──> Business
                  └─ Quote ──business/supplier──> Business/User

Booking ──1:1──> Payment <──user── User
```

Design decisions worth calling out:

- **Ratings are denormalized** (`Business.avgRating`, `reviewCount`) and
  recalculated transactionally whenever a review is created/deleted, so
  list/search queries never need to aggregate reviews at read time.
- **Leads and Bookings are separate models** even though both originate
  from a business profile: a lead is an unstructured inquiry (sales
  pipeline: new → contacted → qualified → converted/lost), a booking is a
  structured, time-boxed commitment against a `Service` with its own state
  machine and conflict checking. Conflating them would force one of the two
  workflows to carry fields it doesn't need.
- **RFQ/Quote is a separate bounded context from Lead**, modeling B2B
  procurement (one buyer, many competing supplier quotes, an award step)
  rather than the 1:1 consumer inquiry that `Lead` represents.

## Search

`search.service.ts` builds a parameterized raw SQL query (via
`Prisma.sql`/`Prisma.join`, never string concatenation) combining keyword
`LIKE`, category/city filters, and a Haversine great-circle distance
expression for geo radius + distance sorting. This was chosen over a spatial
index or a dedicated search engine to keep the local dev stack to "just
MySQL" while the catalog is small; the query is shaped so that swapping the
distance expression for a `POINT` column + `ST_Distance_Sphere`/spatial
index, or moving the whole query to a dedicated search index
(Elasticsearch/Meilisearch), is a contained change, not a rewrite of calling
code.

## Auth

Short-lived JWT access tokens (default 15m) authenticate requests via
`Authorization: Bearer`. Refresh tokens are opaque random strings stored in
the `RefreshToken` table (not JWTs) so they can be revoked server-side and
rotate on every use — `POST /auth/refresh` issues a new pair and revokes
the old refresh token, so a stolen-but-already-used refresh token is
inert. Role-based access (`CUSTOMER` / `BUSINESS_OWNER` / `ADMIN`) is
enforced by `requireRole` middleware plus per-resource ownership checks in
services (e.g. only a business's owner or an admin can update it).

## Payments

Stripe is the only integration point for money movement. `PaymentIntent`s
back one-off booking payments; Checkout Sessions back subscription
upgrades. The webhook handler is mounted before the global JSON body
parser and given `express.raw()` specifically, because Stripe's signature
verification (`stripe.webhooks.constructEvent`) requires the exact raw
request bytes — a common integration bug is parsing JSON first and losing
that signature.

## Frontend

A single Vite/React SPA with role-aware routing (`ProtectedRoute`): public
search/listing pages, an authenticated customer flow (reviews, bookings,
leads), a business-owner dashboard (listings, lead inbox, booking
calendar), and an admin approval queue. API calls go through a single axios
instance with a request interceptor for the bearer token and a response
interceptor that transparently refreshes on 401 and replays the original
request once.
