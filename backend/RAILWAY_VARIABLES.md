# All environment variables for Railway (EventEase-final backend)

Use this list to fill the **Variables** tab in Railway.  
**Never commit real secrets to Git.** Use Railway’s **Secrets** for passwords and API keys, then reference with `${{ secret() }}` or the variable name Railway gives you.

---

## Required (must set)

| Variable | Where to get value | Example / note |
|----------|--------------------|----------------|
| **DATABASE_URL** | Postgres service → **Connect** → copy connection URL | `postgresql://postgres:xxx@xxx.railway.app:5432/railway` |
| **JWT_SECRET** | Generate a long random string; store as **Secret** in Railway | e.g. 32+ random characters; use `${{ secret() }}` |
| **PORT** | Leave empty; Railway sets it automatically | — |

---

## Super admin (required for first login)

| Variable | What to put |
|----------|-------------|
| **SUPER_ADMIN_EMAIL** | Your admin email |
| **SUPER_ADMIN_PASSWORD** | Strong password; store as **Secret**, use `${{ secret() }}` |

---

## URLs (use your real deployed URLs)

| Variable | What to put |
|----------|-------------|
| **FRONTEND_URL** | Frontend URL, e.g. `https://your-app.vercel.app` or `http://localhost:3000` |
| **GOOGLE_REDIRECT_URL** | `https://<your-backend>.up.railway.app/api/auth/google/callback` (replace with your Railway backend URL) |

---

## Email (SMTP)

| Variable | What to put |
|----------|-------------|
| **SMTP_HOST** | `smtp.gmail.com` (or your provider) |
| **SMTP_PORT** | `587` |
| **SMTP_USERNAME** | Sender email (e.g. `eventease19@gmail.com`) |
| **SMTP_PASSWORD** | App password / SMTP password; store as **Secret**, use `${{ secret() }}` |
| **SMTP_FROM** | Same as SMTP_USERNAME or your “From” address |

---

## Google OAuth (optional; only if you use “Login with Google”)

| Variable | What to put |
|----------|-------------|
| **GOOGLE_CLIENT_ID** | From Google Cloud Console |
| **GOOGLE_CLIENT_SECRET** | From Google Cloud Console; store as **Secret**, use `${{ secret() }}` |

---

## Database (only if you do **not** use DATABASE_URL)

If **DATABASE_URL** is set, the app ignores these. Otherwise set:

| Variable | What to put (Railway Postgres) |
|----------|-------------------------------|
| **DB_HOST** | From Postgres Variables (e.g. `xxx.railway.app`) |
| **DB_PORT** | From Postgres Variables (e.g. `5432`) |
| **DB_USER** | From Postgres Variables (e.g. `postgres`) |
| **DB_PASSWORD** | From Postgres Variables; prefer Secret / `${{ secret() }}` |
| **DB_NAME** | From Postgres Variables (e.g. `railway`) |
| **DB_SSLMODE** | `require` (Railway Postgres uses SSL) |

---

## Optional

| Variable | What to put |
|----------|-------------|
| **BACKUP_INTERVAL_HOURS** | `24` (daily backups) or leave empty |
| **BACKUP_DIR** | `./backups` or leave empty |
| **SMS_API_KEY** | Your SMS provider API key if you use SMS; otherwise leave empty |
| **SQLITE_FILE** | Leave empty (you use Postgres) |

---

## Frontend (for Vercel / other host, not Railway backend)

Set these in your **frontend** project (e.g. Vercel env):

| Variable | What to put |
|----------|-------------|
| **NEXT_PUBLIC_API_URL** | `https://<your-backend>.up.railway.app` (no `/api` at the end if your frontend adds it) |
| **NEXT_PUBLIC_ASSET_BASE_URL** | Optional; same as API base if assets are served from backend |

---

## One-line checklist (backend on Railway)

- [ ] **DATABASE_URL** = Postgres connection URL from Railway  
- [ ] **JWT_SECRET** = Secret  
- [ ] **SUPER_ADMIN_EMAIL** = your email  
- [ ] **SUPER_ADMIN_PASSWORD** = Secret  
- [ ] **FRONTEND_URL** = your frontend URL  
- [ ] **GOOGLE_REDIRECT_URL** = backend URL + `/api/auth/google/callback`  
- [ ] **SMTP_HOST**, **SMTP_PORT**, **SMTP_USERNAME**, **SMTP_FROM** = your SMTP values  
- [ ] **SMTP_PASSWORD** = Secret  
- [ ] **GOOGLE_CLIENT_ID** / **GOOGLE_CLIENT_SECRET** = if using Google login (secret for client secret)
