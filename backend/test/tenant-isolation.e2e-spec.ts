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

  /**
   * Every other test in this suite awaits one request at a time, so it
   * never actually exercises concurrency -- it would pass even if
   * `TenantContextStore` were a plain module-level variable instead of an
   * `AsyncLocalStorage`, as long as nothing else happened to be running
   * mid-await. This block fires genuinely interleaved requests (via
   * `Promise.all`, no `await` between dispatching them) so the two
   * requests' async contexts overlap on the event loop, and asserts each
   * one still resolves the correct organization -- proving the isolation
   * is per-async-context, not an artifact of tests running sequentially.
   */
  describe('Concurrent requests', () => {
    it('does not leak organization context between interleaved concurrent requests', async () => {
      await request(app.getHttpServer())
        .patch('/api/v1/organizations/current/settings')
        .set('Authorization', `Bearer ${orgA.accessToken}`)
        .send({ invoiceNumberPrefix: 'CONCURRENT-A-' })
        .expect(200);
      await request(app.getHttpServer())
        .patch('/api/v1/organizations/current/settings')
        .set('Authorization', `Bearer ${orgB.accessToken}`)
        .send({ invoiceNumberPrefix: 'CONCURRENT-B-' })
        .expect(200);

      const ROUNDS = 25;
      const inFlight = Array.from({ length: ROUNDS }, (_, i) => {
        const fixture = i % 2 === 0 ? orgA : orgB;
        return request(app.getHttpServer())
          .get('/api/v1/organizations/current')
          .set('Authorization', `Bearer ${fixture.accessToken}`)
          .then((response) => ({ fixture, response }));
      });

      // No await above: every request is dispatched before any of them
      // resolve, so their handling genuinely overlaps.
      const results = await Promise.all(inFlight);

      for (const { fixture, response } of results) {
        expect(response.status).toBe(200);
        expect(response.body.id).toBe(fixture.organizationId);
        expect(response.body.settings.invoiceNumberPrefix).toBe(
          fixture === orgA ? 'CONCURRENT-A-' : 'CONCURRENT-B-',
        );
      }
    });
  });
});
