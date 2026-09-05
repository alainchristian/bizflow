import { randomUUID } from 'node:crypto';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module.js';
import { expectTenantIsolation } from './utils/expect-tenant-isolation.js';
import {
  createOrganizationWithOwner,
  inviteAndAcceptMember,
  TenantFixture,
} from './utils/tenant-fixtures.js';

describe('Sales: Tax Rules (e2e)', () => {
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

  describe('Create, list & update', () => {
    it('creates a tax rule and lists it back', async () => {
      const owner = await createOrganizationWithOwner(app);

      const created = await request(app.getHttpServer())
        .post('/api/v1/sales/tax-rules')
        .set('Authorization', `Bearer ${owner.accessToken}`)
        .send({ name: 'Sales Tax', rateBasisPoints: 1000 })
        .expect(201);

      expect(created.body).toMatchObject({
        name: 'Sales Tax',
        rateBasisPoints: 1000,
        isInclusive: false,
        isActive: true,
      });

      const list = await request(app.getHttpServer())
        .get('/api/v1/sales/tax-rules')
        .set('Authorization', `Bearer ${owner.accessToken}`)
        .expect(200);

      expect(list.body.map((r: { id: string }) => r.id)).toContain(created.body.id);
    });

    it('rejects a rate above 100%', async () => {
      const owner = await createOrganizationWithOwner(app);

      await request(app.getHttpServer())
        .post('/api/v1/sales/tax-rules')
        .set('Authorization', `Bearer ${owner.accessToken}`)
        .send({ name: 'Absurd Tax', rateBasisPoints: 10001 })
        .expect(400);
    });

    it('edits a tax rule and deactivates it', async () => {
      const owner = await createOrganizationWithOwner(app);
      const rule = await request(app.getHttpServer())
        .post('/api/v1/sales/tax-rules')
        .set('Authorization', `Bearer ${owner.accessToken}`)
        .send({ name: 'VAT', rateBasisPoints: 2000, isInclusive: true })
        .expect(201);

      const edited = await request(app.getHttpServer())
        .patch(`/api/v1/sales/tax-rules/${rule.body.id}`)
        .set('Authorization', `Bearer ${owner.accessToken}`)
        .send({ rateBasisPoints: 2100 })
        .expect(200);

      expect(edited.body).toMatchObject({ rateBasisPoints: 2100, isInclusive: true, isActive: true });

      const deactivated = await request(app.getHttpServer())
        .patch(`/api/v1/sales/tax-rules/${rule.body.id}`)
        .set('Authorization', `Bearer ${owner.accessToken}`)
        .send({ isActive: false })
        .expect(200);

      expect(deactivated.body).toMatchObject({ isActive: false, rateBasisPoints: 2100 });
    });
  });

  describe('Catalog items can reference a tax rule', () => {
    it('attaches a tax rule to a catalog item at creation', async () => {
      const owner = await createOrganizationWithOwner(app);
      const rule = await request(app.getHttpServer())
        .post('/api/v1/sales/tax-rules')
        .set('Authorization', `Bearer ${owner.accessToken}`)
        .send({ name: 'VAT', rateBasisPoints: 2000 })
        .expect(201);

      const item = await request(app.getHttpServer())
        .post('/api/v1/sales/catalog-items')
        .set('Authorization', `Bearer ${owner.accessToken}`)
        .send({
          name: 'Widget',
          type: 'product',
          priceAmount: 1000,
          currencyCode: 'USD',
          taxRuleId: rule.body.id,
        })
        .expect(201);

      expect(item.body.taxRuleId).toBe(rule.body.id);
    });

    it("rejects a tax rule id that belongs to a different organization", async () => {
      const orgA = await createOrganizationWithOwner(app);
      const orgB = await createOrganizationWithOwner(app);
      const foreignRule = await request(app.getHttpServer())
        .post('/api/v1/sales/tax-rules')
        .set('Authorization', `Bearer ${orgB.accessToken}`)
        .send({ name: 'Org B VAT', rateBasisPoints: 2000 })
        .expect(201);

      await request(app.getHttpServer())
        .post('/api/v1/sales/catalog-items')
        .set('Authorization', `Bearer ${orgA.accessToken}`)
        .send({
          name: 'Widget',
          type: 'product',
          priceAmount: 1000,
          currencyCode: 'USD',
          taxRuleId: foreignRule.body.id,
        })
        .expect(400);
    });
  });

  describe('Permission enforcement', () => {
    it('denies a Member view, create, and manage of tax rules (owner/admin only)', async () => {
      const owner = await createOrganizationWithOwner(app);
      const member = await inviteAndAcceptMember(app, owner, 'member');

      const rule = await request(app.getHttpServer())
        .post('/api/v1/sales/tax-rules')
        .set('Authorization', `Bearer ${owner.accessToken}`)
        .send({ name: 'Owner Rule', rateBasisPoints: 500 })
        .expect(201);

      await request(app.getHttpServer())
        .get('/api/v1/sales/tax-rules')
        .set('Authorization', `Bearer ${member.accessToken}`)
        .expect(403);

      await request(app.getHttpServer())
        .post('/api/v1/sales/tax-rules')
        .set('Authorization', `Bearer ${member.accessToken}`)
        .send({ name: 'Member Rule', rateBasisPoints: 500 })
        .expect(403);

      await request(app.getHttpServer())
        .patch(`/api/v1/sales/tax-rules/${rule.body.id}`)
        .set('Authorization', `Bearer ${member.accessToken}`)
        .send({ isActive: false })
        .expect(403);
    });

    it('lets an Admin create, view, and manage tax rules', async () => {
      const owner = await createOrganizationWithOwner(app);
      const admin = await inviteAndAcceptMember(app, owner, 'admin');

      const rule = await request(app.getHttpServer())
        .post('/api/v1/sales/tax-rules')
        .set('Authorization', `Bearer ${admin.accessToken}`)
        .send({ name: 'Admin Rule', rateBasisPoints: 800 })
        .expect(201);

      await request(app.getHttpServer())
        .get('/api/v1/sales/tax-rules')
        .set('Authorization', `Bearer ${admin.accessToken}`)
        .expect(200);

      await request(app.getHttpServer())
        .patch(`/api/v1/sales/tax-rules/${rule.body.id}`)
        .set('Authorization', `Bearer ${admin.accessToken}`)
        .send({ isActive: false })
        .expect(200);
    });
  });

  describe('Tenant isolation', () => {
    let orgA: TenantFixture;
    let orgB: TenantFixture;

    beforeAll(async () => {
      orgA = await createOrganizationWithOwner(app, { organizationName: 'Tax Org A' });
      orgB = await createOrganizationWithOwner(app, { organizationName: 'Tax Org B' });
    });

    it("refuses org A's owner access to org B's tax rules via X-Organization-Id", async () => {
      await expectTenantIsolation(app, {
        method: 'get',
        path: '/api/v1/sales/tax-rules',
        actingUser: orgA,
        foreignOrganizationId: orgB.organizationId,
      });
    });

    it("refuses org A's owner from creating a tax rule in org B", async () => {
      await expectTenantIsolation(app, {
        method: 'post',
        path: '/api/v1/sales/tax-rules',
        actingUser: orgA,
        foreignOrganizationId: orgB.organizationId,
        body: { name: 'Cross Tenant Rule', rateBasisPoints: 500 },
      });
    });

    it("refuses org A's owner from updating a tax rule by naming org B", async () => {
      await expectTenantIsolation(app, {
        method: 'patch',
        path: `/api/v1/sales/tax-rules/${randomUUID()}`,
        actingUser: orgA,
        foreignOrganizationId: orgB.organizationId,
        body: { isActive: false },
      });
    });

    it('a tax rule belonging to org B is invisible to org A even without header spoofing (RLS, not just the guard)', async () => {
      const rule = await request(app.getHttpServer())
        .post('/api/v1/sales/tax-rules')
        .set('Authorization', `Bearer ${orgB.accessToken}`)
        .send({ name: 'Org B Rule', rateBasisPoints: 500 })
        .expect(201);

      await request(app.getHttpServer())
        .get(`/api/v1/sales/tax-rules/${rule.body.id}`)
        .set('Authorization', `Bearer ${orgA.accessToken}`)
        .expect(404);
    });
  });
});
