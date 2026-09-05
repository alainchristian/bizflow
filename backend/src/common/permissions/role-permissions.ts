import { MembershipRole } from '../memberships/membership-role.enum.js';
import { Permission } from './permission.enum.js';

/**
 * CRM permissions are deliberately open to every role, `member` included --
 * entering leads/customers and logging notes is normal day-to-day work for
 * anyone on the team, not an administrative function, so gating it the way
 * team management is gated would make the product unusable for its primary
 * users. `crm.leads.convert` is the one exception: turning a lead into a
 * customer is a more consequential, commit-like action, so it's held back
 * to owner/admin -- giving this module its own genuine role boundary to
 * test, the same way `organizations.members.manage_roles` is owner-only.
 *
 * Catalog is the opposite shape: item prices/SKUs feed directly into what
 * customers get quoted and billed, so creating/editing them is held back
 * to owner/admin -- a member can view the catalog (needed to build a
 * quotation in Step 8) but not change it.
 */
const ROLE_PERMISSIONS: Record<MembershipRole, ReadonlySet<Permission>> = {
  [MembershipRole.OWNER]: new Set(Object.values(Permission)),
  [MembershipRole.ADMIN]: new Set([
    Permission.ORGANIZATIONS_MEMBERS_INVITE,
    Permission.ORGANIZATIONS_MEMBERS_REMOVE,
    Permission.CRM_LEADS_VIEW,
    Permission.CRM_LEADS_CREATE,
    Permission.CRM_LEADS_CONVERT,
    Permission.CRM_CUSTOMERS_VIEW,
    Permission.CRM_CUSTOMERS_MANAGE,
    Permission.SALES_CATALOG_ITEMS_VIEW,
    Permission.SALES_CATALOG_ITEMS_CREATE,
    Permission.SALES_CATALOG_ITEMS_MANAGE,
  ]),
  [MembershipRole.MEMBER]: new Set([
    Permission.CRM_LEADS_VIEW,
    Permission.CRM_LEADS_CREATE,
    Permission.CRM_CUSTOMERS_VIEW,
    Permission.CRM_CUSTOMERS_MANAGE,
    Permission.SALES_CATALOG_ITEMS_VIEW,
  ]),
};

export function roleHasPermission(role: MembershipRole, permission: Permission): boolean {
  return ROLE_PERMISSIONS[role].has(permission);
}
