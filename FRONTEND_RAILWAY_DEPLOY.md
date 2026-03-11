# Deploy frontend to Railway (step-by-step)

Use this to run your Next.js frontend on Railway in the **same project** as your backend and Postgres.

**Backend URL (use this below):** `https://eventease-final-production.up.railway.app`

---

## Step 1: Add a new service from GitHub

1. Open your Railway project (**honest-radiance**).
2. Click **+ New** (or **Add service**).
3. Choose **GitHub Repository**.
4. Select the **same repo** you use for the backend (e.g. **EventEase-final** or **venue-reservation-system**).
5. Confirm so Railway creates the new service.

---

## Step 2: Set root directory to `frontend`

1. Click the **new service** (it may be named after the repo).
2. Go to **Settings**.
3. Find **Source** or **Build** section.
4. Set **Root Directory** to: **`frontend`**  
   (so Railway builds and runs only the `frontend` folder).
5. Save.

---

## Step 3: Set environment variables

1. Open the **Variables** tab for this service.
2. Add:

   | Name | Value |
   |------|--------|
   | **NEXT_PUBLIC_API_URL** | `https://eventease-final-production.up.railway.app` |

   **Important:** No trailing slash, no `/api`. The app adds `/api` when calling the backend.

3. (Optional) Set **NODE_VERSION** = `20` if you want a specific Node version for Next.js 16.

---

## Step 4: Set build and start commands

1. Stay in **Settings** (or open **Build** / **Deploy** section).
2. **Build Command** (if you have a custom field):  
   `npm install && npm run build`
3. **Start Command** (must set for Next.js on Railway):  
   `npx next start -p $PORT`  

   This makes the app listen on Railway’s port. Without it, the app may not respond.

4. Save.

---

## Step 5: Generate a public URL

1. In **Settings**, open **Networking** (or **Deploy**).
2. Under **Public Networking**, click **Generate domain** (or **Add domain**).
3. Copy the URL (e.g. `https://eventease-final-production-xxxx.up.railway.app`).  
   This is your **frontend URL**.

---

## Step 6: Deploy

1. Trigger a **Deploy** (or push a commit to the connected branch).
2. Wait until the deployment finishes (build can take a few minutes).
3. Open the **frontend URL** from Step 5 in your browser.

---

## Step 7: Point backend to this frontend

1. Open the **EventEase-final** (backend) service → **Variables**.
2. Set **FRONTEND_URL** = the frontend URL from Step 5 (e.g. `https://your-frontend.up.railway.app`).
3. Set **GOOGLE_REDIRECT_URL** = `https://eventease-final-production.up.railway.app/api/auth/google/callback`
4. Save so the backend redeploys with the new values.

---

## Troubleshooting

| Issue | What to do |
|-------|------------|
| **Application failed to respond** | Ensure **Start Command** is `npx next start -p $PORT`. Redeploy. |
| **Build fails** | Check **Root Directory** is `frontend`. Check deploy logs for missing deps or Node version. |
| **Frontend loads but API calls fail** | Check **NEXT_PUBLIC_API_URL** is exactly `https://eventease-final-production.up.railway.app` (no typo, no trailing slash). Rebuild (NEXT_PUBLIC_* is read at build time). |
| **CORS or redirect errors** | Set **FRONTEND_URL** on the backend to this frontend URL and redeploy backend. |

---

## Quick checklist

- [ ] New service from same GitHub repo
- [ ] Root Directory = `frontend`
- [ ] Variable: **NEXT_PUBLIC_API_URL** = `https://eventease-final-production.up.railway.app`
- [ ] Start Command = `npx next start -p $PORT`
- [ ] Generate domain → copy frontend URL
- [ ] Backend Variables: **FRONTEND_URL** = frontend URL, **GOOGLE_REDIRECT_URL** = backend URL + `/api/auth/google/callback`
