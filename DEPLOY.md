# Deployment Guide

## What changed (v1.1)
- ❌ Removed `better-sqlite3` (caused Railway build to fail because the host had no Python/node-gyp).
- ✅ Pure-JS JSON file fallback when no `DATABASE_URL` is set — zero native compilation.
- ✅ Admin page at **`/admin.html`** — login with the admin password, then:
  - View / search contacts
  - Edit any contact
  - Delete a single contact or all contacts
  - Set a global **name suffix** (e.g. `🥀`) appended to every new contact
  - Download `.vcf`
- ✅ Vercel-ready (lazy DB init for serverless cold starts)
- ✅ Express 4 (stable path matcher; no v5 path-to-regexp surprises)
- ✅ Admin password configurable via `ADMIN_PASSWORD` env var (default `080205`).

## Persistence ⚠ (read this)
- **With `DATABASE_URL`** (PostgreSQL) → fully persistent across restarts/redeploys. **Recommended for production.**
- **Without `DATABASE_URL`** → JSON file at `data/contacts.json`.
  - On Railway: persists on the same instance, but a redeploy or container recycle wipes it. **Attach a Volume mounted at `/app/data`** (or set `DATA_DIR=/data` and mount there) for true persistence.
  - On Vercel: serverless filesystem is read-only — JSON fallback won't work in production. **You must use `DATABASE_URL`** (Neon free tier works great).

## Railway
1. Push to GitHub → New Project → Deploy from GitHub.
2. Click **Add → Database → PostgreSQL**. Railway sets `DATABASE_URL` automatically. ✅
3. (Optional) Set `ADMIN_PASSWORD` env var.
4. Done.

## Vercel
1. Push to GitHub → Import on vercel.com.
2. Add env var `DATABASE_URL` (get a free Postgres at https://neon.tech).
3. (Optional) `ADMIN_PASSWORD`.
4. Deploy. The `vercel.json` already wires `server.js` as the serverless entry.

## Render / Fly / Any Node host
```bash
npm install --omit=dev
node server.js
```
Set `DATABASE_URL` for persistence.

## Local
```bash
npm install
node server.js
```
Open http://localhost:3000 (public) and http://localhost:3000/admin.html (admin).
