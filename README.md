# BizFlow

A global, professional business-management SaaS (CRM + Sales + Invoicing + Payments) for small service-based businesses.

## Where to start

- **`CLAUDE.md`** — standing instructions for Claude Code working on this repo. Read this first, every session.
- **`docs/product/blueprint.md`** — the full product, business, and technical blueprint (source of truth for scope and rationale).
- **`docs/roadmap/build-order.md`** — the sequenced development plan. Work through it in order; update the "Current build step" note in `CLAUDE.md` as steps complete.

## Getting started

```bash
docker compose up
```

This starts Postgres, Redis, the NestJS API (`http://localhost:3000/api/v1`, health check at `/api/v1/health`), and the React frontend (`http://localhost:5173`).

To work on one app at a time without Docker:

```bash
cd backend && npm install && cp .env.example .env && npm run migration:run && npm run start:dev
cd frontend && npm install && npm run dev
```

`backend/.env.example` documents the required environment variables (database, JWT secrets, CORS origins).

## Status

Step 2 — Authentication complete. Next step: **Step 3 — Multi-Tenancy & Organizations** (see `docs/roadmap/build-order.md`).
