# Taazi Tokari

Farm-fresh produce pre-ordering for Lucknow. A React app (Vite) talks only to a NestJS REST API, which
talks to Postgres through Prisma. Supabase is used purely as the Postgres host.

```
browser  ->  /api (Vite proxy)  ->  NestJS (backend/)  ->  Postgres (Supabase)
```

## Setup

1. `cp .env.example .env` and fill it in (see the comments in the file).
2. Install: `npm install && npm --prefix backend install`
3. Database (once, from `backend/`):
   - `npm run db:lockdown` removes the old Supabase policies/functions and blocks the Supabase REST API
   - `npm run db:push` creates the tables from `backend/prisma/schema.prisma`
   - `npm run db:seed` loads the catalogue and creates the admin from `ADMIN_EMAIL` / `ADMIN_PASSWORD`

## Run

`npm run dev:all` starts the API on http://localhost:4000 and the web app on http://localhost:3000.
Or run `npm run dev:api` and `npm run dev` in two terminals.

## Test and build

- Backend: `cd backend && npm test && npm run build`
- Frontend: `npm run lint && npm run build`

## Notes

- Login: email + password (bcrypt hashes in `profiles`) or Google. The API issues a JWT; the role (`customer` / `admin`) comes from the database.
- Orders are priced on the server: the browser sends only product ids and quantities.
- Razorpay webhook: `POST /api/payments/webhook/razorpay` (signature checked against `RAZORPAY_WEBHOOK_SECRET`).
