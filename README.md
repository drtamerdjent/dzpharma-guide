# DzPharma Guide 🇩🇿💊

Mobile-first freemium web app for Algerian doctors: search 5,380 medications,
find therapeutic alternatives, clinical scores, interactions, pediatric doses,
shortage reports, Telegram bot, and BaridiMob premium activation.

## Deploy to Vercel (free) — beginner guide

### 1. Put this code on GitHub
- **Easiest:** install [GitHub Desktop](https://desktop.github.com) →
  `File → Add Local Repository` → select this folder → confirm "create a
  repository here" → click `Publish repository`.
- **Or on github.com:** create an empty repository → `Add file → Upload
  files` → drag the folders in small batches (max 100 files per batch) →
  `Commit changes`.

### 2. Create the database on Supabase (free)
1. [supabase.com](https://supabase.com) → `New project` (save the DB password!).
2. `Connect` button (top bar) → copy **two** connection strings:
   - **Transaction pooler** (port **6543**) → append
     `?pgbouncer=true&connection_limit=1` → this is `DATABASE_URL`.
   - **Session pooler** (port **5432**) → this is `DIRECT_URL`.

### 3. Deploy on Vercel (free)
1. [vercel.com](https://vercel.com) → `Add New → Project` → import your repo.
2. Before deploying, open `Environment Variables` and add:
   | Name | Value |
   |---|---|
   | `DATABASE_URL` | the 6543 string with `?pgbouncer=true&connection_limit=1` |
   | `DIRECT_URL` | the 5432 string |
   | `SEED_SECRET` | any long private word (e.g. `mon-secret-321`) |
   | `NEXT_PUBLIC_APP_URL` | `https://your-project.vercel.app` |
   | `WHATSAPP_NUMBER` | `213672226698` |
   > Do **not** set `PAYMENTS_DEMO_MODE` in production.
3. Click `Deploy`. The build automatically creates all database tables
   (Prisma `db push`) — no commands needed.

### 4. Load the 5,380 medications (one click)
Visit once in your browser:

```
https://your-project.vercel.app/api/admin/seed?secret=<your SEED_SECRET>
```

You should see `{"status":"seeded","total":5380,...}`.
Then verify: `https://your-project.vercel.app/api/medications/stats`.

## Local development (developers)

```bash
bun install
bun run db:push          # create SQLite tables
bun scripts/seed-medications.ts
bun run dev
```

## Docker (VPS)

```bash
docker compose up -d --build
```

Tables + medications are seeded automatically on first start
(the app stores data in the `dzpharma-db` volume).

## Support
WhatsApp: **0672 22 66 98** (international: +213 672 22 66 98)
