# MADAR Store

## Supabase phase 1
Copy `.env.example` to `.env.local`, set the anonymous key and (only for CLI scripts) the service-role key. Apply `supabase/migrations/20260719000000_phase_one.sql` with `supabase db push` after linking the intended project, then run `npm run db:seed` if legacy catalog data is desired.

Register `SUPER_ADMIN_EMAIL` through `/register`, confirm the email, then run `npm run promote:super-admin`. It refuses any other email, unconfirmed user, or disabled account.

In **Supabase Dashboard → Authentication → URL Configuration**, add `http://localhost:3000`, `http://localhost:3000/auth/callback`, and `http://localhost:3000/reset-password`; add the equivalent production URLs based on `NEXT_PUBLIC_SITE_URL`.

Run `npm run dev`, `npm run lint`, `npx tsc --noEmit`, and `npm run build`. The migration creates the public `catalog-images` bucket and private `digital-products` and `avatars` buckets with RLS policies. Orders, checkout and customer download delivery are deliberately outside phase 1.
