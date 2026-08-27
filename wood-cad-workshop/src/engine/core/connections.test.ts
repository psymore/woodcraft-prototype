import { describe, it, expect, beforeEach } from 'vitest'
import { registerComponent, clearRegistry } from '../registry/registry'
import { isConnectionCoincident, pruneStaleConnections } from './connections'
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

beforeEach(() => {
  clearRegistry()
  registerComponent(rodDefinition())
  registerComponent(footDefinition())
})

describe('isConnectionCoincident', () => {
  it('returns true when both connection points are within threshold', () => {
    const rod: ComponentInstance = {
      id: 'r1',
      componentDefinitionId: 'test_rod',
      position: [0, 0, 0],
      rotation: [0, 0, 0],
      dimensions: { diameter: 1, length: 10 },
      material: '#000',
    }
    const foot: ComponentInstance = {
      id: 'f1',
      componentDefinitionId: 'test_foot',
      position: [0, 0, 5],
      rotation: [0, 0, 0],
      dimensions: { thickness: 1, width: 1, length: 1 },
      material: '#000',
    }
    const connection: Connection = { id: 'c1', pieceAId: 'r1', pieceBId: 'f1', pointAIndex: 1, pointBIndex: 0 }
    expect(isConnectionCoincident(connection, [rod, foot], 3)).toBe(true)
  })

  it('returns false once the pieces have moved apart past threshold', () => {
    const rod: ComponentInstance = {
      id: 'r1',
      componentDefinitionId: 'test_rod',
      position: [0, 0, 0],
      rotation: [0, 0, 0],
      dimensions: { diameter: 1, length: 10 },
      material: '#000',
    }
    const foot: ComponentInstance = {
      id: 'f1',
      componentDefinitionId: 'test_foot',
      position: [0, 0, 100],
      rotation: [0, 0, 0],
      dimensions: { thickness: 1, width: 1, length: 1 },
      material: '#000',
    }
    const connection: Connection = { id: 'c1', pieceAId: 'r1', pieceBId: 'f1', pointAIndex: 1, pointBIndex: 0 }
    expect(isConnectionCoincident(connection, [rod, foot], 3)).toBe(false)
  })

  it('returns false if either piece referenced by the connection no longer exists', () => {
    const rod: ComponentInstance = {
      id: 'r1',
      componentDefinitionId: 'test_rod',
      position: [0, 0, 0],
      rotation: [0, 0, 0],
      dimensions: { diameter: 1, length: 10 },
      material: '#000',
    }
    const connection: Connection = { id: 'c1', pieceAId: 'r1', pieceBId: 'missing', pointAIndex: 1, pointBIndex: 0 }
    expect(isConnectionCoincident(connection, [rod], 3)).toBe(false)
  })

  it('is true exactly at the threshold boundary', () => {
    const rod: ComponentInstance = {
      id: 'r1',
      componentDefinitionId: 'test_rod',
      position: [0, 0, 0],
      rotation: [0, 0, 0],
      dimensions: { diameter: 1, length: 10 },
      material: '#000',
    }
    const foot: ComponentInstance = {
      id: 'f1',
      componentDefinitionId: 'test_foot',
      position: [0, 0, 8],
      rotation: [0, 0, 0],
      dimensions: { thickness: 1, width: 1, length: 1 },
      material: '#000',
    }
    // rod's far end (local z=+5) is at world z=5; foot's point is at world
    // z=8 — exactly 3 apart, the threshold boundary.
    const connection: Connection = { id: 'c1', pieceAId: 'r1', pieceBId: 'f1', pointAIndex: 1, pointBIndex: 0 }
    expect(isConnectionCoincident(connection, [rod, foot], 3)).toBe(true)
  })

  it('is false just past the threshold boundary', () => {
    const rod: ComponentInstance = {
      id: 'r1',
      componentDefinitionId: 'test_rod',
      position: [0, 0, 0],
      rotation: [0, 0, 0],
      dimensions: { diameter: 1, length: 10 },
      material: '#000',
    }
    const foot: ComponentInstance = {
      id: 'f1',
      componentDefinitionId: 'test_foot',
      position: [0, 0, 8.1],
      rotation: [0, 0, 0],
      dimensions: { thickness: 1, width: 1, length: 1 },
      material: '#000',
    }
    const connection: Connection = { id: 'c1', pieceAId: 'r1', pieceBId: 'f1', pointAIndex: 1, pointBIndex: 0 }
    expect(isConnectionCoincident(connection, [rod, foot], 3)).toBe(false)
  })
})

describe('pruneStaleConnections', () => {
  it('keeps coincident connections and drops stale ones', () => {
    const rod: ComponentInstance = {
      id: 'r1',
      componentDefinitionId: 'test_rod',
      position: [0, 0, 0],
      rotation: [0, 0, 0],
      dimensions: { diameter: 1, length: 10 },
      material: '#000',
    }
    const nearFoot: ComponentInstance = {
      id: 'f1',
      componentDefinitionId: 'test_foot',
      position: [0, 0, 5],
      rotation: [0, 0, 0],
      dimensions: { thickness: 1, width: 1, length: 1 },
      material: '#000',
    }
    const farFoot: ComponentInstance = {
      id: 'f2',
      componentDefinitionId: 'test_foot',
      position: [0, 0, 100],
      rotation: [0, 0, 0],
      dimensions: { thickness: 1, width: 1, length: 1 },
      material: '#000',
    }
    const coincident: Connection = { id: 'c1', pieceAId: 'r1', pieceBId: 'f1', pointAIndex: 1, pointBIndex: 0 }
    const stale: Connection = { id: 'c2', pieceAId: 'r1', pieceBId: 'f2', pointAIndex: 0, pointBIndex: 0 }
    const result = pruneStaleConnections([rod, nearFoot, farFoot], [coincident, stale], 3)
    expect(result).toEqual([coincident])
  })

  it('returns the same array reference when nothing is pruned', () => {
    const rod: ComponentInstance = {
      id: 'r1',
      componentDefinitionId: 'test_rod',
      position: [0, 0, 0],
      rotation: [0, 0, 0],
      dimensions: { diameter: 1, length: 10 },
      material: '#000',
    }
    const foot: ComponentInstance = {
      id: 'f1',
      componentDefinitionId: 'test_foot',
      position: [0, 0, 5],
      rotation: [0, 0, 0],
      dimensions: { thickness: 1, width: 1, length: 1 },
      material: '#000',
    }
    const connections: Connection[] = [{ id: 'c1', pieceAId: 'r1', pieceBId: 'f1', pointAIndex: 1, pointBIndex: 0 }]
    const result = pruneStaleConnections([rod, foot], connections, 3)
    expect(result).toBe(connections)
  })
})
