import { describe, it, expect, beforeEach } from 'vitest'
import { registerComponent, clearRegistry } from '../registry/registry'
import { computeInstanceBounds } from './framing'
import type { ComponentDefinition, ComponentInstance } from './types'

function boardDefinition(): ComponentDefinition {
  return {
    id: 'test_board',
    name: 'Test Board',
    category: 'WOOD',
    geometry: { shape: 'box' },
    defaultDimensions: { thickness: 2, width: 4, length: 10 },
    material: '#000',
    connectionRole: 'ends',
    structuralProperties: {},
    explodeDirection: null,
    defaultSpeciesId: null,
  }
}

function rodDefinition(): ComponentDefinition {
  return {
    id: 'test_rod',
    name: 'Test Rod',
    category: 'WOOD',
    geometry: { shape: 'cylinder' },
    defaultDimensions: { diameter: 4, length: 10 },
    material: '#000',
    connectionRole: 'ends',
    structuralProperties: {},
    explodeDirection: null,
    defaultSpeciesId: null,
  }
}

beforeEach(() => {
  clearRegistry()
  registerComponent(boardDefinition())
  registerComponent(rodDefinition())
})

describe('computeInstanceBounds', () => {
  it('returns a small default sphere at the origin for an empty scene', () => {
    expect(computeInstanceBounds([])).toEqual({ center: [0, 0, 0], radius: 10 })
  })

  it('computes a radius that reflects a single piece\'s actual size, not a fixed floor', () => {
    // thickness=2, width=4, length=10 -> half-extents [1,2,5].
    // Old point-only computeBounds gave radius=1 (the floor) for any
    // single piece, regardless of size — this is the exact bug this
    // function fixes.
    const board: ComponentInstance = {
      id: 'b1', componentDefinitionId: 'test_board', position: [0, 0, 0], rotation: [0, 0, 0],
      dimensions: { thickness: 2, width: 4, length: 10 }, material: '#000',
    }
    const result = computeInstanceBounds([board])
    expect(result.center[0]).toBeCloseTo(0)
    expect(result.center[1]).toBeCloseTo(0)
    expect(result.center[2]).toBeCloseTo(0)
    // half-diagonal of a 2x4x10 box = sqrt(2^2+4^2+10^2)/2 = sqrt(120)/2
    expect(result.radius).toBeCloseTo(Math.sqrt(120) / 2, 3)
  })

  it('centers on the piece\'s own position when translated away from the origin', () => {
    const board: ComponentInstance = {
      id: 'b1', componentDefinitionId: 'test_board', position: [5, -3, 2], rotation: [0, 0, 0],
      dimensions: { thickness: 2, width: 4, length: 10 }, material: '#000',
    }
    const result = computeInstanceBounds([board])
    expect(result.center[0]).toBeCloseTo(5)
    expect(result.center[1]).toBeCloseTo(-3)
    expect(result.center[2]).toBeCloseTo(2)
    expect(result.radius).toBeCloseTo(Math.sqrt(120) / 2, 3)
  })

  it('accounts for rotation — a 45-degree yaw genuinely enlarges the bounding radius', () => {
    // thickness=2, width=2, length=10 -> half-extents [1,1,5]. Unrotated,
    // half-diagonal = sqrt(1^2+1^2+5^2) = sqrt(27) ≈ 5.196. A 45-degree yaw tilts
    // the long axis partly into X, which — because the AABB must contain
    // the tilted box — genuinely grows the bounding radius to sqrt(37) ≈ 6.083.
    // An implementation that ignored rotation would incorrectly report
    // sqrt(27) ≈ 5.196 here instead of the correct ~6.083.
    const board: ComponentInstance = {
      id: 'b1', componentDefinitionId: 'test_board', position: [0, 0, 0], rotation: [0, Math.PI / 4, 0],
      dimensions: { thickness: 2, width: 2, length: 10 }, material: '#000',
    }
    const result = computeInstanceBounds([board])
    expect(result.radius).toBeCloseTo(Math.sqrt(37), 3)
  })

  it('computes a cylinder\'s bounds from its radius and length', () => {
    // diameter=4 (radius=2), length=10 (half=5) -> half-extents [2,2,5].
    // half-diagonal = sqrt(2^2+2^2+5^2) = sqrt(33) ≈ 5.745
    const rod: ComponentInstance = {
      id: 'r1', componentDefinitionId: 'test_rod', position: [0, 0, 0], rotation: [0, 0, 0],
      dimensions: { diameter: 4, length: 10 }, material: '#000',
    }
    const result = computeInstanceBounds([rod])
    expect(result.radius).toBeCloseTo(Math.sqrt(33), 3)
  })

  it('merges multiple pieces into one bounding sphere covering all of them', () => {
    const boardA: ComponentInstance = {
      id: 'a', componentDefinitionId: 'test_board', position: [-10, 0, 0], rotation: [0, 0, 0],
      dimensions: { thickness: 1, width: 1, length: 1 }, material: '#000',
    }
    const boardB: ComponentInstance = {
      id: 'b', componentDefinitionId: 'test_board', position: [10, 0, 0], rotation: [0, 0, 0],
      dimensions: { thickness: 1, width: 1, length: 1 }, material: '#000',
    }
    const result = computeInstanceBounds([boardA, boardB])
    expect(result.center[0]).toBeCloseTo(0)
    expect(result.center[1]).toBeCloseTo(0)
    expect(result.center[2]).toBeCloseTo(0)
    // merged AABB half-extents: x=10.5 (10 + half-thickness 0.5), y=0.5, z=0.5
    expect(result.radius).toBeCloseTo(Math.sqrt(21 * 21 + 1 + 1) / 2, 3)
  })
})
