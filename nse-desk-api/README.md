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
| GET | `/api/zerodha` | token | connected accounts with holdings, positions, totals, and combined totals |
| POST | `/api/zerodha/connect` | token | `{ slot? }` → `{ url }`: open it to log in on Zerodha |
| GET | `/api/zerodha/callback` | – | Zerodha's Redirect URL; returns the browser to the web app |
| DELETE | `/api/zerodha/accounts/{id}` | token | disconnect one account |

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
   the `DB_*` values (`DB_CONNECTION=mysql`), `FRONTEND_URL=https://nse-agent-desk.vercel.app`,
   and `KITE_API_KEY` / `KITE_API_SECRET` from your Kite Connect app.
4. **Set up the tables and caches:**
   ```bash
   php artisan migrate --force
   php artisan config:cache && php artisan route:cache
   chown -R www-data:www-data storage bootstrap/cache   # your web server's user
   ```
5. **Zerodha:** in your Kite Connect app (developers.kite.trade) change the **Redirect URL** to
   `https://nse-api.<your-domain>/api/zerodha/callback`.
6. **Web app:** in Vercel, add `NEXT_PUBLIC_DESK_API=https://nse-api.<your-domain>` to the nse-agent-desk project and redeploy. The app then shows **Log in** and keeps each user's Zerodha accounts here.

### On cPanel hosting

- **Document root:** cPanel → *Domains* → `nse-api.<your-domain>` → *Manage* → set the document root to the project's `public` folder (e.g. `nse-api.markkito.com/public`). The `.htaccess` in the project folder is only a safety net if you can't.
- **Imunify360 / bot protection:** the web app calls this API from the browser on another site, which can't pass a "One moment, please…" check. In cPanel → *Imunify360* (or ask the host), turn off bot protection / the anti-bot challenge for this subdomain, or allow-list it.
- **Check:** `https://nse-api.<your-domain>/up` must show Laravel's "Application up" page, and `https://nse-api.<your-domain>/api/auth/me` must return `{"message":"Unauthenticated."}`. The bare domain must **not** show a file listing.

After changing `.env` later, run `php artisan config:cache` again.

**Several Zerodha accounts:** after connecting one, log out on kite.zerodha.com, then press **Connect another account** and log in with the next user ID. If Zerodha won't allow your app for that account, create another Kite Connect app and add it as `KITE_API_KEY_2` / `KITE_API_SECRET_2` (up to `_5`), with the same Redirect URL.

## Local development

```bash
composer install
cp .env.example .env && php artisan key:generate
touch database/database.sqlite && php artisan migrate
php artisan serve                      # http://127.0.0.1:8000
php artisan test                       # feature tests (Zerodha is faked)
```
Run the web app with `NEXT_PUBLIC_DESK_API=http://127.0.0.1:8000` and set `FRONTEND_URL=http://localhost:3000` here.
