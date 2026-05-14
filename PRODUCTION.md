# TutorHive OS Production Launch

TutorHive OS now needs dynamic hosting. GitHub Pages can still host static TutorHive, but it cannot run `/api/*`, login sessions, database writes, or `/site/:slug`.

## Recommended Launch Setup

1. Create a managed Postgres database on Render, Neon, Supabase, or Railway.
2. Deploy this repository as a Node web service using `npm start`.
3. Set environment variables:
   - `NODE_ENV=production`
   - `HOST=0.0.0.0`
   - `DATABASE_URL=<your postgres connection string>`
   - `SITE_BASE_DOMAIN=tutorhive.in`
4. Point `tutorhive.in` DNS to the Node service instead of GitHub Pages when ready.
5. Keep the original TutorHive pages served by this same Node app:
   - `/`
   - `/index.html`
   - `/tutorhive-os.html`
   - `/tutorhive-dashboard.html`
   - `/site/:slug`
   - `:slug.tutorhive.in`

## Production Routes

- `POST /api/signup`
- `POST /api/login`
- `POST /api/logout`
- `GET /api/me`
- `GET /api/website`
- `PATCH /api/website`
- `POST /api/publish`
- `GET /api/enquiries`
- `DELETE /api/enquiries`
- `POST /api/site/:slug/enquiries`
- `POST /api/domain/verify`
- `GET /site/:slug`
- `GET /` on `:slug.tutorhive.in`

## Domain Routing

TutorHive OS preview sites are designed to publish at:

- `bright-minds.tutorhive.in`

Keep `/site/bright-minds` as a fallback route for debugging and old links.

To enable subdomain previews in production:

- Add `*.tutorhive.in` as a custom domain on Render for the same web service.
- Add a wildcard DNS record in GoDaddy:
  - Type: `CNAME`
  - Name: `*`
  - Value: `tutorhive-vxdj.onrender.com`

The server also checks the incoming `Host` header and can render the matching published website for a saved custom domain. Production DNS verification should check:

- CNAME `www` points to the hosting target.
- TXT `tutorhive-verify` matches the website slug or generated verification token.

The current `/api/domain/verify` endpoint stores the verification attempt and is ready to be extended with real DNS lookup logic.
