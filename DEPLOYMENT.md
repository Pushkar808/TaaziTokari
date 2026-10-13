# Deploying Taazi Tokari on Render

Two Render services from one GitHub repo, plus your existing Supabase Postgres database:

| Part | Render type | Folder | Notes |
|---|---|---|---|
| API | **Web Service** (Node) | `backend/` | NestJS + Prisma, routes under `/api` |
| Website | **Static Site** | repo root | Vite build in `dist/` |
| Database | Supabase (already set up) | | Used through Prisma only |

The website calls relative `/api/...` URLs (see `src/services/api/http.ts`). On Render the static site forwards `/api/*` to the API service with a **rewrite rule**, so no code change and no CORS setup is needed.

---

## 0. Before you start

1. Push the project to GitHub (`.env` is git-ignored, so secrets stay local; `.env.example` is committed).
2. Have these ready (see `.env.example`):
   - `DATABASE_URL` (Supabase)
   - `JWT_SECRET`: generate one: `node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"`
   - `GOOGLE_CLIENT_ID` (only if you use Google sign-in)
   - `ADMIN_EMAIL` / `ADMIN_PASSWORD` (the admin account the seed creates)
   - `RAZORPAY_WEBHOOK_SECRET` (only if you use online payments)

## 1. Prepare the database (one time, from your computer)

Render does not create tables for you. Run these locally against the same Supabase database (your local `.env` must hold the production `DATABASE_URL`):

```bash
cd backend
npm install
npm run db:push       # creates the tables from prisma/schema.prisma
npm run db:lockdown   # applies supabase/migrations/20261015000000_lock_down_public_api.sql
npm run db:seed       # creates catalog data and the admin from ADMIN_EMAIL / ADMIN_PASSWORD
```

Use the **session pooler / direct** connection string (port `5432`) for these commands. Repeat `db:push` whenever `schema.prisma` changes.

### Which connection string for Render?

Render is IPv4-only and Supabase's direct host is IPv6, so use a **pooler** URL (`...pooler.supabase.com`).

- Recommended for the running API: **transaction mode**, port `6543`, with `?pgbouncer=true`:
  `postgresql://postgres.<project>:<password>@aws-0-<region>.pooler.supabase.com:6543/postgres?pgbouncer=true`
- If you use session mode (port `5432`) you are limited to about 15 connections in total. The API already caps itself to 5 connections (`backend/src/prisma/prisma.service.ts`); add `&connection_limit=N` to the URL to change that. Never run more than one API instance on session mode.

URL-encode special characters in the password (`@` becomes `%40`).

## 2. Create the API (Web Service)

Render dashboard → **New → Web Service** → connect the repo.

| Field | Value |
|---|---|
| Name | `taazi-tokari-api` |
| Root Directory | `backend` |
| Runtime | Node |
| Build Command | `npm install --include=dev && npx prisma generate && npm run build` |
| Start Command | `npm run start:prod` |
| Health Check Path | `/api/catalog` |
| Instance type | Free works for testing (sleeps after ~15 min idle, slow first request); use Starter for real traffic |

`--include=dev` matters: the Nest CLI, TypeScript and Prisma CLI are dev dependencies and are needed to build.

**Environment variables** (Environment tab):

| Key | Value |
|---|---|
| `DATABASE_URL` | the pooler URL from step 1 |
| `JWT_SECRET` | your long random string |
| `FRONTEND_URL` | `https://<your-static-site>.onrender.com` (fill in after step 3; later your custom domain) |
| `GOOGLE_CLIENT_ID` | optional |
| `RAZORPAY_WEBHOOK_SECRET` | optional |
| `NODE_VERSION` | `22` (the project is developed on a recent Node; pin it so builds are reproducible) |

Do not set `PORT`; Render provides it and the app reads it.

Deploy, then open `https://taazi-tokari-api.onrender.com/api/catalog`. You should see JSON.

## 3. Create the website (Static Site)

Render → **New → Static Site** → same repo.

| Field | Value |
|---|---|
| Name | `taazi-tokari` |
| Root Directory | *(leave empty)* |
| Build Command | `npm install && npm run build` |
| Publish Directory | `dist` |

**Environment variables** (build time; `VITE_` values are public in the browser):

| Key | Value |
|---|---|
| `VITE_GOOGLE_CLIENT_ID` | optional, same as the API's |
| `VITE_APP_NAME` | `Taazi Tokari` |
| `VITE_APP_TAGLINE` | `Kishan Fresh to Kitchen` |
| `VITE_DEFAULT_CITY` | `Lucknow` |
| `VITE_DEFAULT_STATE` | `Uttar Pradesh` |

**Redirects/Rewrites** (static site → Redirects/Rewrites tab). Add them **in this order**:

| Source | Destination | Action |
|---|---|---|
| `/api/*` | `https://taazi-tokari-api.onrender.com/api/*` | **Rewrite** |
| `/*` | `/index.html` | **Rewrite** |

The first sends API calls to the backend; the second keeps page reloads working. Use your real API URL. Changing a rule does not need a rebuild.

Now go back to the API service and set `FRONTEND_URL` to the static site's URL, then redeploy it.

## 4. Third-party settings

- **Google sign-in:** Google Cloud Console → Credentials → your OAuth client → add the site URL (`https://taazi-tokari.onrender.com`, and your custom domain) under *Authorized JavaScript origins*.
- **Razorpay webhook:** Dashboard → Webhooks → URL `https://taazi-tokari-api.onrender.com/api/payments/webhook/razorpay` (point it at the API service directly, not through the static site), secret equal to `RAZORPAY_WEBHOOK_SECRET`.
- **Custom domain:** add it on the static site (Settings → Custom Domains), follow Render's DNS instructions, then update `FRONTEND_URL` and the Google origin.

## 5. Verify

1. Open the site: the catalog and categories load.
2. Sign in with `ADMIN_EMAIL` / `ADMIN_PASSWORD`: the admin console opens.
3. Place a test order as a customer, then check it in Admin → Orders.
4. In the browser DevTools Network tab, `/api/...` calls return 200 (not HTML, not CORS errors).

## 6. Updating later

- Push to the deploy branch → both services redeploy automatically.
- Schema change: run `npm run db:push` locally (step 1) **before** pushing code that needs it.
- Rotate secrets in the Render Environment tab; the service restarts.

## Troubleshooting

| Symptom | Cause / fix |
|---|---|
| Build: `nest: not found` or `prisma: not found` | Build command is missing `--include=dev` |
| `@prisma/client did not initialize yet` | `npx prisma generate` missing from the build command |
| `EMAXCONNSESSION` / "max clients reached" | Session-mode pool full. Use the `6543` + `pgbouncer=true` URL, run one instance only |
| `Can't reach database server` | Used the direct IPv6 host; switch to the pooler host |
| Website shows the page but API calls return HTML | The `/api/*` rewrite is missing or listed after `/*` |
| CORS error | You bypassed the rewrite and call the API domain directly; set `FRONTEND_URL` exactly to the site origin (no trailing slash) |
| First request takes ~30-60 s | Free instance was asleep; upgrade or keep it warm |
| Login says invalid token after redeploy | `JWT_SECRET` changed; users just sign in again |
| Seed fails: admin missing | `ADMIN_EMAIL`/`ADMIN_PASSWORD` not in the local `.env` when running `db:seed` |
