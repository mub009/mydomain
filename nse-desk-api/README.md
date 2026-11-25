# NSE Desk API

API-only Laravel 11 backend for **NSE Agent Desk** (the Next.js app in `../nse-agent-desk`).

- **Logins:** sign up and log in with email and password; each device gets a bearer token (Laravel Sanctum).
- **Zerodha, per user:** each user connects any number of Zerodha accounts (their own, family's) through Zerodha's official Kite Connect login. Holdings and today's positions are read-only, per account and combined. Access tokens are stored encrypted with `APP_KEY` and end at 06:00 IST, when Kite sessions end.

## Endpoints

| Method | Path | Auth | |
|---|---|---|---|
| POST | `/api/auth/register` | – | `name, email, password, password_confirmation` → `{ token, user }` |
| POST | `/api/auth/login` | – | `email, password` → `{ token, user }` |
| GET | `/api/auth/me` | token | the logged-in user |
| POST | `/api/auth/logout` | token | ends this device's login |
| GET | `/api/zerodha` | token | accounts with their **saved** holdings and positions (from the database), totals and combined totals; an account never synced is synced first |
| POST | `/api/zerodha/refresh` | token | fetch every connected account again from Zerodha and save it: sold stocks are removed, new ones added; returns the same as GET plus `refreshed: { removed, added, errors }` |
| POST | `/api/zerodha/connect` | token | `{ slot? }` → `{ url }`: open it to log in on Zerodha |
| GET | `/api/zerodha/callback` | – | Zerodha's Redirect URL; returns the browser to the web app |
| DELETE | `/api/zerodha/accounts/{id}` | token | remove one account and its saved holdings |
| POST | `/api/zerodha/apps` | token | `label?, api_key, api_secret` → save your Kite Connect app |
| DELETE | `/api/zerodha/apps/{id}` | token | remove an app (its accounts are disconnected) |
| GET | `/api/watchlist` | token | `{ items: [{ symbol, note, addedPrice, addedAt }] }`, newest first |
| POST | `/api/watchlist` | token | `symbol, note?, price?`: add a stock (up to 200), or update its note |
| DELETE | `/api/watchlist/{symbol}` | token | remove a stock |

**Saved holdings.** Zerodha holdings and positions are stored in `broker_holdings` (one row each, replaced on every refresh) with `broker_accounts.synced_at`. When a Kite session ends (06:00 IST daily) the account is kept with no token and its saved holdings stay visible until it is reconnected or removed.
| PUT | `/api/auth/profile` | token | `name, email` |
| PUT | `/api/auth/password` | token | `current_password, password, password_confirmation` (logs out other devices) |
| GET | `/api/auth/devices` | token | how many devices are logged in |
| POST | `/api/auth/logout-others` | token | log out every other device |
| DELETE | `/api/auth/account` | token | `password` → delete the account |

Send the token as `Authorization: Bearer <token>`. Errors are JSON; login and sign-up are limited to 10 tries a minute.

## Deploy (same server as Markkito)

Needs PHP 8.2+, Composer and MySQL (or MariaDB), like Markkito.

1. **Subdomain:** point e.g. `nse-api.<your-domain>` at the server, with HTTPS. Its web root must be this project's `public/` folder (nginx `root …/nse-desk-api/public;` with the usual Laravel `try_files $uri $uri/ /index.php?$query_string;`).
2. **Database:** create an empty MySQL database and user for it, separate from Markkito's.
3. **Code and settings:**
   ```bash
   cd /var/www/nse-desk-api            # wherever you put it
   composer install --no-dev --optimize-autoloader
   cp .env.example .env
   php artisan key:generate
   ```
   In `.env` set `APP_ENV=production`, `APP_DEBUG=false`, `APP_URL=https://nse-api.<your-domain>`,
   the `DB_*` values (`DB_CONNECTION=mysql`) and `FRONTEND_URL=https://nse-agent-desk.vercel.app`.
   No Kite keys go in `.env`: each user adds their own Kite Connect app in the web app.
4. **Set up the tables and caches:**
   ```bash
   php artisan migrate --force
   php artisan config:cache && php artisan route:cache
   chown -R www-data:www-data storage bootstrap/cache   # your web server's user
   ```
5. **Zerodha:** every Kite Connect app (developers.kite.trade) used with this API needs the **Redirect URL**
   `https://nse-api.<your-domain>/api/zerodha/callback`. Users paste the app's API key and secret on the
   Positions page; they're stored in the `kite_apps` table, the secret encrypted with `APP_KEY`.
6. **Web app:** in Vercel, add `NEXT_PUBLIC_DESK_API=https://nse-api.<your-domain>` to the nse-agent-desk project and redeploy. The app then shows **Log in** and keeps each user's Zerodha accounts here.

### On cPanel hosting

- **Document root:** cPanel → *Domains* → `nse-api.<your-domain>` → *Manage* → set the document root to the project's `public` folder (e.g. `nse-api.markkito.com/public`). If you can't, copy `htaccess.example` to `.htaccess` in the project folder as a safety net (it is git-ignored, so your server keeps its own copy).
- **Imunify360 / bot protection:** the web app calls this API from the browser on another site, which can't pass a "One moment, please…" check. In cPanel → *Imunify360* (or ask the host), turn off bot protection / the anti-bot challenge for this subdomain, or allow-list it.
- **Check:** `https://nse-api.<your-domain>/up` must show Laravel's "Application up" page, and `https://nse-api.<your-domain>/api/auth/me` must return `{"message":"Unauthenticated."}`. The bare domain must **not** show a file listing.

After changing `.env` later, run `php artisan config:cache` again.

**Several Zerodha accounts:** after connecting one, log out on kite.zerodha.com, then press **Connect another account** and log in with the next user ID. If Zerodha won't allow your app for that account, add another Kite Connect app (**Add another Kite app**, up to 10 per user) with the same Redirect URL.

**Keep `APP_KEY` safe and unchanged** once users have saved Kite apps: it encrypts their secrets and Zerodha tokens, so a new key makes them unreadable (users would need to add their apps again).

## Local development

```bash
composer install
cp .env.example .env && php artisan key:generate
touch database/database.sqlite && php artisan migrate
php artisan serve                      # http://127.0.0.1:8000
php artisan test                       # feature tests (Zerodha is faked)
```
Run the web app with `NEXT_PUBLIC_DESK_API=http://127.0.0.1:8000` and set `FRONTEND_URL=http://localhost:3000` here.
