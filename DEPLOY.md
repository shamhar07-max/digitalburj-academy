# Deploy — digitalburj-academy

The Academy keeps its database in a file, so it needs a host with a
**persistent disk**: a small VPS (Oracle Cloud free tier in Abu Dhabi works),
Render with a disk, or any Docker host. Vercel/Netlify will NOT work (no disk).

## VPS with Docker (recommended)

```bash
# on the server
docker volume create academy-data
docker run -d --restart unless-stopped --name academy \
  -p 3100:3100 -v academy-data:/data \
  ghcr.io/shamhar07-max/digitalburj-academy:prod
```

First boot seeds demo accounts automatically (idempotent). Health check:
`curl localhost:3100/api/missions` → JSON.

## After first boot (do this immediately)

1. Log in as `admin@digitalburj.com` / `demo1234` → create your real admin.
2. Change all demo passwords (or deactivate demo accounts).
3. Back up `/data/academy.db` nightly (cron + `sqlite3 .backup`, or volume snapshots).
4. Put Caddy/Nginx in front for TLS; set `NODE_ENV=production` (already set in image).

## Build the image yourself

```bash
docker build -t digitalburj-academy:prod -f apps/web/Dockerfile apps/web
```

## Production path (later)

SQLite → Postgres: schema is Postgres-compatible; swap `src/server/db.js`
for a `pg` driver behind the same function signatures, set `DATABASE_URL`,
keep everything else unchanged.
