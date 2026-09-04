import { randomUUID } from 'node:crypto';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module.js';
import { backdateColumn } from './utils/backdate-for-testing.js';
import { expectTenantIsolation } from './utils/expect-tenant-isolation.js';
import {
  createOrganizationWithOwner,
  inviteAndAcceptMember,
  TenantFixture,
} from './utils/tenant-fixtures.js';

describe('Team & RBAC (e2e)', () => {
  let app: INestApplication<App>;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api/v1');
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('Invite -> accept', () => {
    it('lets an owner invite someone, who then appears as a real member on acceptance', async () => {
      const owner = await createOrganizationWithOwner(app);
      const teammate = await inviteAndAcceptMember(app, owner, 'member');

      const response = await request(app.getHttpServer())
        .get('/api/v1/organizations/current/members')
        .set('Authorization', `Bearer ${owner.accessToken}`)
        .expect(200);

      const roster = response.body as Array<{ userId: string; role: string }>;
      expect(roster).toContainEqual(
        expect.objectContaining({ userId: teammate.userId, role: 'member' }),
      );
      expect(roster).toHaveLength(2); // owner + teammate
    });

    it('rejects acceptance by a user whose email does not match the invitation', async () => {
      const owner = await createOrganizationWithOwner(app);
      const invite = await request(app.getHttpServer())
        .post('/api/v1/organizations/current/invitations')
        .set('Authorization', `Bearer ${owner.accessToken}`)
        .send({ email: 'invited-person@example.com', role: 'member' })
        .expect(201);

      const intruder = await createOrganizationWithOwner(app); // an unrelated, already-registered user

      await request(app.getHttpServer())
        .post(`/api/v1/invitations/${invite.body.id}/accept`)
        .set('Authorization', `Bearer ${intruder.accessToken}`)
        .expect(404);
    });

    it('lets an owner revoke a pending invitation', async () => {
      const owner = await createOrganizationWithOwner(app);
      const invite = await request(app.getHttpServer())
        .post('/api/v1/organizations/current/invitations')
        .set('Authorization', `Bearer ${owner.accessToken}`)
        .send({ email: 'revoke-me@example.com', role: 'member' })
        .expect(201);

      await request(app.getHttpServer())
        .delete(`/api/v1/organizations/current/invitations/${invite.body.id}`)
        .set('Authorization', `Bearer ${owner.accessToken}`)
        .expect(200);

      await request(app.getHttpServer())
        .post(`/api/v1/invitations/${invite.body.id}/accept`)
        .set('Authorization', `Bearer ${owner.accessToken}`)
        .expect(404);
    });

    it('refuses to accept an expired invitation', async () => {
      const owner = await createOrganizationWithOwner(app);
      const inviteeEmail = `expired-invite-${randomUUID()}@example.com`;
      const invite = await request(app.getHttpServer())
        .post('/api/v1/organizations/current/invitations')
        .set('Authorization', `Bearer ${owner.accessToken}`)
        .send({ email: inviteeEmail, role: 'member' })
        .expect(201);

      await backdateColumn(app, {
        table: 'invitations',
        column: 'expires_at',
        id: invite.body.id,
        organizationId: owner.organizationId,
        userId: owner.userId,
        value: new Date(Date.now() - 24 * 60 * 60 * 1000), // 1 day in the past
      });

      const { accessToken } = await createOrganizationWithOwner(app, { email: inviteeEmail });

      await request(app.getHttpServer())
        .post(`/api/v1/invitations/${invite.body.id}/accept`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(400);
    });
  });

  describe('Permission enforcement', () => {
    it('denies a Member-role user the Owner-only role-management action (the required Step 4 check)', async () => {
      const owner = await createOrganizationWithOwner(app);
      const member = await inviteAndAcceptMember(app, owner, 'member');

      // Member is denied -- @RequirePermission(MEMBERS_MANAGE_ROLES) grants
      // only the owner role (see role-permissions.ts).
      await request(app.getHttpServer())
        .patch(`/api/v1/organizations/current/members/${member.membershipId}/role`)
        .set('Authorization', `Bearer ${member.accessToken}`)
        .send({ role: 'admin' })
        .expect(403);

      // The owner performing the exact same action succeeds -- proving the
      // 403 above is the permission check working, not e.g. a broken route.
      await request(app.getHttpServer())
        .patch(`/api/v1/organizations/current/members/${member.membershipId}/role`)
        .set('Authorization', `Bearer ${owner.accessToken}`)
        .send({ role: 'admin' })
        .expect(200);
    });

    it('denies a Member-role user from inviting, but allows an Admin', async () => {
      const owner = await createOrganizationWithOwner(app);
      const member = await inviteAndAcceptMember(app, owner, 'member');
      const admin = await inviteAndAcceptMember(app, owner, 'admin');

      await request(app.getHttpServer())
        .post('/api/v1/organizations/current/invitations')
        .set('Authorization', `Bearer ${member.accessToken}`)
        .send({ email: 'someone@example.com', role: 'member' })
        .expect(403);

      await request(app.getHttpServer())
        .post('/api/v1/organizations/current/invitations')
        .set('Authorization', `Bearer ${admin.accessToken}`)
        .send({ email: 'someone-else@example.com', role: 'member' })
        .expect(201);
    });

    it('refuses to demote or remove the last owner', async () => {
      const owner = await createOrganizationWithOwner(app);
      const ownerMembership = (
        await request(app.getHttpServer())
          .get('/api/v1/organizations/current/members')
          .set('Authorization', `Bearer ${owner.accessToken}`)
          .expect(200)
      ).body[0];

      await request(app.getHttpServer())
        .patch(`/api/v1/organizations/current/members/${ownerMembership.membershipId}/role`)
        .set('Authorization', `Bearer ${owner.accessToken}`)
        .send({ role: 'admin' })
        .expect(400);

      await request(app.getHttpServer())
        .delete(`/api/v1/organizations/current/members/${ownerMembership.membershipId}`)
        .set('Authorization', `Bearer ${owner.accessToken}`)
        .expect(400);
    });
  });

  describe('Tenant isolation on team endpoints', () => {
    let orgA: TenantFixture;
    let orgB: TenantFixture;

    beforeAll(async () => {
      orgA = await createOrganizationWithOwner(app, { organizationName: 'Team Org A' });
      orgB = await createOrganizationWithOwner(app, { organizationName: 'Team Org B' });
    });

    it("refuses org A's owner access to org B's member list", async () => {
      await expectTenantIsolation(app, {
        method: 'get',
        path: '/api/v1/organizations/current/members',
        actingUser: orgA,
        foreignOrganizationId: orgB.organizationId,
      });
    });

    it("refuses org A's owner from inviting into org B", async () => {
      await expectTenantIsolation(app, {
        method: 'post',
        path: '/api/v1/organizations/current/invitations',
        actingUser: orgA,
        foreignOrganizationId: orgB.organizationId,
        body: { email: 'cross-tenant@example.com', role: 'owner' },
      });
    });

    it("org isolation is checked before permission -- org A's owner still can't reach org B even though 'owner' would satisfy any permission check", async () => {
      // This is the point of running OrganizationContextGuard before
      // PermissionGuard: being an owner (of org A) is never enough on its
      // own, because the org-membership check for org B fails first.
      const response = await request(app.getHttpServer())
        .get('/api/v1/organizations/current/members')
        .set('Authorization', `Bearer ${orgA.accessToken}`)
        .set('X-Organization-Id', orgB.organizationId)
        .send();

      expect(response.status).toBe(403);
      expect(response.body.message).not.toMatch(/permission/i);
      expect(response.body.message).toMatch(/access to this organization/i);
    });
  });
});
