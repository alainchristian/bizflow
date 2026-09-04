import { beforeEach, describe, expect, it, vi } from 'vitest';
import { TenantScopedRepository } from './tenant-scoped.repository.js';

interface TestEntity {
  id: string;
  organizationId: string;
  name: string;
}

class TestRepository extends TenantScopedRepository<TestEntity> {
  constructor(tenantContext: { organizationId: string | null; getRepository: () => unknown }) {
    super({} as never, tenantContext as never);
  }
}

describe('TenantScopedRepository', () => {
  let fakeRepository: {
    find: ReturnType<typeof vi.fn>;
    findOne: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
    save: ReturnType<typeof vi.fn>;
    merge: ReturnType<typeof vi.fn>;
  };
  let tenantContext: { organizationId: string | null; getRepository: ReturnType<typeof vi.fn> };
  let repository: TestRepository;

  beforeEach(() => {
    fakeRepository = {
      find: vi.fn(),
      findOne: vi.fn(),
      create: vi.fn((input) => input),
      save: vi.fn((entity) => Promise.resolve(entity)),
      merge: vi.fn((entity, partial) => Object.assign(entity, partial)),
    };
    tenantContext = {
      organizationId: 'org-1',
      getRepository: vi.fn(() => fakeRepository),
    };
    repository = new TestRepository(tenantContext);
  });

  it('injects the current organizationId into find()', async () => {
    await repository.find({ where: { name: 'Acme' } as never });

    expect(fakeRepository.find).toHaveBeenCalledWith({
      where: { name: 'Acme', organizationId: 'org-1' },
    });
  });

  it('injects the current organizationId into findOne()', async () => {
    await repository.findOne({ where: {} });

    expect(fakeRepository.findOne).toHaveBeenCalledWith({
      where: { organizationId: 'org-1' },
    });
  });

  it('stamps the current organizationId on create(), ignoring any caller-supplied one', async () => {
    await repository.create({ name: 'Acme', organizationId: 'someone-elses-org' } as never);

    expect(fakeRepository.create).toHaveBeenCalledWith({
      name: 'Acme',
      organizationId: 'org-1',
    });
  });

  it('refuses to save an entity belonging to a different organization', async () => {
    await expect(
      repository.save({ id: '1', organizationId: 'org-2', name: 'Acme' }),
    ).rejects.toThrow('different organization');
    expect(fakeRepository.save).not.toHaveBeenCalled();
  });

  it('allows saving an entity that belongs to the current organization', async () => {
    await repository.save({ id: '1', organizationId: 'org-1', name: 'Acme' });
    expect(fakeRepository.save).toHaveBeenCalled();
  });

  it('mergeAndSave ignores undefined fields rather than clobbering them', async () => {
    const entity = { id: '1', organizationId: 'org-1', name: 'Acme' };
    fakeRepository.merge.mockImplementation((target, partial) => {
      for (const [key, value] of Object.entries(partial)) {
        if (value !== undefined) (target as never)[key as never] = value as never;
      }
      return target;
    });

    const result = await repository.mergeAndSave(entity, {
      name: 'New Name',
      id: undefined,
    } as never);

    expect(result).toMatchObject({ id: '1', organizationId: 'org-1', name: 'New Name' });
  });

  it('throws if no organization context is set', async () => {
    tenantContext.organizationId = null;

    await expect(repository.findOne({ where: {} })).rejects.toThrow(
      'No organization context is set',
    );
  });
});
