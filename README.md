# TutorHive Relaunch 2.1

Full-stack relaunch of TutorHive with a modern frontend, Node/Express backend, persistent lead pipeline, and admin console.

## What is now in this repo

- New marketing + product frontend (`index.html`, `styles.css`, `app.js`)
- Admin operations console (`admin.html`, `admin.css`, `admin.js`)
- Backend API (`server.js`, `server/api.js`, `server/engine.js`, `server/store.js`)
- Browser fallback runtime (`mock-api.js`) so the site still works on static-only hosts
- Production deployment assets (`Dockerfile`, `compose.yaml`, `render.yaml`, `ecosystem.config.cjs`, `deploy/`)

## Runtime modes

- `Live API mode`: when `/api/*` is available (Node server running)
- `Browser mode`: automatic fallback when hosted on static-only platforms (like GitHub Pages)

The top runtime badge shows which mode is active.

## Local run

```bash
npm install --cache .npm-cache
npm run dev
```

- Main site: `http://localhost:4173/`
- Admin console: `http://localhost:4173/admin`

## Production options

### Option A: VPS (recommended for full control)

1. Provision Ubuntu server and point GoDaddy DNS A records to server IP.
2. Clone repo on server to `/var/www/tutorhive`.
3. Create `.env` from `.env.example`.
4. Start app with either:
   - Docker: `docker compose up -d --build`
   - Node + systemd: use `deploy/systemd/tutorhive.service`
5. Configure reverse proxy using `deploy/nginx/tutorhive.conf` and enable TLS with certbot.

### Option B: Render (quick managed deployment)

1. In Render, create a new Blueprint from this repo (`render.yaml`).
2. Wait for deploy and copy service URL.
3. Update GoDaddy DNS to point root domain to Render target.

## Key API endpoints

- `GET /api/health`
- `GET /api/programs`
- `GET /api/sessions/upcoming`
- `GET /api/dashboard/overview`
- `GET /api/dashboard/pipeline`
- `GET /api/dashboard/recent-activity`
- `POST /api/leads`
- `POST /api/tutor-applications`
- `POST /api/contact`
- `POST /api/simulate-progress`
- `GET /api/admin/leads`
- `PATCH /api/admin/leads/:leadId`

## Immediate relaunch on current setup

If domain is still on GitHub Pages, pushing this repo to `main` relaunches the new frontend immediately in `Browser mode`.

To activate full backend mode on the same domain, migrate hosting from static-only GitHub Pages to a Node-capable host (VPS or Render) and repoint DNS.
