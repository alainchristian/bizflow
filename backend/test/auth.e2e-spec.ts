import { randomUUID } from 'node:crypto';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module.js';

function uniqueEmail(): string {
  return `${randomUUID()}@example.com`;
}

describe('Auth (e2e)', () => {
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

  describe('POST /auth/register', () => {
    it('registers a new user and returns tokens', async () => {
      const email = uniqueEmail();

      const response = await request(app.getHttpServer())
        .post('/api/v1/auth/register')
        .send({ email, password: 'super-secret-1', fullName: 'Jane Doe' })
        .expect(201);

      expect(response.body.user).toMatchObject({ email, fullName: 'Jane Doe' });
      expect(response.body.user).not.toHaveProperty('passwordHash');
      expect(response.body.accessToken).toEqual(expect.any(String));
      expect(response.body.refreshToken).toEqual(expect.any(String));
    });

    it('rejects a duplicate email', async () => {
      const email = uniqueEmail();
      await request(app.getHttpServer())
        .post('/api/v1/auth/register')
        .send({ email, password: 'super-secret-1', fullName: 'Jane Doe' })
        .expect(201);

      await request(app.getHttpServer())
        .post('/api/v1/auth/register')
        .send({ email, password: 'a-different-password', fullName: 'Jane D.' })
        .expect(409);
    });

    it('rejects an invalid payload', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/auth/register')
        .send({ email: 'not-an-email', password: 'short', fullName: '' })
        .expect(400);
    });
  });

  describe('POST /auth/login', () => {
    it('logs in with correct credentials', async () => {
      const email = uniqueEmail();
      await request(app.getHttpServer())
        .post('/api/v1/auth/register')
        .send({ email, password: 'super-secret-1', fullName: 'Jane Doe' })
        .expect(201);

      const response = await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({ email, password: 'super-secret-1' })
        .expect(200);

      expect(response.body.user).toMatchObject({ email });
      expect(response.body.accessToken).toEqual(expect.any(String));
    });

    it('rejects an incorrect password', async () => {
      const email = uniqueEmail();
      await request(app.getHttpServer())
        .post('/api/v1/auth/register')
        .send({ email, password: 'super-secret-1', fullName: 'Jane Doe' })
        .expect(201);

      await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({ email, password: 'wrong-password' })
        .expect(401);
    });

    it('rejects an unknown email', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({ email: uniqueEmail(), password: 'whatever-1' })
        .expect(401);
    });
  });

  describe('GET /auth/me (protected route)', () => {
    it('rejects a request with no token', async () => {
      await request(app.getHttpServer())
        .get('/api/v1/auth/me')
        .expect(401);
    });

    it('rejects a request with a garbage token', async () => {
      await request(app.getHttpServer())
        .get('/api/v1/auth/me')
        .set('Authorization', 'Bearer not-a-real-token')
        .expect(401);
    });

    it('returns the current user for a valid access token', async () => {
      const email = uniqueEmail();
      const register = await request(app.getHttpServer())
        .post('/api/v1/auth/register')
        .send({ email, password: 'super-secret-1', fullName: 'Jane Doe' })
        .expect(201);

      const response = await request(app.getHttpServer())
        .get('/api/v1/auth/me')
        .set('Authorization', `Bearer ${register.body.accessToken}`)
        .expect(200);

      expect(response.body).toMatchObject({ email, fullName: 'Jane Doe' });
    });
  });

  describe('POST /auth/refresh', () => {
    it('issues a new token pair for a valid refresh token', async () => {
      const email = uniqueEmail();
      const register = await request(app.getHttpServer())
        .post('/api/v1/auth/register')
        .send({ email, password: 'super-secret-1', fullName: 'Jane Doe' })
        .expect(201);

      const response = await request(app.getHttpServer())
        .post('/api/v1/auth/refresh')
        .send({ refreshToken: register.body.refreshToken })
        .expect(200);

      expect(response.body.user).toMatchObject({ email });
      expect(response.body.accessToken).toEqual(expect.any(String));
    });

    it('rejects an invalid refresh token', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/auth/refresh')
        .send({ refreshToken: 'not-a-real-token' })
        .expect(401);
    });

    it('rejects an access token presented as a refresh token', async () => {
      const email = uniqueEmail();
      const register = await request(app.getHttpServer())
        .post('/api/v1/auth/register')
        .send({ email, password: 'super-secret-1', fullName: 'Jane Doe' })
        .expect(201);

      await request(app.getHttpServer())
        .post('/api/v1/auth/refresh')
        .send({ refreshToken: register.body.accessToken })
        .expect(401);
    });
  });
});
