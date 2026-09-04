import { config } from 'dotenv';
import { DataSource } from 'typeorm';
import { Membership } from '../common/memberships/entities/membership.entity.js';
import { Contact } from '../crm/entities/contact.entity.js';
import { CustomerNote } from '../crm/entities/customer-note.entity.js';
import { Customer } from '../crm/entities/customer.entity.js';
import { Lead } from '../crm/entities/lead.entity.js';
import { OrganizationSettings } from '../organizations/entities/organization-settings.entity.js';
import { Organization } from '../organizations/entities/organization.entity.js';
import { Invitation } from '../organizations/invitations/entities/invitation.entity.js';
import { User } from '../users/entities/user.entity.js';

config({ path: ['.env.local', '.env'] });

// Migrations run schema DDL (CREATE TABLE, CREATE POLICY, CREATE ROLE) and
// so need the database owner/superuser connection, not the restricted
// `bizflow_app` role the running application connects as (DATABASE_URL) --
// see the CreateAppRole migration for why that split exists.
export const AppDataSource = new DataSource({
  type: 'postgres',
  url: process.env.MIGRATION_DATABASE_URL ?? process.env.DATABASE_URL,
  entities: [
    User,
    Organization,
    OrganizationSettings,
    Membership,
    Invitation,
    Lead,
    Customer,
    Contact,
    CustomerNote,
  ],
  migrations: ['src/database/migrations/*.ts'],
  synchronize: false,
});
