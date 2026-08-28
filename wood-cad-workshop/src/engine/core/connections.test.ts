import { describe, it, expect, beforeEach } from 'vitest'
import { registerComponent, clearRegistry } from '../registry/registry'
import {
  isConnectionCoincident,
  pruneStaleConnections,
  getConnectedPieceIds,
  findConnectionCandidates,
  isAnchorClaimable,
} from './connections'
import type { ComponentDefinition, ComponentInstance, Connection } from './types'

function rodDefinition(): ComponentDefinition {
  return {
    id: 'test_rod',
    name: 'Test Rod',
    category: 'WOOD',
    geometry: { shape: 'cylinder' },
    defaultDimensions: { diameter: 1, length: 10 },
    material: '#000',
    connectionRole: 'ends',
    structuralProperties: {},
    explodeDirection: null,
  }
}

function footDefinition(): ComponentDefinition {
  return {
    id: 'test_foot',
    name: 'Test Foot',
    category: 'WOOD',
    geometry: { shape: 'box' },
    defaultDimensions: { thickness: 1, width: 1, length: 1 },
    material: '#000',
    connectionRole: 'single',
    structuralProperties: {},
    explodeDirection: null,
  }
}

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
  }
}

beforeEach(() => {
  clearRegistry()
  registerComponent(rodDefinition())
  registerComponent(footDefinition())
  registerComponent(boardDefinition())
})

describe('isConnectionCoincident', () => {
  it('returns true when both anchors are within threshold', () => {
    const rod: ComponentInstance = {
      id: 'r1', componentDefinitionId: 'test_rod', position: [0, 0, 0], rotation: [0, 0, 0],
      dimensions: { diameter: 1, length: 10 }, material: '#000',
    }
    const foot: ComponentInstance = {
      id: 'f1', componentDefinitionId: 'test_foot', position: [0, 0, 5], rotation: [0, 0, 0],
      dimensions: { thickness: 1, width: 1, length: 1 }, material: '#000',
    }
    const connection: Connection = { id: 'c1', pieceAId: 'r1', pieceBId: 'f1', a: { anchorIndex: 1 }, b: { anchorIndex: 0 } }
    expect(isConnectionCoincident(connection, [rod, foot], 3)).toBe(true)
  })

  it('returns false once the pieces have moved apart past threshold', () => {
    const rod: ComponentInstance = {
      id: 'r1', componentDefinitionId: 'test_rod', position: [0, 0, 0], rotation: [0, 0, 0],
      dimensions: { diameter: 1, length: 10 }, material: '#000',
    }
    const foot: ComponentInstance = {
      id: 'f1', componentDefinitionId: 'test_foot', position: [0, 0, 100], rotation: [0, 0, 0],
      dimensions: { thickness: 1, width: 1, length: 1 }, material: '#000',
    }
    const connection: Connection = { id: 'c1', pieceAId: 'r1', pieceBId: 'f1', a: { anchorIndex: 1 }, b: { anchorIndex: 0 } }
    expect(isConnectionCoincident(connection, [rod, foot], 3)).toBe(false)
  })

  it('returns false if either piece referenced by the connection no longer exists', () => {
    const rod: ComponentInstance = {
      id: 'r1', componentDefinitionId: 'test_rod', position: [0, 0, 0], rotation: [0, 0, 0],
      dimensions: { diameter: 1, length: 10 }, material: '#000',
    }
    const connection: Connection = { id: 'c1', pieceAId: 'r1', pieceBId: 'missing', a: { anchorIndex: 1 }, b: { anchorIndex: 0 } }
    expect(isConnectionCoincident(connection, [rod], 3)).toBe(false)
  })

  it('is true exactly at the threshold boundary', () => {
    const rod: ComponentInstance = {
      id: 'r1', componentDefinitionId: 'test_rod', position: [0, 0, 0], rotation: [0, 0, 0],
      dimensions: { diameter: 1, length: 10 }, material: '#000',
    }
    const foot: ComponentInstance = {
      id: 'f1', componentDefinitionId: 'test_foot', position: [0, 0, 8], rotation: [0, 0, 0],
      dimensions: { thickness: 1, width: 1, length: 1 }, material: '#000',
    }
    // rod's far end (local z=+5) is at world z=5; foot's point is at world
    // z=8 — exactly 3 apart, the threshold boundary.
    const connection: Connection = { id: 'c1', pieceAId: 'r1', pieceBId: 'f1', a: { anchorIndex: 1 }, b: { anchorIndex: 0 } }
    expect(isConnectionCoincident(connection, [rod, foot], 3)).toBe(true)
  })

  it('is false just past the threshold boundary', () => {
    const rod: ComponentInstance = {
      id: 'r1', componentDefinitionId: 'test_rod', position: [0, 0, 0], rotation: [0, 0, 0],
      dimensions: { diameter: 1, length: 10 }, material: '#000',
    }
    const foot: ComponentInstance = {
      id: 'f1', componentDefinitionId: 'test_foot', position: [0, 0, 8.1], rotation: [0, 0, 0],
      dimensions: { thickness: 1, width: 1, length: 1 }, material: '#000',
    }
    const connection: Connection = { id: 'c1', pieceAId: 'r1', pieceBId: 'f1', a: { anchorIndex: 1 }, b: { anchorIndex: 0 } }
    expect(isConnectionCoincident(connection, [rod, foot], 3)).toBe(false)
  })

  it('re-evaluates a face-anchor param against the CURRENT face extents, so shrinking a piece prunes a stale contact', () => {
    // Board (thickness=2, width=4, length=10 -> hx=1, hy=2, hz=5) at the
    // origin. Anchor index 8 is its wide face at center=[-1,0,0],
    // uAxis=[0,1,0], vAxis=[0,0,1], halfU=hy=2, halfV=hz=5 (see Task 2's
    // getAnchors test). param {u:0, v:4.5} evaluates to world point
    // [-1, 0, 4.5] — near the face's far end (v close to halfV=5).
    const board: ComponentInstance = {
      id: 'b1', componentDefinitionId: 'test_board', position: [0, 0, 0], rotation: [0, 0, 0],
      dimensions: { thickness: 2, width: 4, length: 10 }, material: '#000',
    }
    // Rod's index-0 anchor (local z=-5) must land exactly on [-1,0,4.5]:
    // position.z = 4.5 - (-5) = 9.5.
    const rod: ComponentInstance = {
      id: 'r1', componentDefinitionId: 'test_rod', position: [-1, 0, 9.5], rotation: [0, 0, 0],
      dimensions: { diameter: 1, length: 10 }, material: '#000',
    }
    const connection: Connection = {
      id: 'c1', pieceAId: 'b1', pieceBId: 'r1',
      a: { anchorIndex: 8, param: { u: 0, v: 4.5 } }, b: { anchorIndex: 0 },
    }
    expect(isConnectionCoincident(connection, [board, rod], 0.7)).toBe(true)

    // Shrink the board's LENGTH (10 -> 6), so halfV (= hz, derived from
    // length) drops from 5 to 3 — below the stored v=4.5, forcing a
    // clamp to v=3 and a world point of [-1,0,3], now 1.5 units from the
    // rod's fixed anchor at [-1,0,4.5] — past the 0.7 threshold.
    const shrunkBoard: ComponentInstance = { ...board, dimensions: { thickness: 2, width: 4, length: 6 } }
    expect(isConnectionCoincident(connection, [shrunkBoard, rod], 0.7)).toBe(false)
  })
})

describe('pruneStaleConnections', () => {
  it('keeps coincident connections and drops stale ones', () => {
    const rod: ComponentInstance = {
      id: 'r1', componentDefinitionId: 'test_rod', position: [0, 0, 0], rotation: [0, 0, 0],
      dimensions: { diameter: 1, length: 10 }, material: '#000',
    }
    const nearFoot: ComponentInstance = {
      id: 'f1', componentDefinitionId: 'test_foot', position: [0, 0, 5], rotation: [0, 0, 0],
      dimensions: { thickness: 1, width: 1, length: 1 }, material: '#000',
    }
    const farFoot: ComponentInstance = {
      id: 'f2', componentDefinitionId: 'test_foot', position: [0, 0, 100], rotation: [0, 0, 0],
      dimensions: { thickness: 1, width: 1, length: 1 }, material: '#000',
    }
    const coincident: Connection = { id: 'c1', pieceAId: 'r1', pieceBId: 'f1', a: { anchorIndex: 1 }, b: { anchorIndex: 0 } }
    const stale: Connection = { id: 'c2', pieceAId: 'r1', pieceBId: 'f2', a: { anchorIndex: 0 }, b: { anchorIndex: 0 } }
    const result = pruneStaleConnections([rod, nearFoot, farFoot], [coincident, stale], 3)
    expect(result).toEqual([coincident])
  })

  it('returns the same array reference when nothing is pruned', () => {
    const rod: ComponentInstance = {
      id: 'r1', componentDefinitionId: 'test_rod', position: [0, 0, 0], rotation: [0, 0, 0],
      dimensions: { diameter: 1, length: 10 }, material: '#000',
    }
    const foot: ComponentInstance = {
      id: 'f1', componentDefinitionId: 'test_foot', position: [0, 0, 5], rotation: [0, 0, 0],
      dimensions: { thickness: 1, width: 1, length: 1 }, material: '#000',
    }
    const connections: Connection[] = [{ id: 'c1', pieceAId: 'r1', pieceBId: 'f1', a: { anchorIndex: 1 }, b: { anchorIndex: 0 } }]
    const result = pruneStaleConnections([rod, foot], connections, 3)
    expect(result).toBe(connections)
  })
})

describe('getConnectedPieceIds', () => {
  it('returns just the piece itself when it has no connections', () => {
    const connections: Connection[] = []
    expect(getConnectedPieceIds('a', connections)).toEqual(new Set(['a']))
  })

  it('includes a single directly connected piece', () => {
    const connections: Connection[] = [
      { id: 'c1', pieceAId: 'a', pieceBId: 'b', a: { anchorIndex: 0 }, b: { anchorIndex: 0 } },
    ]
    expect(getConnectedPieceIds('a', connections)).toEqual(new Set(['a', 'b']))
  })

  it('follows a transitive chain A-B-C-D starting from either end', () => {
    const connections: Connection[] = [
      { id: 'c1', pieceAId: 'a', pieceBId: 'b', a: { anchorIndex: 0 }, b: { anchorIndex: 0 } },
      { id: 'c2', pieceAId: 'b', pieceBId: 'c', a: { anchorIndex: 1 }, b: { anchorIndex: 0 } },
      { id: 'c3', pieceAId: 'c', pieceBId: 'd', a: { anchorIndex: 1 }, b: { anchorIndex: 0 } },
    ]
    expect(getConnectedPieceIds('a', connections)).toEqual(new Set(['a', 'b', 'c', 'd']))
    expect(getConnectedPieceIds('d', connections)).toEqual(new Set(['a', 'b', 'c', 'd']))
  })

  it('follows a branch — one piece connected to two others', () => {
    const connections: Connection[] = [
      { id: 'c1', pieceAId: 'bar', pieceBId: 'postLeft', a: { anchorIndex: 0 }, b: { anchorIndex: 0 } },
      { id: 'c2', pieceAId: 'bar', pieceBId: 'postRight', a: { anchorIndex: 1 }, b: { anchorIndex: 0 } },
    ]
    expect(getConnectedPieceIds('postLeft', connections)).toEqual(new Set(['bar', 'postLeft', 'postRight']))
  })

  it('terminates and returns the correct set when the graph has a cycle', () => {
    const connections: Connection[] = [
      { id: 'c1', pieceAId: 'a', pieceBId: 'b', a: { anchorIndex: 0 }, b: { anchorIndex: 0 } },
      { id: 'c2', pieceAId: 'b', pieceBId: 'c', a: { anchorIndex: 1 }, b: { anchorIndex: 0 } },
      { id: 'c3', pieceAId: 'c', pieceBId: 'a', a: { anchorIndex: 1 }, b: { anchorIndex: 1 } },
    ]
    expect(getConnectedPieceIds('a', connections)).toEqual(new Set(['a', 'b', 'c']))
  })

  it('does not include pieces from a disconnected component', () => {
    const connections: Connection[] = [
      { id: 'c1', pieceAId: 'a', pieceBId: 'b', a: { anchorIndex: 0 }, b: { anchorIndex: 0 } },
      { id: 'c2', pieceAId: 'x', pieceBId: 'y', a: { anchorIndex: 0 }, b: { anchorIndex: 0 } },
    ]
    expect(getConnectedPieceIds('a', connections)).toEqual(new Set(['a', 'b']))
  })
})

describe('isAnchorClaimable', () => {
  it('is true for a point-kind anchor', () => {
    const rod: ComponentInstance = {
      id: 'r1', componentDefinitionId: 'test_rod', position: [0, 0, 0], rotation: [0, 0, 0],
      dimensions: { diameter: 1, length: 10 }, material: '#000',
    }
    expect(isAnchorClaimable([rod], 'r1', 0)).toBe(true)
  })

  it('is false for a segment or face anchor on a board', () => {
    const board: ComponentInstance = {
      id: 'b1', componentDefinitionId: 'test_board', position: [0, 0, 0], rotation: [0, 0, 0],
      dimensions: { thickness: 2, width: 4, length: 10 }, material: '#000',
    }
    expect(isAnchorClaimable([board], 'b1', 4)).toBe(false) // index 4: segment
    expect(isAnchorClaimable([board], 'b1', 6)).toBe(false) // index 6: face
  })

  it('is false when the piece does not exist', () => {
    expect(isAnchorClaimable([], 'missing', 0)).toBe(false)
  })
})

describe('findConnectionCandidates', () => {
  it('returns an empty array when no unclaimed anchors are within threshold', () => {
    const rod: ComponentInstance = {
      id: 'r1', componentDefinitionId: 'test_rod', position: [0, 0, 0], rotation: [0, 0, 0],
      dimensions: { diameter: 1, length: 10 }, material: '#000',
    }
    const foot: ComponentInstance = {
      id: 'f1', componentDefinitionId: 'test_foot', position: [0, 0, 100], rotation: [0, 0, 0],
      dimensions: { thickness: 1, width: 1, length: 1 }, material: '#000',
    }
    expect(findConnectionCandidates([rod, foot], [], 3)).toEqual([])
  })

  it('returns one candidate for one unclaimed pair within threshold', () => {
    const rod: ComponentInstance = {
      id: 'r1', componentDefinitionId: 'test_rod', position: [0, 0, 0], rotation: [0, 0, 0],
      dimensions: { diameter: 1, length: 10 }, material: '#000',
    }
    const foot: ComponentInstance = {
      id: 'f1', componentDefinitionId: 'test_foot', position: [0, 0, 5], rotation: [0, 0, 0],
      dimensions: { thickness: 1, width: 1, length: 1 }, material: '#000',
    }
    expect(findConnectionCandidates([rod, foot], [], 3)).toEqual([
      { pieceAId: 'r1', pieceBId: 'f1', a: { anchorIndex: 1 }, b: { anchorIndex: 0 } },
    ])
  })

  it('excludes a point-kind pair whose anchors are already claimed by an existing connection', () => {
    const rod: ComponentInstance = {
      id: 'r1', componentDefinitionId: 'test_rod', position: [0, 0, 0], rotation: [0, 0, 0],
      dimensions: { diameter: 1, length: 10 }, material: '#000',
    }
    const foot: ComponentInstance = {
      id: 'f1', componentDefinitionId: 'test_foot', position: [0, 0, 5], rotation: [0, 0, 0],
      dimensions: { thickness: 1, width: 1, length: 1 }, material: '#000',
    }
    const existing: Connection = { id: 'c1', pieceAId: 'r1', pieceBId: 'f1', a: { anchorIndex: 1 }, b: { anchorIndex: 0 } }
    expect(findConnectionCandidates([rod, foot], [existing], 3)).toEqual([])
  })

  it('when a point is within range of two others, only the closer pairing becomes a candidate', () => {
    const rod: ComponentInstance = {
      id: 'r1', componentDefinitionId: 'test_rod', position: [0, 0, 0], rotation: [0, 0, 0],
      dimensions: { diameter: 1, length: 10 }, material: '#000',
    }
    const nearFoot: ComponentInstance = {
      id: 'f1', componentDefinitionId: 'test_foot', position: [0, 0, 5], rotation: [0, 0, 0],
      dimensions: { thickness: 1, width: 1, length: 1 }, material: '#000',
    }
    const fartherFoot: ComponentInstance = {
      id: 'f2', componentDefinitionId: 'test_foot', position: [0, 0, 6], rotation: [0, 0, 0],
      dimensions: { thickness: 1, width: 1, length: 1 }, material: '#000',
    }
    const result = findConnectionCandidates([rod, nearFoot, fartherFoot], [], 3)
    expect(result).toEqual([{ pieceAId: 'r1', pieceBId: 'f1', a: { anchorIndex: 1 }, b: { anchorIndex: 0 } }])
  })

  it('leaves the losing point in a 3-way tie free to pair with a different piece', () => {
    const r1: ComponentInstance = {
      id: 'r1', componentDefinitionId: 'test_rod', position: [0, 0, 0], rotation: [0, 0, 0],
      dimensions: { diameter: 1, length: 10 }, material: '#000',
    }
    const f1: ComponentInstance = {
      id: 'f1', componentDefinitionId: 'test_foot', position: [0, 0, 5], rotation: [0, 0, 0],
      dimensions: { thickness: 1, width: 1, length: 1 }, material: '#000',
    }
    const f2: ComponentInstance = {
      id: 'f2', componentDefinitionId: 'test_foot', position: [0, 0, 6], rotation: [0, 0, 0],
      dimensions: { thickness: 1, width: 1, length: 1 }, material: '#000',
    }
    const r2: ComponentInstance = {
      id: 'r2', componentDefinitionId: 'test_rod', position: [0, 0, 13], rotation: [0, 0, 0],
      dimensions: { diameter: 1, length: 10 }, material: '#000',
    }
    const result = findConnectionCandidates([r1, f1, f2, r2], [], 3)
    expect(result).toEqual([
      { pieceAId: 'r1', pieceBId: 'f1', a: { anchorIndex: 1 }, b: { anchorIndex: 0 } },
      { pieceAId: 'f2', pieceBId: 'r2', a: { anchorIndex: 0 }, b: { anchorIndex: 0 } },
    ])
  })

  it('lets a face anchor host two simultaneous candidates from two different pieces (multi-occupancy)', () => {
    // Board's wide face at x=-1 (anchor index 8) has center=[-1,0,0],
    // uAxis=[0,1,0], vAxis=[0,0,1], halfU=2, halfV=5 (see Task 2's
    // getAnchors test). Two unrotated rods, positioned so each one's
    // index-0 end (local z=-5) lands exactly on a different point of
    // that face — no rotation math involved, so the target world points
    // are just `position + [0,0,-5]`.
    const board: ComponentInstance = {
      id: 'b1', componentDefinitionId: 'test_board', position: [0, 0, 0], rotation: [0, 0, 0],
      dimensions: { thickness: 2, width: 4, length: 10 }, material: '#000',
    }
    // Target world point [-1,0,-2.5] -> position.z = -2.5 - (-5) = 2.5.
    const rodA: ComponentInstance = {
      id: 'ra', componentDefinitionId: 'test_rod', position: [-1, 0, 2.5], rotation: [0, 0, 0],
      dimensions: { diameter: 1, length: 10 }, material: '#000',
    }
    // Target world point [-1,0,2.5] -> position.z = 2.5 - (-5) = 7.5.
    const rodB: ComponentInstance = {
      id: 'rb', componentDefinitionId: 'test_rod', position: [-1, 0, 7.5], rotation: [0, 0, 0],
      dimensions: { diameter: 1, length: 10 }, material: '#000',
    }
    const result = findConnectionCandidates([board, rodA, rodB], [], 0.7)
    const boardFaceCandidates = result.filter((c) => c.pieceAId === 'b1' || c.pieceBId === 'b1')
    expect(boardFaceCandidates.length).toBe(2)
  })

  it('an already-confirmed face connection does not block a second, different candidate on the same face', () => {
    const board: ComponentInstance = {
      id: 'b1', componentDefinitionId: 'test_board', position: [0, 0, 0], rotation: [0, 0, 0],
      dimensions: { thickness: 2, width: 4, length: 10 }, material: '#000',
    }
    const rodA: ComponentInstance = {
      id: 'ra', componentDefinitionId: 'test_rod', position: [-1, 0, 2.5], rotation: [0, 0, 0],
      dimensions: { diameter: 1, length: 10 }, material: '#000',
    }
    const rodB: ComponentInstance = {
      id: 'rb', componentDefinitionId: 'test_rod', position: [-1, 0, 7.5], rotation: [0, 0, 0],
      dimensions: { diameter: 1, length: 10 }, material: '#000',
    }
    const existing: Connection = {
      id: 'c1', pieceAId: 'b1', pieceBId: 'ra',
      a: { anchorIndex: 8, param: { u: 0, v: -2.5 } }, b: { anchorIndex: 0 },
    }
    const result = findConnectionCandidates([board, rodA, rodB], [existing], 0.7)
    expect(result.some((c) => c.pieceAId === 'rb' || c.pieceBId === 'rb')).toBe(true)
  })
})
