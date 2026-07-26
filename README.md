# Markkito — Local Business Directory & Marketplace Platform

A Justdial-style local business directory and marketplace: search, listings,
reviews, lead generation, bookings, payments, and a B2B RFQ/quote
marketplace — built as a modular-monolith with a clean separation between
domain modules.

## Stack

| Layer     | Choice                                                             |
|-----------|---------------------------------------------------------------------|
| Backend   | Node.js, TypeScript, Express, Prisma ORM, MySQL, Redis, Stripe      |
| Frontend  | React 18, TypeScript, Vite, Tailwind CSS, Zustand, React Router     |
| Auth      | JWT access + rotating refresh tokens, bcrypt password hashing       |
| Tests     | Vitest + Supertest (backend)                                        |

See [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) for the domain model and
module boundaries.

## Project layout

```
backend/    Express API — modular monolith, one folder per domain module
frontend/   React SPA consuming the API
docs/       Architecture notes
docker-compose.yml   MySQL + Redis + backend + frontend for local dev
```

## Getting started

### 1. Infrastructure

```bash
docker compose up -d mysql redis
```

### 2. Backend

```bash
cd backend
cp .env.example .env       # fill in secrets (JWT, Stripe keys)
npm install
npm run prisma:migrate     # creates schema in MySQL
npm run prisma:seed        # core categories/users + one showcase business
npm run seed:businesses    # optional: 100 demo businesses (see below)
npm run dev                # http://localhost:4000
```

Seeded accounts (password `Password123!`):
- `admin@mydomain.dev` — ADMIN
- `owner@mydomain.dev` — BUSINESS_OWNER
- `dealer@mydomain.dev` — DEALER (admin-managed; can add/manage stores)
- `customer@mydomain.dev` — CUSTOMER

#### Demo catalogue (`npm run seed:businesses`)

Populates 100 published businesses across 10 categories (Restaurants, Home
Services, Beauty & Spa, Health & Medical, Education, Automotive, Event
Services, Fitness, Electronics Repair, Real Estate) and 10 Indian cities.
Every listing gets a full profile: description, contact details, address with
coordinates, 5 photos, 7-day opening hours (one closed day), 2–4 priced
services, and 2–8 reviews with the rating summary recomputed from them.

Listings are owned by `owner1@demo.markkito.dev` … `owner100@demo.markkito.dev`
(same password). The script is idempotent — it upserts by slug, so re-running
it will not create duplicates.

Photos come from `picsum.photos`, so image thumbnails need outbound internet
access; the UI falls back to a category icon when an image cannot be loaded.

### 3. Frontend

```bash
cd frontend
npm install
npm run dev                # http://localhost:5173 (proxies /api to :4000)
```

### 4. Tests

```bash
cd backend && npm test
```

## Feature coverage

- **Search** — keyword + category + city + radius (Haversine) + rating
  filters, sortable by relevance/rating/distance/newest (`GET /api/v1/search`).
- **Listings** — business CRUD, photos, weekly hours, service catalog,
  owner-only mutation, admin approval workflow (draft → pending → published).
- **Reviews** — one review per user per business, aggregate rating rollup,
  owner replies.
- **Lead generation** — inquiry capture from a business profile (name/phone/
  message), owner-facing lead inbox with a status pipeline
  (new → contacted → qualified → converted/lost).
- **Bookings** — service-scoped scheduling validated against business hours
  and existing bookings, status state machine (pending → confirmed →
  completed/cancelled/no-show).
- **Payments** — Stripe PaymentIntents for bookings and Checkout Sessions for
  subscriptions, with webhook-driven status updates. Requires real Stripe
  keys to exercise end-to-end; the API gracefully reports "not configured"
  otherwise.
- **B2B services** — buyers post RFQs, businesses submit competing quotes,
  buyer awards a quote (auto-rejecting the rest).
- **Admin** — pending-business approval queue, platform stats.

## API shape

All endpoints are namespaced under `/api/v1`. Responses are JSON:
`{ success, data }` or `{ success, data, meta }` for paginated lists, and
`{ success: false, error: { code, message } }` on failure.

Auth: `Authorization: Bearer <accessToken>`; refresh via
`POST /api/v1/auth/refresh` with a stored refresh token (rotated on use).

## Notes on scope

This is a complete, runnable reference implementation of the platform's
core domain — not a byte-for-byte clone of any commercial product. A few
things are intentionally scaffolded rather than fully productionized:
image upload is URL-based (no object storage integration), SMS/email
notifications are not wired to a provider, and geo-search uses a Haversine
SQL query rather than a spatial index or a dedicated search engine (noted
as the natural next step in `search.service.ts` once listing volume
warrants it).
