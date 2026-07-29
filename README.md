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

### Pulling changes that touch the database

`prisma migrate deploy` updates MySQL but does **not** regenerate the Prisma
client, so running it alone leaves the server with a client that has never
heard of the new tables. Do both, then restart:

```bash
cd backend
npm run db:update          # migrate deploy + prisma generate
npm run dev                # restart — the client is loaded at boot
```

The server refuses to start against a stale client and names exactly what is
missing — including individual **columns**, not just whole tables, since a
migration that only adds fields otherwise starts up fine and then fails
mid-request with `Unknown field \`bandStyle\` for select statement`.

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
- **WhatsApp broadcasts** — a shop links its own WhatsApp number by scanning a
  QR code, imports customers from an .xlsx file, saves reusable templates with
  `{{name}}`-style placeholders, and sends a campaign. See below.
- **Poster Studio** — admins catalogue posters: name, category, the image file
  and the prompt it came from. See below.

## WhatsApp broadcasts

Business dashboard → **WhatsApp**. Four steps: link the account, import
contacts, write a template, send a campaign.

**Download the template** under WhatsApp → Contacts for a sheet that is already
the right shape: a fillable `Contacts` tab with the phone column formatted as
text (so Excel cannot turn `9876543210` into `9.87654E+09`), plus a `How to use`
tab explaining the columns and accepted phone formats.

Contacts are read from a spreadsheet with **exceljs**. Columns are matched by
heading rather than position, so "Mobile No.", "WhatsApp Number" and "Contact
no" all find the phone column; a sheet with no header falls back to
name-then-phone. Numbers are normalised to `country code + digits`, a bare
10-digit number is treated as Indian, and unusable rows are reported back with
the row number rather than dropped silently.

Sending goes through **whatsapp-web.js**, which drives a real linked WhatsApp
account. Two things follow from that:

- **It is not an official WhatsApp API.** Meta does not sanction bulk sending
  from a normal account, and a number used carelessly can be restricted or
  banned. For volume, the official WhatsApp Business Cloud API is the
  supported route; the transport sits behind an interface
  (`modules/whatsapp/transport.ts`) so a Cloud API implementation can be
  dropped in without touching anything else.
- **Sending is deliberately slow.** One message at a time, with a pause and
  random jitter between each, and a hard daily cap. Each shop sets its own
  pace, cap and quiet hours under **WhatsApp → Sending**; the env values only
  seed the defaults. Raising them raises the risk.

`WHATSAPP_TRANSPORT` defaults to `log`, which records what *would* be sent
without touching WhatsApp, so the whole flow can be exercised safely.

### Switching on real sending (`webjs`)

whatsapp-web.js drives a real Chromium. The install skips Puppeteer's bundled
browser download, so you must give it one — either install Puppeteer's:

```bash
cd backend
npx puppeteer browsers install chrome
```

...or point at a Chromium you already have. Find its real path first — do not
copy a path from this README, it varies by machine:

```bash
which chromium chromium-browser google-chrome google-chrome-stable
```

```bash
# backend/.env
WHATSAPP_TRANSPORT=webjs
# Leave EMPTY if you ran `npx puppeteer browsers install chrome` above.
# Otherwise paste the path `which` actually printed.
WHATSAPP_CHROMIUM_PATH=
WHATSAPP_SESSION_DIR=.whatsapp-sessions
```

A path that does not exist is caught at connect time and reported with the
command that fixes it, rather than surfacing as a bare "Browser was not found".

Then restart the backend (`.env` is read at boot, so a file save is not enough)
and open **Business dashboard → WhatsApp → Connection → Link WhatsApp**. A QR
appears; on the phone go to **WhatsApp → Settings → Linked devices → Link a
device** and scan it. The page polls and flips to "connected" on its own.

Notes for a real deployment:

- **The session directory is live credentials.** Anyone with a copy can send as
  that shop. It is gitignored; back it up like a secret, or every shop must
  re-scan after a deploy.
- **The linked phone must stay online.** WhatsApp Web is a companion to the
  handset, not a replacement for it.
- **The server needs outbound access to `web.whatsapp.com`.** Behind a proxy
  that blocks it, linking fails with `ERR_TUNNEL_CONNECTION_FAILED`.
- **Chromium needs its own dependencies.** On a slim container that usually
  means `libnss3 libatk1.0-0 libatk-bridge2.0-0 libcups2 libdrm2 libxkbcommon0
  libxcomposite1 libxdamage1 libxrandr2 libgbm1 libpango-1.0-0 libasound2`.
- One browser runs per linked business, so memory scales with the number of
  shops sending at once.

### Sending controls (per shop)

| Control | What it does |
|---|---|
| Messages per day | Sending stops once reached and resumes tomorrow. Counts every campaign, not just the current one. |
| Gap between messages | Pause after each send. Floor of 2s — anything faster is a burst. |
| Random extra | Jitter added on top, so the spacing is not machine-regular. |
| Sending window | Whole hours; nothing goes out outside them. A long campaign waits overnight and resumes by itself. Equal start/stop means any time. |
| Auto opt-out on STOP | Marks a contact opted out when they reply STOP, unsubscribe, opt out, remove me and similar. |

The tab shows what the chosen pace means in practice ("a full day of 250
messages takes about 42 min of sending time — roughly 360 an hour"), and a
**test send** delivers one message to a number of your choosing so wording and
placeholders can be checked before a list of hundreds goes anywhere. Test sends
do not count towards the daily cap.

A campaign with failures (numbers not on WhatsApp, a drop mid-send) can have
just those messages re-queued with **Retry**, instead of being rebuilt.

Opt-outs are respected at three points: contacts marked opted out are excluded
when a campaign is built, re-checked again immediately before each message goes
out so someone who stops mid-campaign is skipped, and set automatically when a
customer replies STOP. Re-importing a spreadsheet never resurrects an opted-out
number.

## Poster Studio

### Admin — cataloguing a poster

Admin console → **Posters** → **New poster**. A poster is an image somebody
designed, and the form is exactly that:

| Field | |
|---|---|
| **Design name** | What to call it — "Diwali 2026 — jewellery" |
| **Category** | Which trade it is for |
| **Image file** | The design itself: PNG, JPEG, WebP or GIF, up to 4MB |
| **AI prompt** | The prompt it came from, kept for reference and for regenerating the design later |

Save as a draft or publish it. Nothing about layout, colour or wording is
asked for: a poster is catalogued, not composed. Who filed it is recorded on
the row automatically, so nobody has to be picked from a list.

**The prompt is stored, not executed.** It is the record of what was asked
for. Regeneration from it is a later step.

Uploads are judged on their **bytes**, not the mimetype the browser claims — a
text file renamed `.png` is refused. SVG is refused outright: it is a document
that can carry script, and it would be embedded in a document the platform
serves from its own origin. With no object storage here the image is kept
inline on the row as a data URI, which is also what the browser needs to
export a PNG from the rendered poster. The design body therefore outgrows the
1mb JSON limit, so the poster routes get a larger parser, registered ahead of
the global one the way the Stripe webhook already is; and the list query
excludes the image column, because twenty-five rows of inline image is not a
list response.

### Rendering — still to come

The per-business side is built but is **not** part of the admin flow above: a
shop opens **Manage → Posters** and downloads a published design with its own
logo, name and phone number composited on, as SVG or PNG. How that should work
is the next thing to settle — the machinery in `modules/posters/layouts.ts`
(header/footer bands sampled from the artwork, logo placement, four drawn
layouts) is what exists today, not a decision that has been signed off.

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

### Business websites (GrapesJS builder)

Each business can build a one-page website from its dashboard:
**Manage → Website**.

The first draft is generated server-side from the data already in the listing —
name, description, contact details, address, opening hours, active services and
photos — so a shop has a usable page before touching anything. The owner then
edits it with drag-and-drop blocks; their saved document becomes the source of
truth, and "Reset" rebuilds the draft from the current listing data.

- Draft and published states are separate: **Save** stores the draft,
  **Publish** makes it live at `/site/<business-slug>`, and unpublishing takes
  it offline without deleting it.
- Their listing photos are preloaded into the editor's asset manager. Images are
  added by URL — file uploads are not enabled.
- Published HTML/CSS is sanitised server-side on save (scripts, inline event
  handlers, `javascript:`/`data:` URLs, iframes, forms, `@import`,
  `expression()` and `behavior:` are stripped), because the page renders on the
  platform's own origin. See `backend/tests/sanitize.test.ts`.
- The editor bundle is loaded on demand, so it does not affect the main app's
  bundle size.
