import { describe, it, expect, beforeEach } from 'vitest'
import { registerComponent, clearRegistry } from '../registry/registry'
import {
  getAnchors,
  toWorldAnchor,
  closestBetweenWorldAnchors,
  findClosestConnectionMatch,
  classifyAnchorPairKind,
} from './connectionPoints'
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

describe('getAnchors', () => {
  it('returns two lengthwise end points for a cylinder "ends" role, unaffected by this change', () => {
    const rod: ComponentInstance = {
      id: 'r1',
      componentDefinitionId: 'test_rod',
      position: [0, 0, 0],
      rotation: [0, 0, 0],
      dimensions: { diameter: 1, length: 10 },
      material: '#000',
    }
    expect(getAnchors(rod)).toEqual([
      { kind: 'point', point: [0, 0, -5] },
      { kind: 'point', point: [0, 0, 5] },
    ])
  })

  it('returns the center point for a "single" role', () => {
    const foot: ComponentInstance = {
      id: 'f1',
      componentDefinitionId: 'test_foot',
      position: [0, 0, 0],
      rotation: [0, 0, 0],
      dimensions: { thickness: 1, width: 1, length: 1 },
      material: '#000',
    }
    expect(getAnchors(foot)).toEqual([{ kind: 'point', point: [0, 0, 0] }])
  })

  it('returns 10 anchors (2 ends + 2 edge points + 2 edge segments + 4 side faces) for a box "ends" role', () => {
    const board: ComponentInstance = {
      id: 'b1',
      componentDefinitionId: 'test_board',
      position: [0, 0, 0],
      rotation: [0, 0, 0],
      dimensions: { thickness: 2, width: 4, length: 10 },
      material: '#000',
    }
    // thickness=2 -> hx=1, width=4 -> hy=2, length=10 -> hz=5
    expect(getAnchors(board)).toEqual([
      { kind: 'point', point: [0, 0, -5] },
      { kind: 'point', point: [0, 0, 5] },
      { kind: 'point', point: [0, -2, 0] },
      { kind: 'point', point: [0, 2, 0] },
      { kind: 'segment', a: [0, -2, -5], b: [0, -2, 5] },
      { kind: 'segment', a: [0, 2, -5], b: [0, 2, 5] },
      { kind: 'face', center: [0, -2, 0], uAxis: [1, 0, 0], vAxis: [0, 0, 1], halfU: 1, halfV: 5 },
      { kind: 'face', center: [0, 2, 0], uAxis: [1, 0, 0], vAxis: [0, 0, 1], halfU: 1, halfV: 5 },
      { kind: 'face', center: [-1, 0, 0], uAxis: [0, 1, 0], vAxis: [0, 0, 1], halfU: 2, halfV: 5 },
      { kind: 'face', center: [1, 0, 0], uAxis: [0, 1, 0], vAxis: [0, 0, 1], halfU: 2, halfV: 5 },
    ])
  })
})

describe('toWorldAnchor', () => {
  it('applies position and yaw rotation to a point anchor', () => {
    const instance: ComponentInstance = {
      id: 'r1',
      componentDefinitionId: 'test_rod',
      position: [5, 0, 5],
      rotation: [0, Math.PI / 2, 0],
      dimensions: { diameter: 1, length: 10 },
      material: '#000',
    }
    const world = toWorldAnchor(instance, { kind: 'point', point: [0, 0, 5] })
    if (world.kind !== 'point') throw new Error('expected point')
    expect(world.point[0]).toBeCloseTo(10)
    expect(world.point[1]).toBeCloseTo(0)
    expect(world.point[2]).toBeCloseTo(5)
  })

  it('applies pitch (X-axis) rotation to a point anchor', () => {
    const instance: ComponentInstance = {
      id: 'r1',
      componentDefinitionId: 'test_rod',
      position: [0, 0, 0],
      rotation: [Math.PI / 2, 0, 0],
      dimensions: { diameter: 1, length: 10 },
      material: '#000',
    }
    const world = toWorldAnchor(instance, { kind: 'point', point: [0, 0, 5] })
    if (world.kind !== 'point') throw new Error('expected point')
    expect(world.point[0]).toBeCloseTo(0)
    expect(world.point[1]).toBeCloseTo(-5)
    expect(world.point[2]).toBeCloseTo(0)
  })

  it('rotates a face anchor\'s in-plane axes without translating them, and translates its center', () => {
    const instance: ComponentInstance = {
      id: 'b1',
      componentDefinitionId: 'test_board',
      position: [0, 0, 0],
      rotation: [0, Math.PI / 2, 0],
      dimensions: { thickness: 2, width: 4, length: 10 },
      material: '#000',
    }
    const world = toWorldAnchor(instance, {
      kind: 'face',
      center: [0, 0, 0],
      uAxis: [1, 0, 0],
      vAxis: [0, 0, 1],
      halfU: 2,
      halfV: 3,
    })
    if (world.kind !== 'face') throw new Error('expected face')
    expect(world.center[0]).toBeCloseTo(0)
    expect(world.center[1]).toBeCloseTo(0)
    expect(world.center[2]).toBeCloseTo(0)
    expect(world.uAxis[0]).toBeCloseTo(0)
    expect(world.uAxis[1]).toBeCloseTo(0)
    expect(world.uAxis[2]).toBeCloseTo(-1)
    expect(world.vAxis[0]).toBeCloseTo(1)
    expect(world.vAxis[1]).toBeCloseTo(0)
    expect(world.vAxis[2]).toBeCloseTo(0)
    expect(world.halfU).toBe(2)
    expect(world.halfV).toBe(3)
  })
})

describe('closestBetweenWorldAnchors', () => {
  it('point-point: reports straight-line distance and both points unchanged', () => {
    const match = closestBetweenWorldAnchors(
      { kind: 'point', point: [0, 0, 0] },
      { kind: 'point', point: [0, 0, 3] },
    )
    expect(match.distance).toBeCloseTo(3)
    expect(match.pointA).toEqual([0, 0, 0])
    expect(match.pointB).toEqual([0, 0, 3])
    expect(match.paramA).toBeUndefined()
    expect(match.paramB).toBeUndefined()
  })

  it('point-segment: finds the interior closest point and reports t on the segment side', () => {
    const match = closestBetweenWorldAnchors(
      { kind: 'point', point: [0, 1, 5] },
      { kind: 'segment', a: [0, 0, 0], b: [0, 0, 10] },
    )
    expect(match.distance).toBeCloseTo(1)
    expect(match.pointA).toEqual([0, 1, 5])
    expect(match.pointB[2]).toBeCloseTo(5)
    expect(match.paramA).toBeUndefined()
    expect(match.paramB).toEqual({ t: 0.5 })
  })

  it('segment-point (mirror image): reports t on the segment (A) side', () => {
    const match = closestBetweenWorldAnchors(
      { kind: 'segment', a: [0, 0, 0], b: [0, 0, 10] },
      { kind: 'point', point: [0, 1, 5] },
    )
    expect(match.distance).toBeCloseTo(1)
    expect(match.pointA[2]).toBeCloseTo(5)
    expect(match.pointB).toEqual([0, 1, 5])
    expect(match.paramA).toEqual({ t: 0.5 })
    expect(match.paramB).toBeUndefined()
  })

  it('point-face: finds the interior closest point and reports u,v on the face side', () => {
    const match = closestBetweenWorldAnchors(
      { kind: 'point', point: [1, 3, 2] },
      { kind: 'face', center: [0, 0, 0], uAxis: [1, 0, 0], vAxis: [0, 0, 1], halfU: 2, halfV: 5 },
    )
    expect(match.distance).toBeCloseTo(3)
    expect(match.pointB).toEqual([1, 0, 2])
    expect(match.paramB).toEqual({ u: 1, v: 2 })
  })

  it('point-face: clamps to the face edge when the projection falls outside it', () => {
    const match = closestBetweenWorldAnchors(
      { kind: 'point', point: [5, 0, 2] },
      { kind: 'face', center: [0, 0, 0], uAxis: [1, 0, 0], vAxis: [0, 0, 1], halfU: 2, halfV: 5 },
    )
    expect(match.pointB).toEqual([2, 0, 2])
    expect(match.paramB).toEqual({ u: 2, v: 2 })
  })

  it('throws for segment-segment (unsupported this increment)', () => {
    expect(() =>
      closestBetweenWorldAnchors(
        { kind: 'segment', a: [0, 0, 0], b: [0, 0, 10] },
        { kind: 'segment', a: [1, 0, 0], b: [1, 0, 10] },
      ),
    ).toThrow()
  })

  it('throws for face-face (unsupported this increment)', () => {
    const face = { kind: 'face' as const, center: [0, 0, 0] as [number, number, number], uAxis: [1, 0, 0] as [number, number, number], vAxis: [0, 0, 1] as [number, number, number], halfU: 2, halfV: 5 }
    expect(() => closestBetweenWorldAnchors(face, face)).toThrow()
  })
})

describe('findClosestConnectionMatch', () => {
  it('reports which anchors matched, in addition to the delta', () => {
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
    // rod's far end (local z=+5) lands at world z=5.5 when proposed at
    // z=0.5 — 0.5 units from the foot's z=6 point, within SNAP_DISTANCE (0.7).
    const match = findClosestConnectionMatch(rod, [0, 0, 0.5], [foot])
    expect(match).not.toBeNull()
    expect(match!.otherId).toBe('f1')
    expect(match!.movingAnchorIndex).toBe(1) // rod's far end
    expect(match!.otherAnchorIndex).toBe(0) // foot's only anchor
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
    expect(findClosestConnectionMatch(rod, [0, 0, 0], [foot])).toBeNull()
  })

  it('excludes anchors already claimed by an existing connection', () => {
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
    const match = findClosestConnectionMatch(rod, [0, 0, 0.5], [foot], [{ pieceId: 'f1', anchorIndex: 0 }])
    expect(match).toBeNull()
  })

  it('excludes the moving piece\'s own anchor when already claimed', () => {
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
    const match = findClosestConnectionMatch(rod, [0, 0, 0.5], [foot], [{ pieceId: 'r1', anchorIndex: 1 }])
    expect(match).toBeNull()
  })
})

describe('classifyAnchorPairKind', () => {
  it('classifies a point-point pair', () => {
    expect(classifyAnchorPairKind('point', 'point')).toBe('point-point')
  })

  it('classifies a point-segment pair regardless of side order', () => {
    expect(classifyAnchorPairKind('point', 'segment')).toBe('point-segment')
    expect(classifyAnchorPairKind('segment', 'point')).toBe('point-segment')
  })

  it('classifies a point-face pair regardless of side order', () => {
    expect(classifyAnchorPairKind('point', 'face')).toBe('point-face')
    expect(classifyAnchorPairKind('face', 'point')).toBe('point-face')
  })

  it('throws for a pair with no point side (unsupported, mirrors closestBetweenWorldAnchors)', () => {
    expect(() => classifyAnchorPairKind('segment', 'segment')).toThrow()
    expect(() => classifyAnchorPairKind('face', 'face')).toThrow()
    expect(() => classifyAnchorPairKind('segment', 'face')).toThrow()
  })
})
