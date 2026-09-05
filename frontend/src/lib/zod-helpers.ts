import { z } from 'zod'

/**
 * Optional form fields default to '' (controlled inputs can't be
 * undefined), but the backend's class-validator DTOs use @IsOptional(),
 * which only skips undefined/null -- an untouched '' still hits the
 * field's own validator (e.g. @IsEmail()) and gets rejected. Transform ''
 * to undefined after the schema's own type/format check runs so a blank
 * optional field is actually sent as absent.
 *
 * Deliberately built with union+transform, not z.preprocess: preprocess
 * types its input as `unknown`, which breaks react-hook-form's
 * zodResolver<T> inference the moment this is one field among several
 * concretely-typed ones in the same object schema.
 *
 * The trailing `.optional()` (wrapping the whole transform, not just the
 * union) matters too -- without it, zod's object-shape inference sees a
 * ZodEffects node here, not a ZodOptional one, and infers the field as a
 * *required* key of type `string | undefined` instead of an optional key,
 * which zodResolver's generic then rejects as a mismatch against the
 * schema's own inferred FormValues type.
 */
export function optionalText() {
  return z
    .union([z.string(), z.literal('')])
    .optional()
    .transform((value) => (value === '' ? undefined : value))
    .optional()
}

export function optionalEmail(message = 'Enter a valid email address') {
  return z
    .union([z.string().email(message), z.literal('')])
    .optional()
    .transform((value) => (value === '' ? undefined : value))
    .optional()
}
