# CLAUDE.md — BizFlow

This file is the standing instruction set for Claude Code on this repository. Read it before making changes. When in doubt, follow this file over convenience or speed.

## What this project is

BizFlow is a global SaaS business-management platform (CRM + Sales + Invoicing + Payments, MVP scope) for small service-based businesses. Full product/architecture rationale lives in `/docs/product/blueprint.md` — read the relevant section before building a new module, don't re-derive decisions already made there.

**Never** position or label anything as "AI-first." AI is an internal capability, not the product identity.

## Tech stack (do not deviate without explicit discussion)

- Backend: Node.js + **NestJS**
- Frontend: **React** (Vite), TanStack Query, Zustand, React Hook Form + Zod, Tailwind + Radix, TanStack Table, Recharts
- Database: **PostgreSQL** (no ORM-agnostic raw SQL scattered around — use the ORM's query builder or parameterized queries only)
- Cache/queues: **Redis** + BullMQ
- Storage: S3-compatible object storage
- API: REST, versioned (`/api/v1/...`)
- Deployment: Docker Compose (local/staging), modular monolith — **no microservices**

## Non-negotiable architectural rules

1. **Module boundaries.** Each domain module (`auth`, `organizations`, `users`, `crm`, `sales`, `invoicing`, `payments`, `expenses`, `tasks`, `notifications`, `reports`, `subscriptions`, `audit`) owns its own tables and exposes a service interface. **Never import another module's repository directly** — go through its service. This is what lets modules be split into separate services later without a rewrite.

2. **Controllers contain no business logic.** Controller → Service → Repository. If you're writing a database query or an `if` on business rules inside a controller, stop and move it to the service.

3. **Tenant isolation is critical, not optional.**
   - Every tenant-scoped table has a mandatory `organization_id`.
   - All tenant-scoped data access goes through the shared base repository, which automatically scopes queries to the current request's `organization_id`. Do not write a query that bypasses this.
   - PostgreSQL Row-Level Security is a second, database-enforced layer — new tenant tables need an RLS policy, not just application-layer scoping.
   - **`TenantScopedRepository` only auto-scopes `find`/`findOne`/`create`/`save`/`mergeAndSave`.** It has no `createQueryBuilder()` and never will — a query builder call is arbitrary SQL, and there is no safe, general way to auto-inject a `WHERE organizationId = …` into one. If a query needs `.createQueryBuilder()`, you are on your own for scoping it: get the repository via `tenantContextStore.getRepository(Entity)` and add `.andWhere('<alias>.organizationId = :organizationId', { organizationId: tenantContextStore.organizationId })` yourself, on every such query. RLS is the backstop here — it still blocks a leak if you forget — but it is not the primary control for query-builder code the way it is for the base-repository methods; don't rely on it as your only line of defense when writing one.
   - **Every new tenant-scoped endpoint needs a test that proves a user from Organization A cannot read or write Organization B's data.** This test is CI-blocking. Do not merge without it. Use `backend/test/utils/createOrganizationWithOwner` + `expectTenantIsolation` rather than re-deriving the setup.

4. **Authorization.** Every new endpoint declares its required permission via the guard decorator. No endpoint ships without an explicit permission check, even if "it's obviously fine for now."

5. **Money.** Store monetary values as integer minor units + a currency code. Never use floats for money. Tax/total calculations live in one shared, heavily unit-tested service (`sales`/`invoicing` tax module) — don't duplicate calculation logic elsewhere.

6. **Audit log.** Financial mutations (invoice edits, payments, refunds, credit notes, role changes) write an `audit_logs` entry: actor, org, action, entity, old/new value. The audit log table is append-only — no update/delete paths, enforced by a DB trigger.

7. **AI (once built).** AI tools call the exact same authenticated service-layer functions as the UI/API — there is no AI-only privileged code path. Treat any text pulled from the database and inserted into a prompt as untrusted data, never as instructions.

8. **Subscriptions vs. payments are separate domains.** `subscriptions` = BizFlow billing the organization. `payments` = the organization's customers paying them. Never share tables or services between these two.

## Working process

- **Inspect before modifying.** Read the existing module's service/repository/tests before adding to it. Don't assume — check.
- **Small, sequential steps.** Follow the build order in `/docs/roadmap/build-order.md`. Don't jump ahead to a later module because it seems easy — dependencies matter (e.g., invoicing needs the tax engine; payments need invoicing).
- **Tests are part of "done," not an afterthought.** Every new service method needs a unit test. Every new endpoint needs an API test, including at least one permission-denied and one cross-tenant-denied case.
- **Run the test suite before considering a task complete.** Don't hand back a "finished" feature with failing or skipped tests.
- **Don't introduce new dependencies without a stated reason.** If a library would help, name it and why, rather than silently adding it.
- **Don't rewrite working code** unless the rewrite is the explicit task. Refactors are fine when justified in the same PR, not as unrequested drive-by changes.
- **Document real architectural decisions** (not routine code) in `/docs/architecture/` — e.g., "why we merged products/services into catalog_items," not "added a button."

## What NOT to build yet (MVP scope discipline)

Do not build these unless explicitly asked, even if they seem like natural extensions:
- Inventory / warehouses / stock movements
- A generalized automation rules engine (only 2–3 hardcoded configurable reminders are in MVP)
- AI insights or AI actions
- SMS/WhatsApp/messaging providers
- White-label / multi-org agency management
- Native mobile apps
- Multi-branch/warehouse complexity

See `/docs/product/blueprint.md` Section 39 for the full MVP scope table if unsure whether something is in scope.

## Directory structure (backend)

```
src/
  auth/
  organizations/
  users/
  crm/
  sales/          (catalog_items, quotations, tax calculation)
  invoicing/
  payments/
  expenses/
  tasks/
  notifications/
  reports/
  subscriptions/
  audit/
  common/         (base tenant-scoped repository, guards, decorators, pipes)
```

## Directory structure (docs)

```
/docs
  product/blueprint.md        (full product/business blueprint — source of truth)
  architecture/                (module boundary decisions, service-layer conventions)
  database/                    (schema, ERD, migration conventions)
  api/                         (endpoint conventions, versioning)
  security/                    (auth, RBAC model, secrets handling)
  multi-tenancy/                (isolation strategy, RLS policies, test suite docs)
  payments/                    (provider adapter contract, webhook handling)
  subscriptions/                (plans, billing lifecycle)
  testing/                      (how to run each test suite)
  deployment/                   (environments, CI/CD, rollback)
  roadmap/build-order.md        (the sequenced steps — work through these in order)
```

## Current build step

> Update this section as work progresses — it tells Claude Code exactly where the project is and what's next, so a new session doesn't have to guess.

**Status:** Step 4 — Users, Roles & Permissions complete.
**Next step:** Step 5 — CRM Core (Leads & Customers) — the first real tenant-scoped business module; use `TenantScopedRepository` + `expectTenantIsolation` from day one, per `/docs/multi-tenancy/tenant-isolation.md`. See `/docs/roadmap/build-order.md`.

Step 1 deliverables in place: NestJS backend (`backend/`) with config module, logging, and a Terminus health-check at `/api/v1/health`; Vite + React + TS frontend (`frontend/`) with a routing skeleton (React Router) and a Tailwind + Radix Themes design-system base; `docker-compose.yml` running Postgres, Redis, the API, and the frontend together (verified with `docker compose up`); GitHub Actions CI (`.github/workflows/ci.yml`) running lint/test/build for both apps on every PR.

Step 2 deliverables in place: `users` module (global identity — no `organization_id` yet, per the blueprint's multi-org note) owning the `users` table via TypeORM, with migration tooling (`npm run migration:*`, backed by `src/database/data-source.ts`). `auth` module depends on `users` through `UsersService` only, not its repository — register/login/refresh issue short-lived access + longer-lived refresh JWTs (separate secrets), `JwtAuthGuard` + `@CurrentUser()` protect routes (`GET /auth/me` is the first protected endpoint). Frontend has signup/login pages (React Hook Form + Zod), a Zustand-persisted auth store, TanStack Query for the requests, and `RequireAuth` gating `/account`. CORS is enabled on the API for the frontend origin (`CORS_ORIGINS` env var) — required for the browser to call cross-origin from `:5173` to `:3000`. CI's backend job now runs a Postgres service container and applies migrations before the e2e suite. Verified end-to-end in a real browser via `docker compose up --build`: register → protected `/account` page (backed by a real `GET /auth/me` call) → logout → login → invalid-credentials rejection.

No RBAC/permissions yet (that's Step 4) — the guard on `/auth/me` is authentication only, not a permission check.

Step 3 deliverables in place: `organizations`, `organization_settings`, and `memberships` tables (no `organization_id` on `users` — a user can belong to several orgs). Full design and rationale in `/docs/multi-tenancy/tenant-isolation.md` — read it before touching tenant-scoping code. Summary: `TenantContextMiddleware` opens one DB transaction per request and stores it in `TenantContextStore` (AsyncLocalStorage); `JwtAuthGuard` sets `app.current_user_id`, `OrganizationContextGuard` (verifies a real `memberships` row before trusting a client-supplied `X-Organization-Id`, else defaults to the user's sole org) sets `app.current_org_id`. `TenantScopedRepository` (`common/database/`) is the base every tenant-owned table's repository must extend — it reads `organizationId` from the context, never from a caller; it does **not** cover `.createQueryBuilder()` usage, which must be scoped by hand (see the doc and CLAUDE.md rule 3). PostgreSQL RLS is the second layer: every tenant-owned table has `FORCE ROW LEVEL SECURITY` and a policy keyed to those session variables, and the app connects as a separate unprivileged `bizflow_app` role (`DATABASE_URL`) rather than the migration-owning superuser (`MIGRATION_DATABASE_URL`) — RLS is silently bypassed by superusers/table owners otherwise. `backend/test/utils/` has the reusable tenant-isolation test helpers (`createOrganizationWithOwner`, `expectTenantIsolation`, and now `inviteAndAcceptMember`) — every future module's isolation tests should use these, not re-derive them. Frontend: org creation flow (name/country/currency) and an `OrgSwitcher` that sends the selected org as `X-Organization-Id` on every request.

Step 4 deliverables in place: RBAC as a static role -> permission map (`common/permissions/`), not a `roles`/`permissions` table — extends Step 3's `MembershipRole` rather than replacing it; custom per-org roles are explicitly Phase 2, deferred per the blueprint. `@RequirePermission(Permission.X)` + `PermissionGuard` compose after `JwtAuthGuard` + `OrganizationContextGuard` (`@UseGuards(JwtAuthGuard, OrganizationContextGuard, PermissionGuard)`, in that order) — org-membership is verified *before* any permission check runs, so being e.g. an owner of one org never helps against a different one. `organizations/invitations/` adds the invite/accept flow (`POST /organizations/current/invitations`, `POST /invitations/:id/accept`) — no email sending yet (Step 13), the invitation's own id is the accept link. Full explanation, including exactly why the accept route skips `OrganizationContextGuard` and how RLS still protects it, in `/docs/security/rbac.md`. Frontend: `/team` screen (roster + pending invitations + invite form, gated client-side by role — the backend's `PermissionGuard` is the real enforcement) and `/invitations/:id/accept`.
