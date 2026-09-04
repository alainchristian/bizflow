import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { expect } from 'vitest';
import { TenantFixture } from './tenant-fixtures.js';

type HttpMethod = 'get' | 'post' | 'patch' | 'put' | 'delete';

/**
 * The reusable tenant-isolation assertion: a user authenticated for one
 * organization must never be able to read or write another organization's
 * data on a tenant-scoped endpoint, even when they explicitly ask to by
 * naming the foreign org via the `X-Organization-Id` header (the only
 * realistic way a client could ever *try* to cross the boundary, since
 * nothing else in a request names an organization at all).
 *
 * Every future module's isolation test should call this once per
 * tenant-scoped endpoint it adds, rather than hand-rolling the same
 * request/assertion. Pass two organizations seeded by
 * `createOrganizationWithOwner` and this checks that `actingUser` (a member
 * of their own org, not `foreignOrganizationId`) is refused access -- a
 * 403 (their membership doesn't cover it) or 404 (the resource doesn't
 * "exist" from their vantage point) are both acceptable; anything else,
 * and especially a 2xx carrying real data, is the tenant-isolation bug
 * CLAUDE.md and the build order treat as CI-blocking.
 */
export async function expectTenantIsolation(
  app: INestApplication<App>,
  options: {
    method: HttpMethod;
    path: string;
    actingUser: TenantFixture;
    foreignOrganizationId: string;
    body?: object;
  },
): Promise<void> {
  const { method, path, actingUser, foreignOrganizationId, body } = options;

  const response = await request(app.getHttpServer())
    [method](path)
    .set('Authorization', `Bearer ${actingUser.accessToken}`)
    .set('X-Organization-Id', foreignOrganizationId)
    .send(body ?? {});

  expect(
    [403, 404],
    `expected ${method.toUpperCase()} ${path} to refuse a foreign organization with 403/404, got ${response.status} with body ${JSON.stringify(response.body)}`,
  ).toContain(response.status);
}
