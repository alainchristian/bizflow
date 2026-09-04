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

Five things cooperate on every request, in this order:

1. **`TenantContextMiddleware`** (`common/tenant-context/`) opens one
   transaction per request -- via a single `QueryRunner` pinned to one
   connection for the request's duration -- and stores it in an
   `AsyncLocalStorage` (`TenantContextStore`). This runs before guards, so
   it's already in place when they need it. It only *opens* the
   transaction; it does not commit or roll back (see point 5).
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
5. **`TenantTransactionInterceptor`** commits the transaction once the
   handler succeeds, and **`TenantTransactionExceptionFilter`** rolls it
   back on any thrown exception (from a guard, a pipe, or the controller
   itself) -- both global, both running *before* Nest is allowed to send
   the response to the client. This ordering is load-bearing, not
   cosmetic: an earlier version of this middleware waited for the HTTP
   response to finish sending and committed *afterwards*, which meant a
   client could receive a response for a write whose transaction hadn't
   actually committed yet. Under light, sequential load the commit
   (typically sub-millisecond) finished before anything else happened to
   ask, masking the bug; it surfaced as sporadic, load-dependent test
   failures (a request immediately following a write acting as though the
   write hadn't happened) once multiple e2e spec files ran concurrently
   against the same database -- exactly the kind of thing "worked in
   testing" is not enough to catch, and worth knowing this class of bug is
   the specific thing `TenantTransactionInterceptor`/`ExceptionFilter`
   exist to close off. A plain middleware can't fix this on its own:
   middleware runs *before* guards, but the "commit before responding"
   hook has to wrap the controller call itself, which is what interceptors
   are for; guard failures never reach an interceptor at all, which is why
   the rollback half needs an exception filter instead (filters catch
   exceptions from anywhere in the guard -> pipe -> controller pipeline).

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

### A recurring NestJS DI gotcha: every module in a guard's dependency chain needs to be `@Global()`, not just the guard's own module

Hit three times now while adding new feature modules (organizations,
then crm), so it's worth naming explicitly rather than re-debugging a
fourth time: `@UseGuards(SomeGuard)` referenced by class (not an
instance) makes Nest instantiate/resolve `SomeGuard` using an injector
scope that, in practice, needs *every* provider that guard's constructor
depends on -- transitively -- to be resolvable without the *consuming*
module (e.g. a brand-new `CrmModule`) importing anything beyond the
guard's own module. Marking the guard's immediate host module
(`CommonGuardsModule`) `@Global()` is necessary but was not always
sufficient: `OrganizationContextGuard` also depends on
`MembershipsService`, from `MembershipsModule` -- and until
`MembershipsModule` was *also* marked `@Global()`, adding a third
consumer (`CrmModule`) broke dependency resolution for
`OrganizationContextGuard` at boot, even though the identical pattern
had worked fine for the first two consumers (`AuthModule`,
`OrganizationsModule`). The practical rule: when a shared guard/provider
needs to work from an arbitrary future module, every module in its own
dependency chain has to be `@Global()`, not just the one directly
housing it. If a new module fails to boot with
`UnknownDependenciesException` naming a guard that already works
elsewhere, this is almost certainly why -- check what that guard
depends on, and whether every link in that chain is actually global.

## Query builder usage is not auto-scoped

`TenantScopedRepository` only auto-scopes its five methods:
`find`/`findOne`/`create`/`save`/`mergeAndSave`. It deliberately has no
`createQueryBuilder()` and is not going to grow one -- a query builder call
builds arbitrary SQL, and there is no general, safe way to auto-inject a
`WHERE organizationId = …` into an arbitrary query without either being
fragile (string-matching aliases, guessing join shapes) or so restrictive it
isn't really a query builder anymore. `repository`/`entity` are `private` on
the base class specifically so a subclass *can't* reach in and call
`createQueryBuilder()` on the underlying TypeORM repository by accident.

If a future module genuinely needs one (a report with a join, an aggregate,
a cursor-paginated query the simple methods can't express), the pattern is:
get the repository directly from `tenantContextStore.getRepository(Entity)`
(the same way `MembershipsService` already does, rather than extending
`TenantScopedRepository` for that method) and add the organization filter
by hand on every such query:

```ts
this.tenantContext
  .getRepository(SomeEntity)
  .createQueryBuilder('e')
  .andWhere('e.organizationId = :organizationId', {
    organizationId: this.tenantContext.organizationId,
  })
  // ...the rest of the query
```

**This is not enforced by anything except code review and RLS.** For the
five base-repository methods, RLS is a second layer behind an
application-layer control that's already correct. For hand-written query
builder code, RLS is the *only* enforced layer -- the application-layer
"control" is just "the developer remembered to add `.andWhere(...)`". Treat
any PR introducing a `.createQueryBuilder()` call on a tenant-owned table as
needing extra scrutiny on this specific point, and give it its own
tenant-isolation test via `expectTenantIsolation` like everything else.

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

- RBAC (Step 4) establishes what a role is allowed to do; see
  `docs/security/rbac.md`. `OrganizationContextGuard` on its own only ever
  established *which* org a request operates in, never permissions.
- **Every request holds one pooled Postgres connection for its full
  duration.** `TenantContextMiddleware` opens a transaction (and therefore
  checks out a connection) at the start of the request;
  `TenantTransactionInterceptor`/`TenantTransactionExceptionFilter`
  commit or roll it back once the handler resolves, before the response
  reaches the client (see above) -- which still means *any* slow step
  within that request (a slow query, but also a slow call to some other
  service, an email send, anything awaited before the handler returns)
  holds that connection the whole time, not just for the duration of
  its own DB queries. This is the correct way to make per-request
  `SET LOCAL`-style session variables reliable under a pooled ORM, and is
  fine at MVP traffic levels. If connection-pool exhaustion ever shows up in
  production (requests queuing for a connection, intermittent timeouts under
  load), don't spend time rediscovering why -- the fix is to shorten the
  transaction's actual lifetime, i.e. move slow, non-DB I/O in a request
  handler *outside* the scope of the transaction (do it before the
  transaction would need to start, or after the response's DB work is
  already committed), or add
  `idle_in_transaction_session_timeout`/pool-size tuning as a stopgap while
  that refactor happens. This has not been needed yet and is not a Step 3/4
  concern -- it's written down here so it isn't a mystery outage later.

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

Two more properties of the isolation model are covered specifically, not
just implied by the above:

- **Concurrency, not just sequential tests.** Every test above `await`s one
  request before sending the next, so on its own it would not catch a bug
  where `TenantContextStore` failed to isolate two requests running at the
  same time (e.g. if it were ever changed to a plain module-level variable
  instead of an `AsyncLocalStorage`). The `Concurrent requests` block in
  `tenant-isolation.e2e-spec.ts` fires ~25 interleaved requests across both
  organizations via `Promise.all` (no `await` between dispatching them) and
  asserts every single response still resolves to its own org's data.
- **DTO-level rejection of spoofed org fields.** The global `ValidationPipe`
  (`main.ts`, and every e2e spec's test app) is configured with
  `whitelist: true, forbidNonWhitelisted: true` -- an `organizationId` or
  `organization_id` field in a request body is not a recognized property of
  any DTO in this codebase, so it doesn't get silently stripped, it makes
  the whole request `400`. `organizations.e2e-spec.ts` has explicit cases
  for this on both `POST /organizations` and
  `PATCH /organizations/current/settings`, in both cases confirming the
  target organization's data was left untouched by the rejected attempt.
  This matters because it's a *third*, independent layer for exactly the
  one field (`organizationId`) the other two layers exist to protect --
  even before a request reaches a guard or a repository, the DTO itself
  won't accept a client's opinion about which organization a row belongs
  to.
