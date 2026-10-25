# Markkito — Next.js public site

A server-rendered (SSR) Next.js app for the public, SEO-crawlable pages of
Markkito — the ones Google actually needs to index. It exists alongside
`frontend/` (the original React/Vite SPA), not instead of it — see
**"What's NOT in this app"** below before assuming a page should live here.

## Why this exists

The React/Vite SPA in `frontend/` renders everything client-side: a crawler
gets a near-empty HTML shell and has to execute JavaScript to see any real
content. That's the concrete reason Google wasn't indexing pages. This app
fixes that for the pages that matter for search — the HTML that comes back
from the server already has the business name, address, reviews, etc. in it.

## What's in this app (ported, SSR, indexable)

- `/` — home page (search hero, categories, top-rated businesses)
- `/search` — business search/directory, filterable by category, city,
  B2B/B2C, sort — crawlable pagination via real `?page=` links, not
  client-side state
- `/business/[slug]` — a business's public profile: photos, about, hours,
  services, full review list, `LocalBusiness` JSON-LD structured data,
  and a working "Send an enquiry" form (posts straight to the Laravel API,
  no login required — same as the original)
- `/about`, `/terms`, `/privacy`, `/refund-policy`, `/shipping-policy`,
  `/grievance` — static legal/trust pages (content carried over verbatim
  from `frontend/src/pages/*`, including the `[bracketed placeholder]`
  fields that still need real business details filled in)
- `/sitemap.xml`, `/robots.txt` — generated from real data (every published
  business gets a sitemap entry)

## What's NOT in this app (deliberately, still the SPA)

Login, registration, both dashboards, the admin console, classifieds
(browse/detail/post/messaging/follows/reports), favorites, my-listings, the
drag-and-drop site builder, Poster Studio, WhatsApp campaigns, QR board
management, bookings/reviews *submission* (viewing reviews is here;
writing one still requires login) — **none of this is indexed by Google
anyway**, since it all sits behind authentication. Rewriting it would have
tripled the size of this change for zero SEO benefit. Every link into one
of these areas in this app points at `NEXT_PUBLIC_APP_URL` (see below).

If Google search visibility on *these* pages specifically ever becomes a
problem, that's a different, much smaller task — most of them can't be
indexed by definition (they require a login), so it likely isn't one.

## Architecture

```
Browser ──────────────► Next.js (this app, SSR)
                              │
                              │ /api/* rewritten server-side (next.config.ts)
                              ▼
                         Laravel API (backend-laravel/)
```

- **Server Components** (every `page.tsx`) fetch data directly from the
  Laravel API using an absolute URL (`API_ORIGIN`, server-only env var) —
  this is a plain server-to-server HTTP call, so CORS never applies.
- **Client Components** (anything `"use client"`, e.g. the lead-enquiry
  form) call relative paths like `/api/v1/businesses/...`. `next.config.ts`
  rewrites `/api/*` to `API_ORIGIN` transparently, so from the browser's
  point of view it's same-origin — no CORS configuration needed on Laravel
  at all, even though this app and the API can live on completely
  different domains in production.
- Auth itself still lives entirely in the old SPA (`frontend/`), on
  whatever origin `NEXT_PUBLIC_APP_URL` points at. This app has no concept
  of "logged in" — its header always shows "Log in / Sign up"; a visitor
  already signed in on the SPA stays signed in once they click through
  there, since that's where their session actually lives (localStorage,
  same-origin only — this app can't read it even if it wanted to).

## Local development

```bash
cp .env.example .env.local   # adjust API_ORIGIN if your Laravel dev server isn't on :8000
npm install
npm run dev                  # http://localhost:3000
```

Needs the Laravel backend running (`php artisan serve`, from
`backend-laravel/`) — every page here fetches real data from it, there's no
mock/offline mode.

## Deploying (cPanel, alongside the existing PHP site)

This needs your host's **Setup Node.js App** feature (under cPanel →
Software). If you don't see that option, this app can't run server-rendered
here — talk to your host, or ask about switching to a plan that has it,
before going further.

1. **Move the Laravel app to its own hostname.** Only one thing can own a
   domain's document root / Node app root at a time, and this app is about
   to take over the root domain. The clean way: create a subdomain (e.g.
   `api.yourdomain.com`) in cPanel, pointed at `backend-laravel/public`,
   exactly like the root domain is set up today per `backend-laravel/README.md`
   "Deploying (shared hosting / cPanel)". Nothing about the Laravel app
   itself changes — it's the same install, just reachable at a new host.
2. **Set up the Node.js App** for the root domain, pointed at this
   directory (`frontend-next/`). cPanel will ask for a startup file — for
   Next.js that's handled by its own build; follow your host's Node.js App
   wizard, which typically wants `npm install && npm run build` as the
   build step and `npm run start` (or `next start`) as the run command.
3. Set these on the Node.js App's **environment variables** screen (not a
   committed `.env` file — this is server config):
   - `API_ORIGIN=https://api.yourdomain.com`
   - `NEXT_PUBLIC_SITE_URL=https://yourdomain.com`
   - `NEXT_PUBLIC_APP_URL=https://app.yourdomain.com` (see step 4)
4. **Move the old SPA to its own hostname too** (e.g. `app.yourdomain.com`)
   — it's still being served by the same Laravel install from step 1, just
   needs its own subdomain now that the root domain serves this app
   instead. `NEXT_PUBLIC_APP_URL` above must point here.
5. Once all three (root domain → this app, `api.` → Laravel, `app.` → the
   SPA via Laravel) are live, submit `https://yourdomain.com/sitemap.xml`
   in Google Search Console.

This is a real infrastructure change, not a config tweak — test it on a
staging subdomain first if you can, and don't point the live root domain
at it until you've confirmed all three pieces talk to each other correctly.

## Known simplifications (first pass — flag if any of these matter to you)

- The home page's category grid and search results use a plain grid, not
  the original SPA's promo carousel / curated-showcase components — those
  are marketing decoration, not SEO content, and were left out to focus
  this pass on indexable content itself.
- "Write a review" and "Book a service" link out to the SPA (both require
  login) rather than reimplementing those forms here.
- The header can't reflect whether a visitor is actually logged in (see
  Architecture above) — this only affects the Log in/Sign up buttons'
  wording, nothing functional.
