import { describe, expect, it } from 'vitest'
import { optionalEmail, optionalText } from './zod-helpers.ts'

describe('optionalText', () => {
  it('treats an empty string as absent', () => {
    expect(optionalText().parse('')).toBeUndefined()
  })

  it('passes through a non-empty string', () => {
    expect(optionalText().parse('hello')).toBe('hello')
  })

  it('accepts undefined', () => {
    expect(optionalText().parse(undefined)).toBeUndefined()
  })
})

describe('optionalEmail', () => {
  it('treats an empty string as absent', () => {
    expect(optionalEmail().parse('')).toBeUndefined()
  })

  it('passes through a valid email', () => {
    expect(optionalEmail().parse('jane@example.com')).toBe('jane@example.com')
  })

  it('rejects an invalid, non-empty email', () => {
    expect(() => optionalEmail().parse('not-an-email')).toThrow()
  })
})
