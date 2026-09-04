import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module.js';
import { expectTenantIsolation } from './utils/expect-tenant-isolation.js';
import { createOrganizationWithOwner, TenantFixture } from './utils/tenant-fixtures.js';

/**
 * The tenant-isolation test suite the build order calls for at Step 3: two
 * real organizations, seeded independently, and a proof that a user
 * authenticated for one can never reach the other's data -- on every
 * tenant-scoped endpoint that exists so far. As later modules (crm, sales,
 * invoicing, ...) add their own tenant-scoped endpoints, their own
 * `*.e2e-spec.ts` should add a case here (or a sibling file) calling
 * `expectTenantIsolation` the same way, rather than re-deriving this setup.
 */
describe('Tenant isolation (e2e)', () => {
  let app: INestApplication<App>;
  let orgA: TenantFixture;
  let orgB: TenantFixture;

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

    [orgA, orgB] = await Promise.all([
      createOrganizationWithOwner(app, { organizationName: 'Org A' }),
      createOrganizationWithOwner(app, { organizationName: 'Org B' }),
    ]);
  });

  afterAll(async () => {
    await app.close();
  });

  it('sanity check: the two seeded organizations are actually distinct', () => {
    expect(orgA.organizationId).not.toEqual(orgB.organizationId);
    expect(orgA.accessToken).not.toEqual(orgB.accessToken);
  });

  describe('GET /organizations/current', () => {
    it("refuses org A's user access to org B's data", async () => {
      await expectTenantIsolation(app, {
        method: 'get',
        path: '/api/v1/organizations/current',
        actingUser: orgA,
        foreignOrganizationId: orgB.organizationId,
      });
    });

    it("refuses org B's user access to org A's data", async () => {
      await expectTenantIsolation(app, {
        method: 'get',
        path: '/api/v1/organizations/current',
        actingUser: orgB,
        foreignOrganizationId: orgA.organizationId,
      });
    });

    it('sanity check: org A can still read its own data', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/organizations/current')
        .set('Authorization', `Bearer ${orgA.accessToken}`)
        .set('X-Organization-Id', orgA.organizationId)
        .expect(200);

      expect(response.body.id).toEqual(orgA.organizationId);
      expect(response.body.id).not.toEqual(orgB.organizationId);
    });
  });

  describe('PATCH /organizations/current/settings', () => {
    it("refuses org A's user write access to org B's settings", async () => {
      await expectTenantIsolation(app, {
        method: 'patch',
        path: '/api/v1/organizations/current/settings',
        actingUser: orgA,
        foreignOrganizationId: orgB.organizationId,
        body: { invoiceNumberPrefix: 'HACKED-' },
      });
    });

    it("org B's settings are unaffected by org A's attempt", async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/organizations/current')
        .set('Authorization', `Bearer ${orgB.accessToken}`)
        .expect(200);

      expect(response.body.settings.invoiceNumberPrefix).not.toBe('HACKED-');
    });
  });
});
