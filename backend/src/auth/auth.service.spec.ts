import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { User } from '../users/entities/user.entity.js';
import { UsersService } from '../users/users.service.js';
import { AuthService } from './auth.service.js';

const CONFIG: Record<string, string | number> = {
  JWT_ACCESS_SECRET: 'test-access-secret',
  JWT_REFRESH_SECRET: 'test-refresh-secret',
  JWT_ACCESS_EXPIRES_IN_SECONDS: 900,
  JWT_REFRESH_EXPIRES_IN_SECONDS: 604800,
};

function buildUser(overrides: Partial<User> = {}): User {
  return {
    id: 'user-1',
    email: 'jane@example.com',
    passwordHash: '',
    fullName: 'Jane Doe',
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

describe('AuthService', () => {
  let usersService: { findByEmail: ReturnType<typeof vi.fn>; findById: ReturnType<typeof vi.fn>; create: ReturnType<typeof vi.fn> };
  let authService: AuthService;

  beforeEach(() => {
    usersService = {
      findByEmail: vi.fn(),
      findById: vi.fn(),
      create: vi.fn(),
    };
    const configService = { get: (key: string) => CONFIG[key] } as ConfigService;
    const jwtService = new JwtService({});

    authService = new AuthService(
      usersService as unknown as UsersService,
      jwtService,
      configService,
    );
  });

  describe('register', () => {
    it('hashes the password rather than storing it in plaintext', async () => {
      usersService.findByEmail.mockResolvedValue(null);
      usersService.create.mockImplementation((input) =>
        Promise.resolve(buildUser(input)),
      );

      await authService.register({
        email: 'jane@example.com',
        password: 'super-secret-1',
        fullName: 'Jane Doe',
      });

      const [createInput] = usersService.create.mock.calls[0];
      expect(createInput.passwordHash).not.toBe('super-secret-1');
      await expect(
        bcrypt.compare('super-secret-1', createInput.passwordHash),
      ).resolves.toBe(true);
    });

    it('rejects registration when the email is already taken', async () => {
      usersService.findByEmail.mockResolvedValue(buildUser());

      await expect(
        authService.register({
          email: 'jane@example.com',
          password: 'super-secret-1',
          fullName: 'Jane Doe',
        }),
      ).rejects.toThrow('An account with this email already exists');
    });

    it('issues a valid access and refresh token pair', async () => {
      usersService.findByEmail.mockResolvedValue(null);
      usersService.create.mockImplementation((input) =>
        Promise.resolve(buildUser(input)),
      );

      const result = await authService.register({
        email: 'jane@example.com',
        password: 'super-secret-1',
        fullName: 'Jane Doe',
      });

      const jwtService = new JwtService({});
      const accessPayload = await jwtService.verifyAsync(result.accessToken, {
        secret: CONFIG.JWT_ACCESS_SECRET as string,
      });
      const refreshPayload = await jwtService.verifyAsync(
        result.refreshToken,
        { secret: CONFIG.JWT_REFRESH_SECRET as string },
      );

      expect(accessPayload).toMatchObject({ sub: 'user-1', email: 'jane@example.com' });
      expect(refreshPayload).toMatchObject({ sub: 'user-1', email: 'jane@example.com' });
    });
  });

  describe('login', () => {
    it('rejects an unknown email', async () => {
      usersService.findByEmail.mockResolvedValue(null);

      await expect(
        authService.login({ email: 'nobody@example.com', password: 'x' }),
      ).rejects.toThrow('Invalid email or password');
    });

    it('rejects an incorrect password', async () => {
      const passwordHash = await bcrypt.hash('correct-password', 10);
      usersService.findByEmail.mockResolvedValue(buildUser({ passwordHash }));

      await expect(
        authService.login({
          email: 'jane@example.com',
          password: 'wrong-password',
        }),
      ).rejects.toThrow('Invalid email or password');
    });

    it('logs in successfully with the correct password', async () => {
      const passwordHash = await bcrypt.hash('correct-password', 10);
      usersService.findByEmail.mockResolvedValue(buildUser({ passwordHash }));

      const result = await authService.login({
        email: 'jane@example.com',
        password: 'correct-password',
      });

      expect(result.user).toMatchObject({ email: 'jane@example.com' });
      expect(result.accessToken).toEqual(expect.any(String));
      expect(result.refreshToken).toEqual(expect.any(String));
    });
  });

  describe('refresh', () => {
    it('rejects a garbage refresh token', async () => {
      await expect(authService.refresh('not-a-token')).rejects.toThrow(
        'Invalid or expired refresh token',
      );
    });

    it('rejects an access token used as a refresh token', async () => {
      const jwtService = new JwtService({});
      const accessToken = await jwtService.signAsync(
        { sub: 'user-1', email: 'jane@example.com' },
        { secret: CONFIG.JWT_ACCESS_SECRET as string },
      );

      await expect(authService.refresh(accessToken)).rejects.toThrow(
        'Invalid or expired refresh token',
      );
    });

    it('issues a fresh token pair for a valid refresh token', async () => {
      const jwtService = new JwtService({});
      const refreshToken = await jwtService.signAsync(
        { sub: 'user-1', email: 'jane@example.com' },
        { secret: CONFIG.JWT_REFRESH_SECRET as string },
      );
      usersService.findById.mockResolvedValue(buildUser());

      const result = await authService.refresh(refreshToken);

      expect(result.user).toMatchObject({ id: 'user-1' });
      expect(result.accessToken).toEqual(expect.any(String));
    });

    it('rejects a refresh token for a user that no longer exists', async () => {
      const jwtService = new JwtService({});
      const refreshToken = await jwtService.signAsync(
        { sub: 'ghost', email: 'ghost@example.com' },
        { secret: CONFIG.JWT_REFRESH_SECRET as string },
      );
      usersService.findById.mockResolvedValue(null);

      await expect(authService.refresh(refreshToken)).rejects.toThrow(
        'Invalid or expired refresh token',
      );
    });
  });
});
