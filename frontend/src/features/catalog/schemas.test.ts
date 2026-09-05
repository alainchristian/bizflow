import { describe, expect, it } from 'vitest'
import { fromPriceAmount, toPriceAmount } from './schemas.ts'

describe('toPriceAmount', () => {
  it('converts a decimal major-unit string to integer minor units', () => {
    expect(toPriceAmount('150.00')).toBe(15000)
    expect(toPriceAmount('9.99')).toBe(999)
    expect(toPriceAmount('0')).toBe(0)
  })

  it('rounds away floating-point noise', () => {
    expect(toPriceAmount('19.9')).toBe(1990)
  })
})

describe('fromPriceAmount', () => {
  it('converts integer minor units back to a 2-decimal string', () => {
    expect(fromPriceAmount(15000)).toBe('150.00')
    expect(fromPriceAmount(999)).toBe('9.99')
    expect(fromPriceAmount(0)).toBe('0.00')
  })
})
