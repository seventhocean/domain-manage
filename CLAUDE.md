# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Personal domain and service management panel with Cloudflare DNS integration. Built as a lightweight full-stack application with file-based storage.

## Commands

**Run the application:**
```bash
npm start              # Production: node server.js
npm run dev            # Development: node --watch server.js (auto-reload on changes)
```

**Docker deployment:**
```bash
docker-compose up -d   # Runs on port 3080
```

No build step, tests, or linter configured. The application runs directly with Node.js.

## Architecture

**Backend (server.js):**
- Express 5.x REST API with two main resources: `/api/services` and `/api/domains`
- Cloudflare API proxy at `/api/cf/*` for zone and DNS record queries
- File upload endpoint for service screenshots using multer
- Serves SPA from `/public` directory

**Storage (store.js):**
- File-based JSON storage in `data/data.json`
- Auto-creates data directory and file on first access
- Exports CRUD functions for services, domains, and settings
- IDs generated with timestamp + random suffix

**Frontend (public/):**
- Vanilla HTML/CSS/JS single-page application
- No build process or framework
- Communicates with backend via fetch API

**Deployment:**
- Nginx reverse proxy in front of Node.js (port 80 → 3000)
- Multi-stage Docker build for minimal production image
- Data persisted via Docker volume mount at `./data`

## Environment Variables

- `CF_API_TOKEN` - Cloudflare API token for DNS sync (optional, can be set via UI)
- `PORT` - Server port (default: 3000, Docker uses 3000 internally, maps to 3080 externally)

## Key Design Decisions

- **File-based storage**: No database; all data in single JSON file. Suitable for personal use with small datasets.
- **No authentication**: Designed for personal/local deployment only.
- **Nginx + Node in single container**: Simplifies deployment but couples concerns.
- **No frontend framework**: Vanilla JS keeps the stack minimal but limits reusability.

## Development Notes

- Server uses ES modules (`"type": "module"` in package.json)
- Screenshots stored in `data/screenshots/` with service ID prefix
- Deleting a service cascades to remove domain references
- `--watch` flag requires Node.js 18.11+
