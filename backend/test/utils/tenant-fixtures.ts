import { randomUUID } from 'node:crypto';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';

export interface TenantFixture {
  email: string;
  accessToken: string;
  userId: string;
  organizationId: string;
  organizationName: string;
}

export interface TeammateFixture {
  email: string;
  accessToken: string;
  userId: string;
  membershipId: string;
  role: string;
}

/**
 * Registers a brand-new user and has them create a brand-new organization
 * (becoming its owner), returning everything a tenant-isolation test needs:
 * a real access token scoped to that one user, and the id of an org they
 * genuinely belong to.
 *
 * Every field can be overridden, but each call defaults to fresh random
 * values so tests can call this twice in the same run (e.g. once per side
 * of an isolation check) without colliding on the `users.email` unique
 * constraint.
 */
export async function createOrganizationWithOwner(
  app: INestApplication<App>,
  overrides: {
    fullName?: string;
    email?: string;
    password?: string;
    organizationName?: string;
    countryCode?: string;
    baseCurrency?: string;
  } = {},
): Promise<TenantFixture> {
  const unique = randomUUID();
  const email = overrides.email ?? `tenant-fixture-${unique}@example.com`;
  const password = overrides.password ?? 'super-secret-1';
  const fullName = overrides.fullName ?? 'Fixture User';
  const organizationName = overrides.organizationName ?? `Fixture Org ${unique}`;

  const registerResponse = await request(app.getHttpServer())
    .post('/api/v1/auth/register')
    .send({ email, password, fullName })
    .expect(201);

  const accessToken = registerResponse.body.accessToken as string;
  const userId = registerResponse.body.user.id as string;

  const organizationResponse = await request(app.getHttpServer())
    .post('/api/v1/organizations')
    .set('Authorization', `Bearer ${accessToken}`)
    .send({
      name: organizationName,
      countryCode: overrides.countryCode ?? 'US',
      baseCurrency: overrides.baseCurrency ?? 'USD',
    })
    .expect(201);

  return {
    email,
    accessToken,
    userId,
    organizationId: organizationResponse.body.id as string,
    organizationName,
  };
}

/**
 * Invites a brand-new user into `owner`'s organization with the given role
 * and immediately accepts on their behalf, returning that new teammate's
 * own access token -- the thing every permission-boundary test needs (a
 * real, non-owner member of the *same* organization, not just a member of
 * some other one).
 */
export async function inviteAndAcceptMember(
  app: INestApplication<App>,
  owner: TenantFixture,
  role: string,
  overrides: { email?: string; fullName?: string; password?: string } = {},
): Promise<TeammateFixture> {
  const unique = randomUUID();
  const email = overrides.email ?? `teammate-${unique}@example.com`;
  const password = overrides.password ?? 'super-secret-1';
  const fullName = overrides.fullName ?? 'Teammate User';

  const inviteResponse = await request(app.getHttpServer())
    .post('/api/v1/organizations/current/invitations')
    .set('Authorization', `Bearer ${owner.accessToken}`)
    .send({ email, role })
    .expect(201);

  const registerResponse = await request(app.getHttpServer())
    .post('/api/v1/auth/register')
    .send({ email, password, fullName })
    .expect(201);

  const accessToken = registerResponse.body.accessToken as string;
  const userId = registerResponse.body.user.id as string;

  const acceptResponse = await request(app.getHttpServer())
    .post(`/api/v1/invitations/${inviteResponse.body.id}/accept`)
    .set('Authorization', `Bearer ${accessToken}`)
    .expect(201);

  return {
    email,
    accessToken,
    userId,
    membershipId: acceptResponse.body.id as string,
    role,
  };
}
