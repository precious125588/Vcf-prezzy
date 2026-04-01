# Deployment Guide

## Railway
1. Push to GitHub
2. Go to railway.app → New Project → Deploy from GitHub repo
3. **Option A (recommended):** Add PostgreSQL plugin — Railway sets DATABASE_URL automatically
4. **Option B:** Deploy as-is — the app will use an embedded SQLite database automatically (no config needed!)

## Render
1. Push to GitHub
2. New → Web Service → connect your repo
3. Build Command: `npm install`
4. Start Command: `node server.js`
5. **Option A:** Add a PostgreSQL database and set DATABASE_URL env var
6. **Option B:** Deploy as-is — SQLite will be used automatically

## Vercel
1. Push to GitHub
2. Import on vercel.com
3. Add DATABASE_URL env var pointing to a PostgreSQL database
   (Get free Postgres from neon.tech — takes 2 mins)
4. Deploy!

## Fly.io / Any Docker Host
1. Deploy with the included Dockerfile or `npm install && node server.js`
2. Without DATABASE_URL, SQLite is used automatically
3. For persistence on ephemeral platforms, set DATABASE_URL to an external PostgreSQL

## Local
```bash
npm install
node server.js
```
No DATABASE_URL needed — SQLite is used by default. Data is stored in `data/contacts.db`.

## Notes
- **With DATABASE_URL set:** PostgreSQL is used (recommended for production)
- **Without DATABASE_URL:** SQLite is used automatically (data stored in `data/contacts.db`)
- SQLite is great for small-medium deployments; use PostgreSQL for high traffic
