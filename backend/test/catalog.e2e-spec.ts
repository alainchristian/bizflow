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

describe('Catalog: Catalog Items (e2e)', () => {
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

  describe('Create & list', () => {
    it('creates a catalog item and lists it back', async () => {
      const owner = await createOrganizationWithOwner(app);

      const created = await request(app.getHttpServer())
        .post('/api/v1/sales/catalog-items')
        .set('Authorization', `Bearer ${owner.accessToken}`)
        .send({
          name: 'Consulting Hour',
          type: 'service',
          priceAmount: 15000,
          currencyCode: 'USD',
        })
        .expect(201);

      expect(created.body).toMatchObject({
        name: 'Consulting Hour',
        type: 'service',
        priceAmount: 15000,
        currencyCode: 'USD',
        isActive: true,
      });

      const list = await request(app.getHttpServer())
        .get('/api/v1/sales/catalog-items')
        .set('Authorization', `Bearer ${owner.accessToken}`)
        .expect(200);

      expect(list.body.map((i: { id: string }) => i.id)).toContain(created.body.id);
    });

    it('rejects a negative price', async () => {
      const owner = await createOrganizationWithOwner(app);

      await request(app.getHttpServer())
        .post('/api/v1/sales/catalog-items')
        .set('Authorization', `Bearer ${owner.accessToken}`)
        .send({ name: 'Bad Item', type: 'product', priceAmount: -1, currencyCode: 'USD' })
        .expect(400);
    });

    it('rejects a lowercase or malformed currency code', async () => {
      const owner = await createOrganizationWithOwner(app);

      await request(app.getHttpServer())
        .post('/api/v1/sales/catalog-items')
        .set('Authorization', `Bearer ${owner.accessToken}`)
        .send({ name: 'Bad Currency', type: 'product', priceAmount: 100, currencyCode: 'usd' })
        .expect(400);
    });
  });

  describe('Update & deactivate', () => {
    it('edits a catalog item and deactivates it', async () => {
      const owner = await createOrganizationWithOwner(app);
      const item = await request(app.getHttpServer())
        .post('/api/v1/sales/catalog-items')
        .set('Authorization', `Bearer ${owner.accessToken}`)
        .send({ name: 'Widget', type: 'product', priceAmount: 500, currencyCode: 'USD', sku: 'W-1' })
        .expect(201);

      const edited = await request(app.getHttpServer())
        .patch(`/api/v1/sales/catalog-items/${item.body.id}`)
        .set('Authorization', `Bearer ${owner.accessToken}`)
        .send({ priceAmount: 600 })
        .expect(200);

      expect(edited.body).toMatchObject({ priceAmount: 600, sku: 'W-1', isActive: true });

      const deactivated = await request(app.getHttpServer())
        .patch(`/api/v1/sales/catalog-items/${item.body.id}`)
        .set('Authorization', `Bearer ${owner.accessToken}`)
        .send({ isActive: false })
        .expect(200);

      expect(deactivated.body).toMatchObject({ isActive: false, priceAmount: 600 });
    });
  });

  describe('Permission enforcement', () => {
    it('lets a Member view catalog items but denies create/manage (owner/admin only)', async () => {
      const owner = await createOrganizationWithOwner(app);
      const member = await inviteAndAcceptMember(app, owner, 'member');

      const item = await request(app.getHttpServer())
        .post('/api/v1/sales/catalog-items')
        .set('Authorization', `Bearer ${owner.accessToken}`)
        .send({ name: 'Owner Item', type: 'product', priceAmount: 100, currencyCode: 'USD' })
        .expect(201);

      await request(app.getHttpServer())
        .get('/api/v1/sales/catalog-items')
        .set('Authorization', `Bearer ${member.accessToken}`)
        .expect(200);

      await request(app.getHttpServer())
        .post('/api/v1/sales/catalog-items')
        .set('Authorization', `Bearer ${member.accessToken}`)
        .send({ name: 'Member Item', type: 'product', priceAmount: 100, currencyCode: 'USD' })
        .expect(403);

      await request(app.getHttpServer())
        .patch(`/api/v1/sales/catalog-items/${item.body.id}`)
        .set('Authorization', `Bearer ${member.accessToken}`)
        .send({ isActive: false })
        .expect(403);
    });

    it('lets an Admin create and manage catalog items', async () => {
      const owner = await createOrganizationWithOwner(app);
      const admin = await inviteAndAcceptMember(app, owner, 'admin');

      const item = await request(app.getHttpServer())
        .post('/api/v1/sales/catalog-items')
        .set('Authorization', `Bearer ${admin.accessToken}`)
        .send({ name: 'Admin Item', type: 'service', priceAmount: 200, currencyCode: 'USD' })
        .expect(201);

      await request(app.getHttpServer())
        .patch(`/api/v1/sales/catalog-items/${item.body.id}`)
        .set('Authorization', `Bearer ${admin.accessToken}`)
        .send({ isActive: false })
        .expect(200);
    });
  });

  describe('Tenant isolation', () => {
    let orgA: TenantFixture;
    let orgB: TenantFixture;

    beforeAll(async () => {
      orgA = await createOrganizationWithOwner(app, { organizationName: 'Catalog Org A' });
      orgB = await createOrganizationWithOwner(app, { organizationName: 'Catalog Org B' });
    });

    it("refuses org A's owner access to org B's catalog items via X-Organization-Id", async () => {
      await expectTenantIsolation(app, {
        method: 'get',
        path: '/api/v1/sales/catalog-items',
        actingUser: orgA,
        foreignOrganizationId: orgB.organizationId,
      });
    });

    it("refuses org A's owner from creating a catalog item in org B", async () => {
      await expectTenantIsolation(app, {
        method: 'post',
        path: '/api/v1/sales/catalog-items',
        actingUser: orgA,
        foreignOrganizationId: orgB.organizationId,
        body: { name: 'Cross Tenant Item', type: 'product', priceAmount: 100, currencyCode: 'USD' },
      });
    });

    it("refuses org A's owner from updating a catalog item by naming org B", async () => {
      await expectTenantIsolation(app, {
        method: 'patch',
        path: `/api/v1/sales/catalog-items/${randomUUID()}`,
        actingUser: orgA,
        foreignOrganizationId: orgB.organizationId,
        body: { isActive: false },
      });
    });

    it('a catalog item belonging to org B is invisible to org A even without header spoofing (RLS, not just the guard)', async () => {
      const item = await request(app.getHttpServer())
        .post('/api/v1/sales/catalog-items')
        .set('Authorization', `Bearer ${orgB.accessToken}`)
        .send({ name: 'Org B Item', type: 'product', priceAmount: 100, currencyCode: 'USD' })
        .expect(201);

      // orgA's owner, operating validly in their OWN org context (no
      // spoofed header at all), tries to fetch org B's item by id.
      await request(app.getHttpServer())
        .get(`/api/v1/sales/catalog-items/${item.body.id}`)
        .set('Authorization', `Bearer ${orgA.accessToken}`)
        .expect(404);
    });
  });
});
