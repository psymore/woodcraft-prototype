import { describe, it, expect, beforeEach } from 'vitest'
import { registerComponent, clearRegistry } from '../registry/registry'
import { findConnectionSnapDelta, getConnectionPoints, toWorldPoint } from './connectionPoints'
import type { ComponentDefinition, ComponentInstance } from './types'

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

describe('getConnectionPoints', () => {
  it('returns two lengthwise ends for an "ends" role', () => {
    const rod: ComponentInstance = {
      id: 'r1',
      componentDefinitionId: 'test_rod',
      position: [0, 0, 0],
      rotation: [0, 0, 0],
      dimensions: { diameter: 1, length: 10 },
      material: '#000',
    }
    expect(getConnectionPoints(rod)).toEqual([
      [0, 0, -5],
      [0, 0, 5],
    ])
  })

  it('returns the center for a "single" role', () => {
    const foot: ComponentInstance = {
      id: 'f1',
      componentDefinitionId: 'test_foot',
      position: [0, 0, 0],
      rotation: [0, 0, 0],
      dimensions: { thickness: 1, width: 1, length: 1 },
      material: '#000',
    }
    expect(getConnectionPoints(foot)).toEqual([[0, 0, 0]])
  })
})

describe('toWorldPoint', () => {
  it('applies position and yaw rotation to a local point', () => {
    const instance: ComponentInstance = {
      id: 'r1',
      componentDefinitionId: 'test_rod',
      position: [5, 0, 5],
      rotation: [0, Math.PI / 2, 0],
      dimensions: { diameter: 1, length: 10 },
      material: '#000',
    }
    const world = toWorldPoint(instance, [0, 0, 5])
    expect(world[0]).toBeCloseTo(10)
    expect(world[1]).toBeCloseTo(0)
    expect(world[2]).toBeCloseTo(5)
  })
})

describe('findConnectionSnapDelta', () => {
  it('produces a delta that makes the closest connection points exactly coincide', () => {
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
      position: [0, 0, 6],
      rotation: [0, 0, 0],
      dimensions: { thickness: 1, width: 1, length: 1 },
      material: '#000',
    }

    // Rod's far end (local z=+5) lands at world z=5.5 when proposed at
    // z=0.5 — 0.5 units from the foot's z=6 point, comfortably inside the
    // snap threshold.
    const proposed: [number, number, number] = [0, 0, 0.5]
    const delta = findConnectionSnapDelta(rod, proposed, [foot])
    expect(delta).not.toBeNull()

    const snapped: [number, number, number] = [
      proposed[0] + delta![0],
      proposed[1] + delta![1],
      proposed[2] + delta![2],
    ]
    const snappedRod: ComponentInstance = { ...rod, position: snapped }
    const rodEnd = toWorldPoint(snappedRod, getConnectionPoints(snappedRod)[1])
    const footPoint = toWorldPoint(foot, getConnectionPoints(foot)[0])
    expect(rodEnd[0]).toBeCloseTo(footPoint[0])
    expect(rodEnd[1]).toBeCloseTo(footPoint[1])
    expect(rodEnd[2]).toBeCloseTo(footPoint[2])
  })

  it('returns null when nothing is within snap distance', () => {
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
    expect(findConnectionSnapDelta(rod, [0, 0, 0], [foot])).toBeNull()
  })
})
