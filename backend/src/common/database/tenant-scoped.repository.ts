import {
  DeepPartial,
  EntityTarget,
  FindManyOptions,
  FindOneOptions,
  FindOptionsWhere,
  ObjectLiteral,
} from 'typeorm';
import { TenantContextStore } from '../tenant-context/tenant-context.store.js';

interface TenantScopedEntity extends ObjectLiteral {
  organizationId: string;
}

/**
 * Base repository for every table that carries an `organizationId` column.
 *
 * This is the application-layer half of the two-layer tenant isolation
 * described in CLAUDE.md: every read is filtered to, and every write is
 * stamped with, `TenantContextStore.organizationId` -- the value the
 * `OrganizationContextGuard` resolved and verified for this request, never
 * a value read directly off the request by this class. PostgreSQL RLS is
 * the second, database-enforced layer (see the migration for this table),
 * so even a bug here that forgot to scope a query would still be blocked
 * by the database itself.
 *
 * Subclasses must not accept or forward a caller-supplied organizationId --
 * that would defeat the whole point of this class.
 */
export abstract class TenantScopedRepository<T extends TenantScopedEntity> {
  protected constructor(
    private readonly entity: EntityTarget<T>,
    private readonly tenantContext: TenantContextStore,
  ) {}

  private get organizationId(): string {
    const organizationId = this.tenantContext.organizationId;
    if (!organizationId) {
      throw new Error(
        'No organization context is set for this request. Is OrganizationContextGuard applied to this route?',
      );
    }
    return organizationId;
  }

  private get repository() {
    return this.tenantContext.getRepository(this.entity);
  }

  async find(options?: FindManyOptions<T>): Promise<T[]> {
    return this.repository.find(this.scoped(options));
  }

  async findOne(options: FindOneOptions<T>): Promise<T | null> {
    return this.repository.findOne(this.scoped(options));
  }

  async create(input: Omit<DeepPartial<T>, 'organizationId'>): Promise<T> {
    const entity = this.repository.create({
      ...input,
      organizationId: this.organizationId,
    } as DeepPartial<T>);
    return this.repository.save(entity);
  }

  async save(entity: T): Promise<T> {
    if (entity.organizationId !== this.organizationId) {
      throw new Error(
        'Refusing to save an entity that belongs to a different organization',
      );
    }
    return this.repository.save(entity);
  }

  /**
   * Merges a partial update (e.g. a PATCH body, where unset fields must
   * mean "leave alone") onto an entity and saves it. Plain `Object.assign`
   * is the wrong tool here: an unset `@IsOptional()` field on a
   * `class-transformer`-built DTO is still an own property with value
   * `undefined` (TypeScript's class-fields semantics define every declared
   * field on construction), so `Object.assign` would overwrite it onto the
   * entity and TypeORM would then just silently skip that column in the
   * UPDATE -- not corrupting data, but making the entity this method
   * returns lie about the row's actual current values. `Repository#merge`
   * correctly ignores `undefined` source values.
   */
  async mergeAndSave(entity: T, partial: DeepPartial<T>): Promise<T> {
    const merged = this.repository.merge(entity, partial);
    return this.save(merged);
  }

  private scoped<O extends FindManyOptions<T> | FindOneOptions<T> | undefined>(
    options?: O,
  ): O {
    return {
      ...options,
      where: {
        ...(options?.where as FindOptionsWhere<T>),
        organizationId: this.organizationId,
      },
    } as O;
  }
}
