# Full deployment guide: EventEase / venue-reservation-system online

Follow this from top to bottom. Replace placeholders like `<your-backend>` with your real URLs.

---

## Prerequisites

- [ ] Code pushed to **GitHub** (this repo: e.g. `venue-reservation-system` or `EventEase-final`)
- [ ] **Railway** account (Hobby plan is enough)
- [ ] **Vercel** account (free) for frontend, or use Railway for frontend too

---

# Part 1: Railway – PostgreSQL

1. Go to [railway.app](https://railway.app) → **Dashboard** → **New Project**.
2. Click **Add service** (or “What would you like to create?”).
3. Choose **Database** → **PostgreSQL**.
4. Wait until status is **Online**.
5. Open the **Postgres** service:
   - Go to **Variables** or **Connect**.
   - Copy the **connection URL** (e.g. `postgresql://postgres:PASSWORD@HOST:PORT/railway`).  
   - Save it somewhere — you need it as **DATABASE_URL** for the backend.

---

# Part 2: Railway – Backend service (Go API)

## 2.1 Create the service

1. In the **same project**, click **+ New** → **GitHub Repository**.
2. If asked, **Configure GitHub App** and allow Railway to see your repos → **Refresh**.
3. Select the repo that contains this code (e.g. `venue-reservation-system` or `EventEase-final`).
4. After the service is created, open it and go to **Settings**.
5. Under **Source** (or **Build**):
   - Set **Root Directory** to: **`backend`**
   - Save.

## 2.2 Variables (backend)

Open the **backend** service → **Variables** tab. Add or set these.

**Required (must have):**

| Variable            | Value |
|---------------------|--------|
| **DATABASE_URL**    | The Postgres connection URL you copied in Part 1. |
| **JWT_SECRET**       | A long random string (e.g. 32+ characters). Generate one; do not use `123456`. |
| **SUPER_ADMIN_EMAIL** | Your admin login email. |
| **SUPER_ADMIN_PASSWORD** | Strong password for the super admin account. |
| **FRONTEND_URL**     | For now use `http://localhost:3000`. You will change this to your real frontend URL after Part 4. |

**URLs (use your real backend URL after first deploy):**

| Variable                | Value |
|-------------------------|--------|
| **GOOGLE_REDIRECT_URL** | `https://<your-backend>.up.railway.app/api/auth/google/callback` (replace `<your-backend>` with your backend host, e.g. `eventease-final-production-xxxx`). |

**Email (SMTP) – required for password reset / emails:**

| Variable         | Value |
|------------------|--------|
| **SMTP_HOST**    | `smtp.gmail.com` (or your provider) |
| **SMTP_PORT**    | `587` |
| **SMTP_USERNAME**| Your sending email (e.g. `eventease19@gmail.com`) |
| **SMTP_PASSWORD**| App password for that email (for Gmail: use an App Password) |
| **SMTP_FROM**    | Same as SMTP_USERNAME |

**Optional:**

| Variable                  | Value |
|---------------------------|--------|
| **BACKUP_INTERVAL_HOURS** | `24` (daily backups) |
| **GOOGLE_CLIENT_ID**      | From Google Cloud Console (if you use “Login with Google”) |
| **GOOGLE_CLIENT_SECRET**  | From Google Cloud Console (if you use Google login) |
| **SMS_API_KEY**           | Only if you use SMS features |

- Do **not** set **PORT**; Railway sets it automatically.
- If **DATABASE_URL** is set, you do **not** need DB_HOST, DB_PORT, DB_USER, DB_PASSWORD, DB_NAME.

## 2.3 Deploy backend

1. Save all variables.
2. Trigger a **Deploy** (or push a commit to the connected branch).
3. Wait until the deployment is **Success**.
4. Open the backend service → **Settings** → **Networking** (or **Deployments**): copy the **public URL** (e.g. `https://eventease-final-production-xxxx.up.railway.app`). This is your **backend URL**.

---

# Part 3: Verify backend

1. In the browser open: **`https://<your-backend>.up.railway.app/health`**  
   - You should see something like `{"status":"ok"}`.
2. Open: **`https://<your-backend>.up.railway.app/api/health/status`**  
   - You should see a healthy status (and DB connected).
3. In Railway, open the **Postgres** service → **Database** → **Data**.  
   - You should see **tables** created by the app (users, bookings, etc.).

If any step fails, check **Deployments** → **View logs** for the backend service.

---

# Part 4: Deploy frontend

You can use **Vercel** (recommended) or **Railway**.

## Option A: Vercel (recommended)

1. Go to [vercel.com](https://vercel.com) → **Add New** → **Project**.
2. **Import** your GitHub repo (same repo as backend).
3. **Configure:**
   - **Root Directory:** click **Edit** → set to **`frontend`**.
   - **Framework Preset:** Next.js (auto-detected).
   - **Build Command:** `npm run build` (default).
   - **Output Directory:** leave default.
4. **Environment Variables** – add:
   - **Name:** `NEXT_PUBLIC_API_URL`  
   - **Value:** `https://<your-backend>.up.railway.app`  
     (no `/api` at the end; the app adds `/api` when calling endpoints.)
5. Click **Deploy**.
6. When done, copy the frontend URL (e.g. `https://your-project.vercel.app`).

## Option B: Railway (frontend as second service)

**See [FRONTEND_RAILWAY_DEPLOY.md](FRONTEND_RAILWAY_DEPLOY.md) for full step-by-step.** Summary:

1. In the **same Railway project**, click **+ New** → **GitHub Repository** → select the **same repo**.
2. New service → **Settings** → **Root Directory:** **`frontend`**.
3. **Variables:** **NEXT_PUBLIC_API_URL** = `https://<your-backend>.up.railway.app`
4. **Settings** → **Start Command:** **`npx next start -p $PORT`** (required so the app listens on Railway’s port).
5. **Settings** → **Networking** → **Generate domain**; that is your frontend URL.
6. **Deploy**.

---

# Part 5: Point backend to frontend

1. Open **Railway** → your **backend** service → **Variables**.
2. Set:
   - **FRONTEND_URL** = your frontend URL (e.g. `https://your-project.vercel.app` or the Railway frontend URL).
   - **GOOGLE_REDIRECT_URL** = `https://<your-backend>.up.railway.app/api/auth/google/callback`
3. Save. Railway will redeploy the backend with the new variables.

---

# Part 6: Final checks

- [ ] **Backend:** `https://<your-backend>.up.railway.app/health` returns OK.
- [ ] **Frontend:** Open your frontend URL in the browser.
- [ ] **Login:** Log in with **SUPER_ADMIN_EMAIL** and **SUPER_ADMIN_PASSWORD** (admin).
- [ ] **Google Login:** If configured, test “Sign in with Google.”
- [ ] **Password reset:** If SMTP is set, test “Forgot password” and check email.

---

# Quick reference

| What        | URL / value |
|------------|-------------|
| Backend    | `https://<your-backend>.up.railway.app` |
| Frontend   | From Vercel or Railway (e.g. `https://xxx.vercel.app`) |
| API base   | Same as Backend; frontend uses `NEXT_PUBLIC_API_URL` |
| DB         | Use **DATABASE_URL** only; no need for DB_HOST/DB_PORT/etc. |

---

# Troubleshooting

- **Backend 500 or DB errors:** Check **DATABASE_URL** is the full Postgres URL and backend logs in Railway.
- **Frontend “Network error”:** Ensure **NEXT_PUBLIC_API_URL** is exactly the backend URL (no `/api`), and backend CORS allows your frontend origin (your app already uses FRONTEND_URL for some flows; ensure it’s set).
- **Google login redirect error:** Set **GOOGLE_REDIRECT_URL** to `https://<your-backend>.up.railway.app/api/auth/google/callback` and add the same URL in Google Cloud Console under the OAuth client **Authorized redirect URIs**.

Once Parts 1–6 are done, your system is online end-to-end.
