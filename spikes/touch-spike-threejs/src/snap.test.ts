import { describe, it, expect } from 'vitest'
import { snapValue } from './snap'

describe('snapValue', () => {
  it('rounds to the nearest increment', () => {
    expect(snapValue(1.3, 1.0)).toBe(1.0)
    expect(snapValue(1.6, 1.0)).toBe(2.0)
    expect(snapValue(4.3, 0.5)).toBe(4.5)
  })

  it('handles negative numbers', () => {
    expect(snapValue(-1.3, 1.0)).toBe(-1.0)
    expect(snapValue(-1.6, 1.0)).toBe(-2.0)
  })

  it('returns the value unchanged when increment is zero or negative', () => {
    expect(snapValue(3.14159, 0)).toBe(3.14159)
    expect(snapValue(3.14159, -1)).toBe(3.14159)
  })
})
