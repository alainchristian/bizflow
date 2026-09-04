import { beforeEach, describe, expect, it, vi } from 'vitest';
import { UsersService } from './users.service.js';

describe('UsersService', () => {
  let repository: {
    findOne: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
    save: ReturnType<typeof vi.fn>;
  };
  let usersService: UsersService;

  beforeEach(() => {
    repository = {
      findOne: vi.fn(),
      create: vi.fn((input) => input),
      save: vi.fn((entity) => Promise.resolve({ id: 'user-1', ...entity })),
    };
    usersService = new UsersService(repository as never);
  });

  it('finds a user by email', async () => {
    repository.findOne.mockResolvedValue({ id: 'user-1' });

    const result = await usersService.findByEmail('jane@example.com');

    expect(repository.findOne).toHaveBeenCalledWith({
      where: { email: 'jane@example.com' },
    });
    expect(result).toEqual({ id: 'user-1' });
  });

  it('returns null when no user matches the email', async () => {
    repository.findOne.mockResolvedValue(null);

    const result = await usersService.findByEmail('nobody@example.com');

    expect(result).toBeNull();
  });

  it('creates and persists a new user', async () => {
    const input = {
      email: 'jane@example.com',
      passwordHash: 'hashed',
      fullName: 'Jane Doe',
    };

    const result = await usersService.create(input);

    expect(repository.create).toHaveBeenCalledWith(input);
    expect(repository.save).toHaveBeenCalled();
    expect(result).toMatchObject({ id: 'user-1', ...input });
  });
});
