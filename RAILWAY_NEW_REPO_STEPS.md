# Push this project to a new GitHub repo (for Railway)

## Step 1: Create the new repo on GitHub

1. Go to **https://github.com/new**
2. **Repository name:** e.g. `venue-reservation-railway` or `eventease-prod` (your choice)
3. Leave it **empty** (no README, no .gitignore)
4. Click **Create repository**
5. Copy the repo URL. It will look like:
   - `https://github.com/albertrg19/venue-reservation-railway.git`
   - or `https://github.com/albertrg19/eventease-prod.git`

## Step 2: Push from your PC (run in project folder)

Open a terminal in: `c:\Users\Lenovo\Desktop\venue-reservation-system`

**If you haven't run the commit yet** (see below), run:

```powershell
git add .
git commit -m "Railway setup: PORT and DATABASE_URL support"
git remote add railway https://github.com/YOUR_USERNAME/YOUR_NEW_REPO_NAME.git
git push -u railway main
```

**Replace** `YOUR_USERNAME` and `YOUR_NEW_REPO_NAME` with your GitHub username and the new repo name.

Example:
```powershell
git remote add railway https://github.com/albertrg19/venue-reservation-railway.git
git push -u railway main
```

## Step 3: Connect Railway to this repo

1. In Railway → **New** → **GitHub Repository**
2. Click **Refresh**
3. Select your **new** repo (e.g. `venue-reservation-railway`)
4. When asked for **root directory**, type: **backend**
5. Deploy

Then in the backend service → **Variables**, add `DATABASE_URL` (from Postgres **Connect**) and `JWT_SECRET`.
