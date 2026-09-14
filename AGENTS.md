# AGENTS.md

Personal domain/service panel: Express 5 API + vanilla-JS SPA + JSON file storage. No build, test, lint, or typecheck step exists — do not invent one.

## Commands

- `npm start` — run server (`node server.js`)
- `npm run dev` — same with `node --watch` (needs Node >= 18.11; Docker uses Node 22)
- `node migrate.js` — one-off legacy data migration; rewrites `data/data.json` and drops a timestamped `.backup.<ts>` copy (taken after in-memory migration, so not a true pre-migration backup)
- `docker-compose up -d` — container serves on host port 3080
- `npx @google/design.md lint DESIGN.md` — after editing `DESIGN.md` (per its own iteration guide)

## Architecture

- `server.js` — all routes/middleware; `store.js` — all persistence + domain auto-association; `public/app.js` — all frontend logic.
- Static mounts are prefixed: `/public/*`, `/screenshots/*`, `/covers/*`. `index.html` loads `/public/app.js?v=N` / `style.css?v=N`; bump `?v=` when editing those files.
- `app.js` is a classic script, not a module. Functions used in inline `onclick`/generated HTML must stay global. Escape user data with `esc()`.
- Storage is a single `data/data.json` read-modify-write per store call (`data/` is gitignored). Uploads live in `data/screenshots/` and `data/covers/`. No DB, no auth — local/personal use only.
- Service↔domain links: `service.domain` (comma-separated string) is the source of truth. Saving a service auto-creates missing domain records and rewrites each domain's `service_ids`; deleting a service strips references. `service_ids` edited manually in the domain modal can be clobbered by the next service save.
- `servers` + `deployments` (`service_id`/`server_id`/`port`/`protocol`/`path`/`container`) record where each service runs; deleting a service or server cascades its deployments. Recording only — no SSH/host probing.
- Service discovery: `POST /api/services/discover` creates a service + `https:443` deployment for each domain whose `ip_address` matches a server IP (name = alias or first label, deduped to the full domain on collision, marked `auto_created`); idempotent, never deletes, and refreshes probes on linked domains too. The frontend runs it once when the services ledger is empty.
- Domain probing (`probe.js`): server-side HTTP(S) GET with manual redirects (max 5), 6s timeout, max 64KB body, and a self-signed-TLS fallback; detects the service kind from title/generator/headers/body keywords and flags placeholder pages (nginx/Apache welcome). `POST /api/domains/probe` (bulk, concurrency 4) and `POST /api/domains/:id/probe` store results on `domain.probe`; discovery only creates services for domains that respond with a real service (skips placeholders and HTTP 5xx).
- Cloudflare: token resolves `CF_API_TOKEN` env first, then `data.settings.cf_api_token` (stored plaintext). `/api/settings` never returns the token, only `cf_api_token_set`. `/api/cf/sync` upserts domains from zones, collects A/AAAA IPs, skips `100::*`/`::1`.
- `/api/favicon?domain=` proxies that domain's `/favicon.ico` and caches it in `data/icons/`; only domains already in the store are allowed (404 otherwise). The frontend pairs it with an inline monogram fallback via `img onerror`.
- Auth: single-password login. First visit to `/login` sets the password (scrypt hash + `session_version` in settings); sessions are an HMAC-signed `dm_session` cookie (30d). Every route except `/login` and `/api/auth/*` requires it. `AUTH_PASSWORD` env overrides the stored hash; reset by deleting `auth_password_hash`/`session_version` from `data.json`. `/api/settings` deliberately returns only `cf_api_token_set`/`cf_env_token`.
- Komari connector (`komari.js`): read-only monitor source. Base URL resolves `KOMARI_URL` env then `settings.komari_url` (default `https://winters.eu.cc`); API key resolves `KOMARI_API_KEY` env then `settings.komari_api_key`. Uses `POST /api/rpc2` (Bearer, `common:getNodes` / `common:getNodesLatestStatus`) to get real node IPs; falls back to public `/api/nodes` + `/api/recent/:uuid` (IPs hidden) when the key is missing or RPC fails. 30s in-memory cache; routes `/api/komari/overview|sync|import`; never writes to Komari.
- Docker: `Dockerfile` runs Node directly — nginx is NOT in the image (ignore `CLAUDE.md`'s nginx-in-container claim); `nginx.conf` mirrors the host reverse-proxy setup (default-443 SNI handshake reject + `waitwinter.eu.cc` vhost → `127.0.0.1:3080` + commented new-service template). Compose bind-mounts `./public` for live frontend edits, publishes `127.0.0.1:3080` only (host nginx fronts it), and keeps data in the `domain-data` volume, so local `data/` changes are invisible in Docker.

## Conventions

- All UI copy is Simplified Chinese; keep new strings consistent.
- `DESIGN.md` is the UI spec: dark-only app-shell console (fixed sidebar + topbar + content, never a scrolling landing page), indigo `#6C5CE7` accent, 4–12px radius, Inter + JetBrains Mono. Read it before frontend changes; run the design.md lint after editing it.
- `CLAUDE.md` may be stale; verify claims against code/config before trusting it.
