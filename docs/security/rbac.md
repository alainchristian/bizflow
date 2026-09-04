# Roles & Permissions (RBAC)

Implements build-order Step 4. Read `docs/multi-tenancy/tenant-isolation.md`
first if you haven't -- this builds directly on `JwtAuthGuard` and
`OrganizationContextGuard` from Step 3, and doesn't re-explain them.

## The model: a static role -> permission map, not a database table

Every membership already carries a `role` (`MembershipRole`: `owner`,
`admin`, `member`, from Step 3). Step 4 does not add a `roles` or
`permissions` table. Instead, `common/permissions/role-permissions.ts` is a
fixed, in-code map from role to the set of `Permission`s it grants:

```ts
const ROLE_PERMISSIONS: Record<MembershipRole, ReadonlySet<Permission>> = {
  [MembershipRole.OWNER]: new Set(Object.values(Permission)), // everything
  [MembershipRole.ADMIN]: new Set([MEMBERS_INVITE, MEMBERS_REMOVE]),
  [MembershipRole.MEMBER]: new Set(), // no management permissions
};
```

**This was a deliberate choice, not a shortcut.** CLAUDE.md itself suggests
"a simpler role-enum-based approach for MVP", and the blueprint explicitly
defers custom, per-organization roles to Phase 2. A real `roles`/
`permissions` schema (letting an organization define its own roles with
arbitrary permission sets) is a genuine feature with its own migration,
admin UI, and edge cases -- not something to half-build now. Because the
enforcement point (`PermissionGuard` + `@RequirePermission`) only talks to
`roleHasPermission(role, permission)`, building that real feature later
means changing `role-permissions.ts` (and probably adding a lookup against
a new table), not touching the guard, the decorator, or any controller that
already uses them.

`Permission` (`common/permissions/permission.enum.ts`) currently has three
values, all about team management -- the only permission-gated feature
Step 4 actually built:

- `members.invite` -- owner, admin
- `members.remove` -- owner, admin
- `members.manage_roles` -- **owner only**

`PATCH /organizations/current/settings` (from Step 3) was deliberately
**not** retrofitted with a permission check -- it still only requires
membership, same as before. Step 4 only added permission checks to the
endpoints it introduced; changing Step 3's behavior wasn't asked for and
would have been unrelated scope creep.

## How the three guards compose

A permission-gated route declares all three, in this exact order:

```ts
@UseGuards(JwtAuthGuard, OrganizationContextGuard, PermissionGuard)
@RequirePermission(Permission.MEMBERS_INVITE)
@Post('invitations')
```

Order matters because each guard depends on state the previous one put in
`TenantContextStore` -- there is no way to satisfy a later guard without
having genuinely passed the earlier ones first:

1. **`JwtAuthGuard`** verifies the JWT and calls
   `tenantContext.setUserId(sub)`. If this fails, the request is `401`
   before anything else runs -- there is no user to check a role for yet.
2. **`OrganizationContextGuard`** resolves which organization the request
   operates in, verifying a real `memberships` row for
   `(that user, that org)` first (see the tenant-isolation doc for exactly
   how). If this fails, the request is `403`/`400` -- *this is checked
   before any permission is evaluated*. A user who is genuinely an owner of
   Org A gets no benefit from that fact when targeting Org B: they fail
   here, never reaching `PermissionGuard` at all. `team.e2e-spec.ts` has an
   explicit test for exactly this ("org isolation is checked before
   permission").
3. **`PermissionGuard`** only runs once the first two have already
   succeeded. It reads `tenantContext.userId`/`.organizationId` -- both
   guaranteed set by now -- looks up that user's membership *in that
   specific organization*, and checks its role against the
   `@RequirePermission(...)` the route declared via `Reflector`. No
   metadata means no check (the guard is a no-op) -- everything under
   `TeamController` sets one; routes with none (e.g.
   `GET /organizations/current/members`, open to any member) simply don't
   list `PermissionGuard` in their `@UseGuards(...)`.

So a request cannot "slip through with valid auth + valid org membership
but an insufficient role": step 3 is only reached after steps 1 and 2 have
already independently succeeded, and step 3 is the one that actually checks
the role. There's no branch that skips it for a route that declared
`@RequirePermission`, and no way to satisfy it without a real membership
row carrying a sufficient role -- `PermissionGuard` throws rather than
proceeding if `userId`/`organizationId` are somehow unset, specifically so
a route that forgot the first two guards fails loudly instead of silently
checking permissions against nothing.

## Invitations

`organizations/invitations/` is Step 4's other half: an Owner/Admin invites
by email + role (`POST /organizations/current/invitations`, gated by
`members.invite`); the invited person accepts
(`POST /invitations/:id/accept`) and gets a real `memberships` row created
with the role the invitation specified.

A few deliberate simplifications, to keep this bounded to what Step 4 asked
for:

- **No email sending.** That's Step 13 (Notifications). The invite endpoint
  returns the invitation (including its id, which doubles as the accept
  link's token -- see below) directly in the response; there's no
  background job or provider integration to build prematurely.
- **The invitation's own `id` is the accept token.** It's already an
  unguessable random UUID; a separate `token` column would be redundant.
- **No expiry.** Can be added later as a plain `ADD COLUMN` + an expiry
  check in `acceptInvitation` -- not a breaking change, so not worth
  building before it's needed.
- **Accepting requires an existing session.** If the invited person has no
  account yet, they register first, then visit the accept link while
  logged in. There's no combined "register-and-accept-in-one-step" flow.

### Why the accept route has no `OrganizationContextGuard`

`POST /invitations/:id/accept` only uses `JwtAuthGuard`. The whole point of
this route is to grant the caller their *first* relationship to an
organization, so `OrganizationContextGuard` -- which requires an existing
membership to verify -- has nothing to check yet. Safety instead comes from
two independent places:

1. **App layer:** `TeamService.acceptInvitation` looks up the invitation by
   `(id, email)`, matching against the *authenticated* caller's own email
   from their JWT (`InvitationsService.findPendingByIdForEmail`) -- not
   just by id.
2. **RLS:** the `invitations` table's policy only reveals a row if
   `organization_id = app.current_org_id` (not the case here -- no org
   context exists) **or** `email` matches the caller's own email, derived
   from `users` via `app.current_user_id`. A user who somehow obtained
   someone else's invitation id gets `404` -- the row is invisible to them
   at the database level, independent of the app-layer email check above
   agreeing.

`team.e2e-spec.ts` has a test registering an unrelated second user and
confirming they get `404` trying to accept an invitation addressed to a
different email.

### Last-owner protection

`TeamService` refuses to demote (`updateMemberRole`) or remove
(`removeMember`) an organization's only remaining owner (`400`). This
isn't part of the RBAC model itself (`PermissionGuard` doesn't know about
it -- an owner has full permission to run either action), it's a
correctness guard in the service layer against an organization
accidentally being left with nobody able to manage it.

## Tests

`team.e2e-spec.ts` covers, per the build order's explicit requirement,
*both* checks on the same endpoints rather than just one or the other:

- **Permission**: a Member is denied the owner-only `members.manage_roles`
  action (`403`); the same request from the owner succeeds. A Member is
  also denied `members.invite`; an Admin (who has it) succeeds.
- **Tenant isolation**: the same team endpoints, reusing
  `expectTenantIsolation` from Step 3's test utilities -- an owner of one
  organization cannot list, invite into, or otherwise manage a different
  organization's team by naming it via `X-Organization-Id`.
