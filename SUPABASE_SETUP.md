# Supabase Setup (CampusBite)

This guide configures college-restricted email/password auth end-to-end.

## 1. Create Supabase project

1. Open Supabase dashboard and create/select your project.
2. Copy these values from Project Settings:
   - `Project URL` -> `SUPABASE_URL` / `REACT_APP_SUPABASE_URL`
   - `anon key` -> `REACT_APP_SUPABASE_ANON_KEY`
   - `service_role key` -> `SUPABASE_SERVICE_ROLE_KEY`
   - `JWT secret` -> `SUPABASE_JWT_SECRET`

## 2. Run SQL for `public.users`

Execute this file in Supabase SQL editor:

`backend/supabase_users.sql`

It creates:
- `public.users` profile table
- unique profile fields (`email`, `auid`, `phone`)
- domain check (`@acharya.ac.in`)
- RLS + read-own policy

## 3. Supabase Auth settings

In Supabase Auth settings:
1. Enable `Email` provider.
2. Enable email confirmations (required).
3. Set a valid redirect URL for password reset:
   - `https://<your-frontend-domain>/reset-password`

## 4. Backend environment (required)

Set these on your backend host (Render/Railway/etc.):

- `APP_ENV=production`
- `JWT_SECRET=<strong-random-secret>`
- `CORS_ORIGINS=https://campusbite-secure.vercel.app`
- `MONGO_URL=<mongo-connection-string>`
- `DB_NAME=campusbite`
- `SUPABASE_URL=<project-url>`
- `SUPABASE_SERVICE_ROLE_KEY=<service-role-key>`
- `SUPABASE_JWT_SECRET=<jwt-secret>`
- `SUPABASE_JWT_AUD=authenticated`
- `SUPABASE_JWT_ISSUER=<project-url>/auth/v1`
- `SUPABASE_REQUIRE_EMAIL_VERIFIED=true`
- `ALLOWED_EMAIL_DOMAIN=acharya.ac.in`
- `ALLOW_LEGACY_STUDENT_LOGIN=false`

Optional:
- `ADMIN_EMAIL`, `ADMIN_PASSWORD` (seed admin)
- `STAFF_SEED_JSON` (seed canteen staff)
- `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_CLAIMS_EMAIL`

## 5. Frontend environment on Vercel (required)

Set these in Vercel project `campusbite-secure`:

- `REACT_APP_BACKEND_URL=<your-backend-base-url>`
- `REACT_APP_SUPABASE_URL=<project-url>`
- `REACT_APP_SUPABASE_ANON_KEY=<anon-key>`

After setting env vars, redeploy:

```bash
cd frontend
npx vercel deploy --prod --yes --scope sujalsinghrathore52-6155s-projects
```

## 6. Verification checklist

1. Register with `@acharya.ac.in` email -> succeeds.
2. Register with non-college email -> rejected.
3. Login before email verification -> rejected.
4. Verify email from inbox -> login succeeds.
5. Forgot password email opens `/reset-password`.
6. Student can place order and only view own orders.
