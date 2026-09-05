import type { ValueTransformer } from 'typeorm';

/**
 * Every money amount in this codebase is integer minor units (see
 * CLAUDE.md: never floats for money), stored as `bigint` per the
 * blueprint's schema convention. TypeORM returns `bigint` columns as
 * strings by default -- a JS `number` can't safely represent every bigint
 * value -- but minor-unit amounts comfortably fit a JS number, so this
 * transformer converts back on read instead of forcing every money-column
 * read site to parse the string itself.
 */
export const bigintTransformer: ValueTransformer = {
  to: (value: number | null | undefined) => value,
  from: (value: string | null) => (value === null ? null : Number(value)),
};
