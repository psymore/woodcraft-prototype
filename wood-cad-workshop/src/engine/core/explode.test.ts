import { describe, it, expect } from 'vitest'
import { computeCentroid, getExplodedPosition } from './explode'

describe('computeCentroid', () => {
  it('averages positions', () => {
    expect(
      computeCentroid([
        { id: 'a', componentDefinitionId: 'x', position: [0, 0, 0], rotation: [0, 0, 0], dimensions: {}, material: '#000' },
        { id: 'b', componentDefinitionId: 'x', position: [10, 0, 0], rotation: [0, 0, 0], dimensions: {}, material: '#000' },
      ]),
    ).toEqual([5, 0, 0])
  })

  it('returns the origin for an empty list', () => {
    expect(computeCentroid([])).toEqual([0, 0, 0])
  })
})

describe('getExplodedPosition', () => {
  it('leaves position unchanged at amount 0', () => {
    expect(getExplodedPosition([3, 0, 0], [0, 0, 0], 0)).toEqual([3, 0, 0])
  })

  it('moves away from the centroid, scaled by amount', () => {
    const [x] = getExplodedPosition([1, 0, 0], [0, 0, 0], 1)
    expect(x).toBeGreaterThan(1)
  })
})
