import { randomUUID } from 'node:crypto';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module.js';
import { createOrganizationWithOwner } from './utils/tenant-fixtures.js';

function uniqueEmail(): string {
  return `${randomUUID()}@example.com`;
}

async function registerUser(app: INestApplication<App>) {
  const email = uniqueEmail();
  const response = await request(app.getHttpServer())
    .post('/api/v1/auth/register')
    .send({ email, password: 'super-secret-1', fullName: 'Org Test User' })
    .expect(201);
  return { email, accessToken: response.body.accessToken as string };
}

describe('Organizations (e2e)', () => {
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

  describe('POST /organizations', () => {
    it('creates an organization and makes the creator its owner', async () => {
      const { accessToken } = await registerUser(app);

      const response = await request(app.getHttpServer())
        .post('/api/v1/organizations')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ name: 'Acme Consulting', countryCode: 'US', baseCurrency: 'USD' })
        .expect(201);

      expect(response.body).toMatchObject({
        name: 'Acme Consulting',
        countryCode: 'US',
        baseCurrency: 'USD',
        role: 'owner',
      });
      expect(response.body.id).toEqual(expect.any(String));
    });

    it('rejects a request with no access token', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/organizations')
        .send({ name: 'No Auth Org', countryCode: 'US', baseCurrency: 'USD' })
        .expect(401);
    });

    it('rejects an invalid country/currency code', async () => {
      const { accessToken } = await registerUser(app);

      await request(app.getHttpServer())
        .post('/api/v1/organizations')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ name: 'Bad Org', countryCode: 'usa', baseCurrency: 'dollars' })
        .expect(400);
    });

    it('rejects a spoofed organizationId in the body rather than honoring it', async () => {
      const { accessToken } = await registerUser(app);

      // Neither field exists on CreateOrganizationDto, so the global
      // ValidationPipe's forbidNonWhitelisted should reject the whole
      // request -- proving the DTO layer, not just the repository layer,
      // refuses to let a client name an organization id.
      await request(app.getHttpServer())
        .post('/api/v1/organizations')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          name: 'Spoofed Org',
          countryCode: 'US',
          baseCurrency: 'USD',
          organizationId: randomUUID(),
        })
        .expect(400);

      await request(app.getHttpServer())
        .post('/api/v1/organizations')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          name: 'Spoofed Org',
          countryCode: 'US',
          baseCurrency: 'USD',
          organization_id: randomUUID(),
        })
        .expect(400);
    });
  });

  describe('GET /organizations', () => {
    it("lists only the caller's own organizations", async () => {
      const fixtureA = await createOrganizationWithOwner(app);
      const fixtureB = await createOrganizationWithOwner(app);

      const response = await request(app.getHttpServer())
        .get('/api/v1/organizations')
        .set('Authorization', `Bearer ${fixtureA.accessToken}`)
        .expect(200);

      const ids = response.body.map((org: { id: string }) => org.id);
      expect(ids).toContain(fixtureA.organizationId);
      expect(ids).not.toContain(fixtureB.organizationId);
    });

    it('returns an empty list for a user with no organizations', async () => {
      const { accessToken } = await registerUser(app);

      const response = await request(app.getHttpServer())
        .get('/api/v1/organizations')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(response.body).toEqual([]);
    });
  });

  describe('GET /organizations/current', () => {
    it('defaults to the only organization the user belongs to', async () => {
      const fixture = await createOrganizationWithOwner(app);

      const response = await request(app.getHttpServer())
        .get('/api/v1/organizations/current')
        .set('Authorization', `Bearer ${fixture.accessToken}`)
        .expect(200);

      expect(response.body).toMatchObject({
        id: fixture.organizationId,
        name: fixture.organizationName,
      });
      expect(response.body.settings).toMatchObject({
        organizationId: fixture.organizationId,
        dateFormat: 'DD/MM/YYYY',
        taxInclusivePricing: false,
      });
    });

    it('accepts an explicit X-Organization-Id the user belongs to', async () => {
      const fixture = await createOrganizationWithOwner(app);

      await request(app.getHttpServer())
        .get('/api/v1/organizations/current')
        .set('Authorization', `Bearer ${fixture.accessToken}`)
        .set('X-Organization-Id', fixture.organizationId)
        .expect(200);
    });

    it('rejects a user with no organization membership', async () => {
      const { accessToken } = await registerUser(app);

      await request(app.getHttpServer())
        .get('/api/v1/organizations/current')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(403);
    });

    it('asks for a header when the user belongs to more than one organization', async () => {
      const fixture = await createOrganizationWithOwner(app);
      // Second organization created by the same, already-authenticated user.
      await request(app.getHttpServer())
        .post('/api/v1/organizations')
        .set('Authorization', `Bearer ${fixture.accessToken}`)
        .send({ name: 'Second Org', countryCode: 'GB', baseCurrency: 'GBP' })
        .expect(201);

      await request(app.getHttpServer())
        .get('/api/v1/organizations/current')
        .set('Authorization', `Bearer ${fixture.accessToken}`)
        .expect(400);
    });
  });

  describe('PATCH /organizations/current/settings', () => {
    it("updates only the fields provided, leaving the rest untouched", async () => {
      const fixture = await createOrganizationWithOwner(app);

      const response = await request(app.getHttpServer())
        .patch('/api/v1/organizations/current/settings')
        .set('Authorization', `Bearer ${fixture.accessToken}`)
        .send({ invoiceNumberPrefix: 'INV-' })
        .expect(200);

      expect(response.body).toMatchObject({
        invoiceNumberPrefix: 'INV-',
        dateFormat: 'DD/MM/YYYY',
        taxInclusivePricing: false,
      });
    });

    it('rejects a spoofed organizationId/organization_id in the body', async () => {
      const fixtureA = await createOrganizationWithOwner(app);
      const fixtureB = await createOrganizationWithOwner(app);

      await request(app.getHttpServer())
        .patch('/api/v1/organizations/current/settings')
        .set('Authorization', `Bearer ${fixtureA.accessToken}`)
        .send({ invoiceNumberPrefix: 'INV-', organizationId: fixtureB.organizationId })
        .expect(400);

      await request(app.getHttpServer())
        .patch('/api/v1/organizations/current/settings')
        .set('Authorization', `Bearer ${fixtureA.accessToken}`)
        .send({ invoiceNumberPrefix: 'INV-', organization_id: fixtureB.organizationId })
        .expect(400);

      // And org A's own settings were untouched by the rejected attempts.
      const response = await request(app.getHttpServer())
        .get('/api/v1/organizations/current')
        .set('Authorization', `Bearer ${fixtureA.accessToken}`)
        .expect(200);
      expect(response.body.settings.invoiceNumberPrefix).toBe('');
    });
  });
});
