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

describe('CRM: Leads & Customers (e2e)', () => {
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

  describe('Leads', () => {
    it('creates a lead and lists it back', async () => {
      const owner = await createOrganizationWithOwner(app);

      const created = await request(app.getHttpServer())
        .post('/api/v1/crm/leads')
        .set('Authorization', `Bearer ${owner.accessToken}`)
        .send({ fullName: 'Jane Prospect', companyName: 'Acme Co', source: 'referral' })
        .expect(201);

      expect(created.body).toMatchObject({
        fullName: 'Jane Prospect',
        companyName: 'Acme Co',
        source: 'referral',
        status: 'new',
      });

      const list = await request(app.getHttpServer())
        .get('/api/v1/crm/leads')
        .set('Authorization', `Bearer ${owner.accessToken}`)
        .expect(200);

      expect(list.body.map((l: { id: string }) => l.id)).toContain(created.body.id);
    });

    it('rejects a lead with no full name', async () => {
      const owner = await createOrganizationWithOwner(app);

      await request(app.getHttpServer())
        .post('/api/v1/crm/leads')
        .set('Authorization', `Bearer ${owner.accessToken}`)
        .send({ fullName: '' })
        .expect(400);
    });
  });

  describe('Lead conversion', () => {
    it('converts a lead into a customer, preserving the link both ways', async () => {
      const owner = await createOrganizationWithOwner(app);
      const lead = await request(app.getHttpServer())
        .post('/api/v1/crm/leads')
        .set('Authorization', `Bearer ${owner.accessToken}`)
        .send({ fullName: 'Jane Prospect', companyName: 'Acme Co', email: 'jane@acme.com' })
        .expect(201);

      const customer = await request(app.getHttpServer())
        .post(`/api/v1/crm/leads/${lead.body.id}/convert`)
        .set('Authorization', `Bearer ${owner.accessToken}`)
        .expect(201);

      expect(customer.body).toMatchObject({
        name: 'Acme Co',
        email: 'jane@acme.com',
        convertedFromLeadId: lead.body.id,
      });

      const reloadedLead = await request(app.getHttpServer())
        .get(`/api/v1/crm/leads/${lead.body.id}`)
        .set('Authorization', `Bearer ${owner.accessToken}`)
        .expect(200);

      // The lead itself is never deleted or overwritten -- source/history
      // survive conversion, just marked and linked to the new customer.
      expect(reloadedLead.body).toMatchObject({
        fullName: 'Jane Prospect',
        companyName: 'Acme Co',
        status: 'converted',
        convertedCustomerId: customer.body.id,
      });
    });

    it('refuses to convert the same lead twice', async () => {
      const owner = await createOrganizationWithOwner(app);
      const lead = await request(app.getHttpServer())
        .post('/api/v1/crm/leads')
        .set('Authorization', `Bearer ${owner.accessToken}`)
        .send({ fullName: 'Once Only' })
        .expect(201);

      await request(app.getHttpServer())
        .post(`/api/v1/crm/leads/${lead.body.id}/convert`)
        .set('Authorization', `Bearer ${owner.accessToken}`)
        .expect(201);

      await request(app.getHttpServer())
        .post(`/api/v1/crm/leads/${lead.body.id}/convert`)
        .set('Authorization', `Bearer ${owner.accessToken}`)
        .expect(409);
    });
  });

  describe('Customer notes & contacts', () => {
    it('adds a note and a contact, both reflected in the customer detail view', async () => {
      const owner = await createOrganizationWithOwner(app);
      const lead = await request(app.getHttpServer())
        .post('/api/v1/crm/leads')
        .set('Authorization', `Bearer ${owner.accessToken}`)
        .send({ fullName: 'Prospect' })
        .expect(201);
      const customer = await request(app.getHttpServer())
        .post(`/api/v1/crm/leads/${lead.body.id}/convert`)
        .set('Authorization', `Bearer ${owner.accessToken}`)
        .expect(201);

      await request(app.getHttpServer())
        .post(`/api/v1/crm/customers/${customer.body.id}/notes`)
        .set('Authorization', `Bearer ${owner.accessToken}`)
        .send({ body: 'Had a great first call.' })
        .expect(201);

      await request(app.getHttpServer())
        .post(`/api/v1/crm/customers/${customer.body.id}/contacts`)
        .set('Authorization', `Bearer ${owner.accessToken}`)
        .send({ fullName: 'Bob Buyer', email: 'bob@acme.com' })
        .expect(201);

      const detail = await request(app.getHttpServer())
        .get(`/api/v1/crm/customers/${customer.body.id}`)
        .set('Authorization', `Bearer ${owner.accessToken}`)
        .expect(200);

      expect(detail.body.notes).toHaveLength(1);
      expect(detail.body.notes[0]).toMatchObject({ body: 'Had a great first call.' });
      expect(detail.body.contacts).toHaveLength(1);
      expect(detail.body.contacts[0]).toMatchObject({ fullName: 'Bob Buyer' });
    });
  });

  describe('Permission enforcement', () => {
    it('lets a Member create and view leads/customers, but denies converting (owner/admin only)', async () => {
      const owner = await createOrganizationWithOwner(app);
      const member = await inviteAndAcceptMember(app, owner, 'member');

      const lead = await request(app.getHttpServer())
        .post('/api/v1/crm/leads')
        .set('Authorization', `Bearer ${member.accessToken}`)
        .send({ fullName: 'Member Lead' })
        .expect(201);

      await request(app.getHttpServer())
        .get('/api/v1/crm/leads')
        .set('Authorization', `Bearer ${member.accessToken}`)
        .expect(200);

      await request(app.getHttpServer())
        .post(`/api/v1/crm/leads/${lead.body.id}/convert`)
        .set('Authorization', `Bearer ${member.accessToken}`)
        .expect(403);

      // The same action from the owner succeeds -- proving the 403 above
      // is the permission check working, not a broken route.
      await request(app.getHttpServer())
        .post(`/api/v1/crm/leads/${lead.body.id}/convert`)
        .set('Authorization', `Bearer ${owner.accessToken}`)
        .expect(201);
    });

    it('lets an Admin convert a lead', async () => {
      const owner = await createOrganizationWithOwner(app);
      const admin = await inviteAndAcceptMember(app, owner, 'admin');

      const lead = await request(app.getHttpServer())
        .post('/api/v1/crm/leads')
        .set('Authorization', `Bearer ${admin.accessToken}`)
        .send({ fullName: 'Admin Lead' })
        .expect(201);

      await request(app.getHttpServer())
        .post(`/api/v1/crm/leads/${lead.body.id}/convert`)
        .set('Authorization', `Bearer ${admin.accessToken}`)
        .expect(201);
    });
  });

  describe('Tenant isolation', () => {
    let orgA: TenantFixture;
    let orgB: TenantFixture;

    beforeAll(async () => {
      orgA = await createOrganizationWithOwner(app, { organizationName: 'CRM Org A' });
      orgB = await createOrganizationWithOwner(app, { organizationName: 'CRM Org B' });
    });

    it("refuses org A's owner access to org B's leads via X-Organization-Id", async () => {
      await expectTenantIsolation(app, {
        method: 'get',
        path: '/api/v1/crm/leads',
        actingUser: orgA,
        foreignOrganizationId: orgB.organizationId,
      });
    });

    it("refuses org A's owner from creating a lead in org B", async () => {
      await expectTenantIsolation(app, {
        method: 'post',
        path: '/api/v1/crm/leads',
        actingUser: orgA,
        foreignOrganizationId: orgB.organizationId,
        body: { fullName: 'Cross Tenant Lead' },
      });
    });

    it("refuses org A's owner from converting a lead by naming org B", async () => {
      await expectTenantIsolation(app, {
        method: 'post',
        path: `/api/v1/crm/leads/${randomUUID()}/convert`,
        actingUser: orgA,
        foreignOrganizationId: orgB.organizationId,
      });
    });

    it("a customer belonging to org B is invisible to org A even without header spoofing (RLS, not just the guard)", async () => {
      const lead = await request(app.getHttpServer())
        .post('/api/v1/crm/leads')
        .set('Authorization', `Bearer ${orgB.accessToken}`)
        .send({ fullName: 'Org B Prospect' })
        .expect(201);
      const customer = await request(app.getHttpServer())
        .post(`/api/v1/crm/leads/${lead.body.id}/convert`)
        .set('Authorization', `Bearer ${orgB.accessToken}`)
        .expect(201);

      // orgA's owner, operating validly in their OWN org context (no
      // spoofed header at all), tries to fetch org B's customer by id.
      await request(app.getHttpServer())
        .get(`/api/v1/crm/customers/${customer.body.id}`)
        .set('Authorization', `Bearer ${orgA.accessToken}`)
        .expect(404);
    });
  });
});
