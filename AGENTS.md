# AGENTS.md

Personal, single-user CMDB. React + TypeScript + Vite frontend, Express 5 API, SQLite + Drizzle storage, Docker production deployment. All UI copy is Simplified Chinese.

## Commands

These scripts now exist; there is no test or lint script. Do not invent a passing test/lint step.

- `npm ci` — install the locked dependencies; Node >= 22.12 (production image uses Node 24).
- `npm run dev` — API with tsx watch on 3000, Vite on 5173.
- `npm run typecheck` — actual API and frontend TypeScript checks.
- `npm run build` — compile API/compatibility modules into dist, build React into dist/web.
- `npm start` — run the compiled application; build first.
- `npm run migrate` — preflight legacy data.json in a disposable copy, without modifying live data.
- `npm run migrate -- --apply` — apply migration, retaining the original JSON and a byte-identical backup.
- `docker compose up -d --build` — production deployment on 127.0.0.1:3080.
- `npx @google/design.md lint DESIGN.md` — required only after editing DESIGN.md.

## Structure

- `apps/web/src` — React app; pages, resource features, typed API/query state and accessible UI primitives. Route pages are lazy-loaded.
- `packages/contracts/index.ts` — Zod input contracts, response types, type/status labels.
- `apps/api/src/server.ts` — production API entry, SPA/static serving, JSON errors and graceful shutdown.
- `apps/api/src/modules/resources.ts` — authoritative resource/relationship/deployment/endpoint operations and history. Transactions and revision checks belong here.
- `apps/api/src/modules/routes.ts` — authenticated `/api/cmdb/*` API.
- `apps/api/src/db` — Drizzle schema, SQLite initialization, version 1 migration and encrypted setting codec.
- `server.js` — legacy route factory, authentication, existing Cloudflare/Komari/probe integrations; no longer an executable entry point.
- `store.js` — compatibility projections over the same SQLite store. Never reintroduce JSON writes or a second writable source of truth.
- `komari.js`, `probe.js` — retained read-only upstream adapters; advanced persistent task handling is still pending.
- `public/` — historical frontend, retained as source reference; current frontend is apps/web, and production serves dist/web.

## Persistence and migration

- `DATA_DIR` defaults to `./data`, and is `/app/data` in Docker. SQLite is `panel.db`; attachments are screenshots/ and covers/; snapshots and original migration backups live in backups/.
- Initialization imports legacy `data.json` once, in a transaction, preserving IDs, old fields, screenshots, and relationship evidence. Original JSON is never rewritten. Corrupt or conflicting data must fail visibly, never reset to an empty database.
- `resources` holds typed common fields/details; `hostnames` and `service_hostnames` are the canonical service-domain bindings. Service domain strings and domain service_ids are projections only.
- Soft deletion preserves foreign keys and historical relations. Legacy projections filter deleted targets; restoration retains valid links.
- Keep SQLite writes short. External network I/O must stay outside write transactions.
- `CREDENTIAL_KEY` is a separate 64-character hex master key for AES-GCM connector settings. Environment connector keys take precedence. No secrets in exports, logs, screenshots or fixtures.
- Legacy connector secrets without a master key are skipped with a migration warning and remain in the protected original backup; reconfigure via environment or encrypted settings.

## Auth and network

- Single password login; new stored passwords require 12 characters. AUTH_PASSWORD overrides the saved hash and its rotation invalidates earlier sessions.
- Initial setup requires SETUP_TOKEN or the generated data/setup-token file. Never expose a first-visitor-wins setup endpoint.
- `/assets/*` and minimal `/healthz` are public; business APIs and attachments require authentication. Static fallback must never bypass auth or mask API errors.
- Cookie signatures and server-side logout revocations are checked. Unsafe methods validate Origin when supplied.
- Cloudflare sync is paged and records addresses per exact hostname. Failed scopes preserve prior observations. Never infer registrar from DNS provider.
- Service discovery returns candidates; confirmation creates service/entry/deployment together and leaves unknown internal ports blank.
- Komari is read-only. It must never write to the upstream service.

## UI and delivery

- Read DESIGN.md before frontend changes: dark app shell, #6C5CE7 accent, restrained radii, Inter/system UI + mono identifiers. Do not turn the product into a landing page.
- React text escaping does not replace URL validation. Never insert untrusted HTML or dynamic inline event strings.
- Use shared components for identity, status, dialogs and buttons; server data in TanStack Query, navigation/filter state in URLs, local UI state in components.
- Modern frontend assets are content-hashed by Vite; no manual ?v bump is needed there. Historical public/app.js/style.css still follow the old ?v convention if edited.
- Docker is a multi-stage single-application image. The production compose file has no public/ source bind mount; rebuild the image for frontend changes.
- Preserve local data and user changes. Verify storage/auth/migration work with isolated DATA_DIR fixtures, never the user's real data or external accounts.
- PRD describes target scope, not completion. Check README and ARCHITECTURE implementation notes before claiming a milestone is complete. CLAUDE.md is historical and may be stale.
