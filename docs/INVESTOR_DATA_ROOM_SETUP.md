# Investor Data Room Setup (Papermark fork) — Supabase + Vercel + Custom Domain

This guide assumes you are deploying the repo `dairus_papermark_data_room` to Vercel and using **Supabase Postgres** as the database.

## 0) Prerequisites (accounts + access)

- You can log into:
  - Supabase Dashboard: https://supabase.com/dashboard
  - Vercel Dashboard: https://vercel.com/dashboard
- You control DNS for `dairus.com`.
- You have (or will obtain) the correct Papermark self-host license for commercial/investor use.

## 1) Create a NEW Supabase project (step-by-step)

### 1.1 Create/choose your Supabase Organization

1. Go to https://supabase.com/dashboard
2. If you don’t have an Organization yet, create one.
   - You can also start at https://supabase.com/dashboard/new

### 1.2 Create the project

1. In the Supabase Dashboard, click **New project**.
2. Choose the **Organization**.
3. Fill in:
   - **Project name**: e.g. `dairus-investors-dataroom`
   - **Database password**: generate a strong password and store it in a password manager.
   - **Region**: pick the closest region to your investors/team (often EU for EU teams).
   - **Pricing plan**: choose the plan you want (Free is fine for testing; check limits).
4. Click **Create new project**.
5. Wait for provisioning to finish (often ~1–2 minutes).

## 2) Get the connection strings from Supabase (for Vercel env vars)

Supabase provides multiple Postgres connection methods. You’ll copy both a pooled connection and a direct connection.

1. Open your Supabase project dashboard.
2. Click **Connect** (in the project UI).
3. Copy:
   - **Pooler connection string** (often called Session/Transaction pooler depending on UI).
   - **Direct connection string**.
4. Keep these ready for Vercel env vars:
   - `POSTGRES_PRISMA_URL`  → use a pooler URL
   - `POSTGRES_PRISMA_URL_NON_POOLING` → use direct URL
   - `POSTGRES_PRISMA_SHADOW_URL` → best: direct URL to a *shadow* database; acceptable initial: same as direct URL

Notes:
- With Vercel, using a pooler URL for the primary Prisma URL is common because Vercel functions are connection-heavy.
- If you change/reset the database password later, you must update Vercel env vars.

## 3) Create Vercel project env vars (step-by-step)

In Vercel:

1. Open the project **dairus-data-room**.
2. Go to **Settings → Environment Variables**.
3. Add the following for **Production** (and also Preview if you want preview deploys to work).

### 3.1 Auth + base URLs

- `NEXTAUTH_SECRET` = generate a strong random secret.
- `NEXTAUTH_URL` = `https://investors.dairus.com`
- `NEXT_PUBLIC_BASE_URL` = `https://investors.dairus.com`
- `NEXT_PUBLIC_MARKETING_URL` = `https://dairus.com` (or your marketing site)

### 3.2 Database (Supabase)

- `POSTGRES_PRISMA_URL` = (Supabase pooler connection string)
- `POSTGRES_PRISMA_URL_NON_POOLING` = (Supabase direct connection string)
- `POSTGRES_PRISMA_SHADOW_URL` = (Supabase direct connection string)

### 3.3 Storage (Vercel Blob)

1. In Vercel, open **Storage → Blob**.
2. Create/select a Blob store.
3. Copy the token and set:

- `BLOB_READ_WRITE_TOKEN` = (your Vercel Blob token)
- `NEXT_PUBLIC_UPLOAD_TRANSPORT` = `vercel`
- `NEXT_PRIVATE_UPLOAD_DISTRIBUTION_HOST` = `<YOUR_BLOB_STORE_ID>.public.blob.vercel-storage.com`

### 3.4 Email (Resend)

- `RESEND_API_KEY` = (your Resend API key)

## 4) Connect the custom domain `investors.dairus.com`

### 4.1 Add domain in Vercel

1. Vercel Project → **Settings → Domains**.
2. Add: `investors.dairus.com`.
3. Vercel will show the DNS record it expects.

You mentioned you already have:
- `d47026959143915a.vercel-dns-017.com`

This is typically used as the **CNAME target**.

### 4.2 Add DNS record at your DNS provider

Create/verify:
- **Type**: `CNAME`
- **Name/Host**: `investors`
- **Value/Target**: `d47026959143915a.vercel-dns-017.com`
- **TTL**: 300 (or default)

Wait until Vercel shows the domain as **Verified**.

## 5) Deploy (and run migrations)

1. Ensure your Vercel project is connected to the GitHub repo.
2. Ensure the **Production Branch** is `main`.
3. Trigger a deployment:
   - Push to `main` OR click **Redeploy** in Vercel.

This repo’s build script includes:
- `prisma migrate deploy && next build`

So migrations will run during the build.

## 6) Post-deploy verification checklist

Open `https://investors.dairus.com` and verify:

1. Login works.
2. You can create a team / access dashboard.
3. You can upload a document.
4. You can create a data room.
5. A shared link opens on the custom domain and is protected as expected.

## 7) Security checklist (high priority)

- **Do NOT store real secrets in `.env.example`**.
- If any DB credentials were ever committed to Git:
  - Treat them as compromised.
  - Use a new Supabase project (this doc) or reset passwords.
- Restrict access:
  - Only invite the minimal set of admins.
  - Use link protections (email verification, password, agreements) for investors.

---

## Sources consulted

- Supabase: reset DB password via Database Settings: https://supabase.com/docs/guides/troubleshooting/how-do-i-reset-my-supabase-database-password-oTs5sB
- Supabase: connection strings available via “Connect” button: https://supabase.com/docs/guides/database/connecting-to-postgres
