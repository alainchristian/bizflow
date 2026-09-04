# Tenant Isolation

Implements blueprint Section 15 and CLAUDE.md's tenant-isolation rule: shared
database, shared schema, with isolation enforced by two independent layers
that don't trust each other -- an application-layer repository guard, and
PostgreSQL Row-Level Security. This document explains how a request actually
gets scoped to one organization end to end, and why each piece exists.

## Entities

- **`organizations`** -- the tenant root: `id, name, country_code,
  base_currency, timezone, industry`. No `organization_id` column -- it *is*
  the tenant.
- **`organization_settings`** -- 1:1 with `organizations` via
  `organization_id`: invoice numbering, date format, tax-inclusive default,
  branding.
- **`memberships`** -- join table: `user_id, organization_id, role`. `users`
  has no `organization_id` column, deliberately -- one user (e.g. an
  accountant) can belong to several organizations.

## The request-scoped pieces

Four things cooperate on every request, in this order:

1. **`TenantContextMiddleware`** (`common/tenant-context/`) wraps the entire
   request in one `DataSource.transaction(...)` and stores the transactional
   `EntityManager` in an `AsyncLocalStorage` (`TenantContextStore`). This
   runs before guards, so it's already in place when they need it.
2. **`JwtAuthGuard`** (`common/guards/`) verifies the access token, then
   calls `tenantContext.setUserId(sub)` -- this both records the user id in
   the request's context object and runs
   `SELECT set_config('app.current_user_id', sub, true)` on that request's
   transaction. `true` (`is_local`) means the setting only lives for this
   one transaction, never leaking to whatever the pooled connection handles
   next.
3. **`OrganizationContextGuard`** (`common/guards/`, runs after
   `JwtAuthGuard` via `@UseGuards(JwtAuthGuard, OrganizationContextGuard)`)
   resolves which organization the request operates in. A client may send
   `X-Organization-Id` to name one, but that header is never trusted by
   itself -- the guard looks up a real `memberships` row for
   `(current user, that org)` first, and only calls
   `tenantContext.setOrganizationId(...)` (which sets
   `app.current_org_id` the same way) if one exists. No header, and the user
   has exactly one membership: that org is the default. No header and zero
   or several memberships: the request is rejected (403 / 400) rather than
   guessed at.
4. **`TenantScopedRepository<T>`** (`common/database/`) is what every
   tenant-owned table's repository extends (`OrganizationSettingsRepository`
   today; every future module's repositories the same way). It never takes
   an `organizationId` from a caller -- every `find`/`findOne`/`create` reads
   `TenantContextStore.organizationId` itself and injects it into the query
   or the row being created. It also always fetches its underlying
   TypeORM repository via `tenantContext.getRepository(Entity)` --
   i.e. `manager.getRepository(...)` on *this request's* transactional
   manager -- never a `@InjectRepository`-bound one, which would run on a
   different pooled connection where `app.current_org_id` was never set.

So a query is scoped like this: **request → `TenantContextMiddleware` opens
the transaction → `JwtAuthGuard` sets the user → `OrganizationContextGuard`
verifies membership and sets the org → the service calls a
`TenantScopedRepository` method → it reads `organizationId` off the context
(never off the request) and adds it to the query → the query runs on the
same transaction, where Postgres itself re-checks the row against
`app.current_org_id` via RLS.** There is no code path from a controller to
the database that skips both the repository's own filter and RLS -- the
repository can't be bypassed without also bypassing TypeScript's type
system (nothing exposes the raw manager to a controller), and RLS can't be
bypassed by application code at all, only by a superuser connection (see
below).

## Row-Level Security

Three things make RLS a *real* second layer rather than a no-op:

1. Every tenant-owned table has `ENABLE ROW LEVEL SECURITY` **and**
   `FORCE ROW LEVEL SECURITY`. Postgres RLS does not apply to a table's
   owner by default -- `FORCE` is what makes it apply even to the role that
   created the table.
2. The running application connects as a separate, unprivileged
   `bizflow_app` role (`NOSUPERUSER NOBYPASSRLS`), created by the
   `CreateAppRole` migration -- **not** the `bizflow` superuser migrations
   run as. Superusers always bypass RLS regardless of `FORCE`; if the app
   connected as the same role that owns the tables, every policy below
   would be silently ignored. `backend/.env.example` documents the split:
   `DATABASE_URL` (app, restricted) vs. `MIGRATION_DATABASE_URL` (migrations,
   owner).
3. The policies themselves:
   - `organizations`: visible if `id = current_setting('app.current_org_id')`
     **or** the current user (`app.current_user_id`) has *any* membership in
     that org. The `OR` exists specifically so "list my organizations" /
     the org switcher can work at all -- that query is inherently cross-org
     for the one user making it, and runs before any single org has been
     chosen as "current".
   - `organization_settings` (and every future tenant-owned table): strictly
     `organization_id = current_setting('app.current_org_id')`. No
     cross-org carve-out -- these are only ever read within one active
     organization.
   - `memberships`: `user_id = current_setting('app.current_user_id')`.
     Scoped by user, not by org, for the same reason as the `organizations`
     exception -- and it's what makes that exception's subquery safe: since
     `memberships` enforces "only your own rows" regardless of org context,
     the `EXISTS (...)` check in the `organizations` policy can never be
     tricked into confirming someone else's membership.

## Creating an organization

`OrganizationsService.createOrganization` generates the new org's UUID
itself (`randomUUID()`) and calls `tenantContext.setOrganizationId(id)`
*before* inserting anything. That's what lets the `organizations` INSERT
satisfy its own RLS policy immediately (`id = current_org_id` is true for
the row being inserted) without a special bootstrap bypass -- the org,
its settings row, and the creator's `owner` membership are then inserted
in that same already-scoped transaction.

## Known limitations / not done here

- No RBAC yet (Step 4) -- `OrganizationContextGuard` establishes *which*
  org a request operates in, not what the user is allowed to do inside it.
  `memberships.role` is stored but not yet enforced.
- One DB transaction per request (everywhere `TenantContextMiddleware`
  applies, i.e. everywhere except `/health` and the public `/auth/*`
  endpoints) is the correct way to make per-request `SET LOCAL`-style
  session variables reliable under a pooled ORM, but it does mean a slow
  request holds a pooled connection for its whole duration. Acceptable at
  MVP scale; would need attention (e.g. `idle_in_transaction_session_timeout`)
  well before it became a real bottleneck.

## Tenant isolation test suite

`backend/test/utils/` has the reusable pieces every future module should use
rather than re-deriving:

- `tenant-fixtures.ts` → `createOrganizationWithOwner(app, overrides?)`:
  registers a fresh user and has them create a fresh organization, returning
  an access token and org id that are genuinely theirs.
- `expect-tenant-isolation.ts` → `expectTenantIsolation(app, { method, path,
  actingUser, foreignOrganizationId, body? })`: asserts that
  `actingUser` naming `foreignOrganizationId` via `X-Organization-Id` gets a
  403/404 -- never a 2xx, never real data.

`backend/test/tenant-isolation.e2e-spec.ts` is the suite itself: seeds two
real organizations and proves neither can reach the other's data on every
tenant-scoped endpoint that exists so far (`GET /organizations/current`,
`PATCH /organizations/current/settings`). When a future module adds a
tenant-scoped endpoint, its own e2e spec should add a case here (or a
sibling file) calling `expectTenantIsolation` the same way.
