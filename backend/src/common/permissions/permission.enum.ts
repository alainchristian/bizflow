/**
 * MVP RBAC is a static role -> permission-set mapping (see
 * `role-permissions.ts`), not a `permissions`/`roles` database table --
 * per CLAUDE.md's own suggestion ("a simpler role-enum-based approach for
 * MVP") and the build order's "your call, document it" framing. There is
 * exactly one fixed role enum (`MembershipRole`, from Step 3) per
 * membership; permissions are derived from that role in code, not stored.
 * This is deliberately not extensible to custom per-organization roles --
 * that's a real feature (blueprint Section labels it Phase 2: "support
 * custom roles Phase 2"), not something to half-build now. When custom
 * roles are actually needed, this file and `role-permissions.ts` are the
 * two places that change; nothing about `PermissionGuard` or
 * `@RequirePermission` would need to.
 *
 * Naming convention: `module.resource.action`, all lowercase, `_` within a
 * word (e.g. `manage_roles`). `module` matches the owning backend module
 * directory (`organizations`, `crm`, ...); `resource` is the thing being
 * acted on within it; `action` is the verb. Every permission added here
 * (by this module or any future one) should fit that shape -- it's what
 * keeps the map legible as more modules add to it. (Step 4 originally
 * shipped the `members.*` permissions without the module prefix; they were
 * renamed to `organizations.members.*` once this convention was made
 * explicit, while there was still no cost to renaming.)
 */
export enum Permission {
  ORGANIZATIONS_MEMBERS_INVITE = 'organizations.members.invite',
  ORGANIZATIONS_MEMBERS_REMOVE = 'organizations.members.remove',
  ORGANIZATIONS_MEMBERS_MANAGE_ROLES = 'organizations.members.manage_roles',

  CRM_LEADS_VIEW = 'crm.leads.view',
  CRM_LEADS_CREATE = 'crm.leads.create',
  CRM_LEADS_CONVERT = 'crm.leads.convert',
  CRM_CUSTOMERS_VIEW = 'crm.customers.view',
  CRM_CUSTOMERS_MANAGE = 'crm.customers.manage',

  SALES_CATALOG_ITEMS_VIEW = 'sales.catalog_items.view',
  SALES_CATALOG_ITEMS_CREATE = 'sales.catalog_items.create',
  SALES_CATALOG_ITEMS_MANAGE = 'sales.catalog_items.manage',
}
