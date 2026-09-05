import { describe, expect, it } from 'vitest'
import { fromRateBasisPoints, toRateBasisPoints } from './schemas.ts'

describe('toRateBasisPoints', () => {
  it('converts a decimal percentage string to integer basis points', () => {
    expect(toRateBasisPoints('7.25')).toBe(725)
    expect(toRateBasisPoints('20')).toBe(2000)
    expect(toRateBasisPoints('0')).toBe(0)
  })

  it('rounds away floating-point noise', () => {
    expect(toRateBasisPoints('7.1')).toBe(710)
  })
})

describe('fromRateBasisPoints', () => {
  it('converts integer basis points back to a 2-decimal percentage string', () => {
    expect(fromRateBasisPoints(725)).toBe('7.25')
    expect(fromRateBasisPoints(2000)).toBe('20.00')
    expect(fromRateBasisPoints(0)).toBe('0.00')
  })
})
