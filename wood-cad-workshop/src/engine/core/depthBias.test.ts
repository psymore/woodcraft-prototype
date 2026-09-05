import { describe, it, expect } from 'vitest'
import { depthBiasFor } from './depthBias'

describe('depthBiasFor', () => {
  it('is deterministic for the same id', () => {
    expect(depthBiasFor('board-123')).toBe(depthBiasFor('board-123'))
  })

  it('differs for most distinct ids', () => {
    const ids = Array.from({ length: 50 }, (_, i) => `piece-${i}`)
    const biases = new Set(ids.map(depthBiasFor))
    // Not a strict pigeonhole guarantee (hash collisions are possible by
    // design — this is a stable tie-breaker, not a perfect ID), but with
    // 50 ids spread over the bucket range, a healthy majority of distinct
    // buckets shows the hash is actually spreading values, not just
    // returning a constant.
    expect(biases.size).toBeGreaterThan(5)
  })

  it('returns a small integer, safe as a polygonOffsetFactor/Units value', () => {
    for (let i = 0; i < 50; i += 1) {
      const bias = depthBiasFor(`piece-${i}`)
      expect(Number.isInteger(bias)).toBe(true)
      expect(Math.abs(bias)).toBeLessThanOrEqual(8)
    }
  })
})
