# Connection Anchor Primitives Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Generalize the connection system's anchor model from "array of fixed points" to "array of typed anchor primitives" (point/segment/face), so pieces can join anywhere along an edge or face — not just at a handful of fixed positions — while keeping the whole system's cost and complexity in the "cheap closed-form geometry" tier (no CSG, no physics, no general convex-shape collision detection).

**Architecture:** A new pure module (`geometry.ts`) holds generic closest-point math (point-to-segment, point-to-rectangle). `connectionPoints.ts` becomes the domain layer: it generates each piece's local anchor primitives (`getAnchors`), transforms them to world space (`toWorldAnchor`), and matches any two world anchors via `closestBetweenWorldAnchors` (point-point, point-segment, point-face supported; segment-segment/face-face throw — out of scope this increment). `Connection`/`ConnectionCandidate` move from a bare point index to an `AnchorRef` carrying an optional locked-in parametric coordinate, so a rigid-group translation and the existing prune/coincidence checks keep working unchanged. `movePiece`'s drag-time snap and `confirmConnection`'s gap-closing translation are updated to source their delta from the new match shape; a new "only point-kind anchors are exclusive" rule lets a face/segment anchor host multiple simultaneous connections (e.g. several joists on one beam) while a piece's own end still only ever joins one thing.

**Tech Stack:** TypeScript, Zustand, React Three Fiber, Vitest (existing project stack — no new dependencies).

**Spec:** [docs/superpowers/specs/2026-08-29-connection-anchor-primitives-design.md](../specs/2026-08-29-connection-anchor-primitives-design.md)

## Global Constraints

- `geometry.ts` and `connectionPoints.ts` are `engine/core` pure functions — no `three` import, matching every existing function in `engine/core/*`.
- Segment-to-segment and face-to-face matching are explicitly OUT of scope this increment — `closestBetweenWorldAnchors` must throw a clear error for these pairs, never silently return null or a wrong result, so a future anchor-kind combination can't slip through unhandled.
- Only `point`-kind anchors are ever added to a "claimed"/exclude set (drag-time snap exclusion, `findConnectionCandidates`'s dedup, `confirmConnection`'s duplicate guard). `segment`/`face`-kind anchors are never claimed — this is what lets a beam's face host multiple simultaneous connections, per the user's explicit choice during design.
- Box `'ends'` pieces (`geometry.shape === 'box'`, decided structurally — never a hardcoded component-id list) get: 2 end points (unchanged), 2 discrete edge-center points (existing indices 2/3, needed because segment-segment matching is out of scope — two boards' edges can only glue via a point-vs-segment/point-vs-point path, so every box piece needs to offer a point at its own edge center), 2 edge `segment` anchors (the same two long edges, full length), and **4 `face` anchors** — all four side faces (both wide faces and both narrow faces), per the user's explicit choice.
- Cylinder (rod) anchors are completely unaffected by this plan — still exactly their 2 end points. `'single'`/`'none'`-role pieces (hardware) are unaffected too.
- `SNAP_DISTANCE = 0.7` (unchanged this plan).
- Pure `engine/core` functions get unit tests; Zustand store orchestration (`sceneSessionStore.ts`) does not, per this project's established convention — this plan reuses `movePiece`'s and `confirmConnection`'s already-tested translation mechanisms unchanged, so no new scoped exception is needed here.

---

### Task 1: Closest-point geometry primitives

**Files:**
- Modify: `wood-cad-workshop/src/engine/core/types.ts` (add `Vec3` type alias)
- Create: `wood-cad-workshop/src/engine/core/geometry.ts`
- Create: `wood-cad-workshop/src/engine/core/geometry.test.ts`

**Interfaces:**
- Consumes: nothing from other tasks.
- Produces: `export type Vec3 = [number, number, number]` (types.ts); `export function distance(a: Vec3, b: Vec3): number`, `export function closestPointOnSegment(p: Vec3, a: Vec3, b: Vec3): { point: Vec3; t: number }`, `export function closestPointOnRect(p: Vec3, center: Vec3, uAxis: Vec3, vAxis: Vec3, halfU: number, halfV: number): { point: Vec3; u: number; v: number }` (geometry.ts) — for Task 2 to consume.

- [x] **Step 1: Add `Vec3` to types.ts**

In `wood-cad-workshop/src/engine/core/types.ts`, add near the top (after the existing `ComponentCategory`/`GeometryDescriptor` type aliases):

```ts
export type Vec3 = [number, number, number]
```

- [x] **Step 2: Write the failing tests**

Create `wood-cad-workshop/src/engine/core/geometry.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { distance, closestPointOnSegment, closestPointOnRect } from './geometry'

describe('distance', () => {
  it('computes straight-line 3D distance', () => {
    expect(distance([0, 0, 0], [3, 4, 0])).toBeCloseTo(5)
  })
})

describe('closestPointOnSegment', () => {
  it('returns the perpendicular projection when it falls inside the segment', () => {
    const result = closestPointOnSegment([0, 1, 5], [0, 0, 0], [0, 0, 10])
    expect(result.point[0]).toBeCloseTo(0)
    expect(result.point[1]).toBeCloseTo(0)
    expect(result.point[2]).toBeCloseTo(5)
    expect(result.t).toBeCloseTo(0.5)
  })

  it('clamps to the start point when the projection falls before it', () => {
    const result = closestPointOnSegment([0, 1, -5], [0, 0, 0], [0, 0, 10])
    expect(result.point).toEqual([0, 0, 0])
    expect(result.t).toBe(0)
  })

  it('clamps to the end point when the projection falls past it', () => {
    const result = closestPointOnSegment([0, 1, 15], [0, 0, 0], [0, 0, 10])
    expect(result.point).toEqual([0, 0, 10])
    expect(result.t).toBe(1)
  })

  it('does not throw on a degenerate zero-length segment', () => {
    const result = closestPointOnSegment([5, 5, 5], [1, 1, 1], [1, 1, 1])
    expect(result.point).toEqual([1, 1, 1])
    expect(result.t).toBe(0)
  })
})

describe('closestPointOnRect', () => {
  const center: [number, number, number] = [0, 0, 0]
  const uAxis: [number, number, number] = [1, 0, 0]
  const vAxis: [number, number, number] = [0, 0, 1]

  it('returns the projected point when it falls inside both extents', () => {
    const result = closestPointOnRect([1, 3, 2], center, uAxis, vAxis, 2, 5)
    expect(result.point[0]).toBeCloseTo(1)
    expect(result.point[1]).toBeCloseTo(0)
    expect(result.point[2]).toBeCloseTo(2)
    expect(result.u).toBeCloseTo(1)
    expect(result.v).toBeCloseTo(2)
  })

  it('clamps on the u axis only when only u is out of range', () => {
    const result = closestPointOnRect([5, 0, 2], center, uAxis, vAxis, 2, 5)
    expect(result.point).toEqual([2, 0, 2])
    expect(result.u).toBe(2)
    expect(result.v).toBeCloseTo(2)
  })

  it('clamps on both axes when both are out of range', () => {
    const result = closestPointOnRect([10, 0, 10], center, uAxis, vAxis, 2, 5)
    expect(result.point).toEqual([2, 0, 5])
    expect(result.u).toBe(2)
    expect(result.v).toBe(5)
  })
})
```

- [x] **Step 3: Run tests to verify they fail**

Run: `cd wood-cad-workshop && npx vitest run src/engine/core/geometry.test.ts`
Expected: FAIL — `./geometry` module not found.

- [x] **Step 4: Implement `geometry.ts`**

Create `wood-cad-workshop/src/engine/core/geometry.ts`:

```ts
import type { Vec3 } from './types'

export function distance(a: Vec3, b: Vec3): number {
  const dx = b[0] - a[0]
  const dy = b[1] - a[1]
  const dz = b[2] - a[2]
  return Math.sqrt(dx * dx + dy * dy + dz * dz)
}

// Closest point on the finite segment [a, b] to p, via clamped
// projection: project p onto the segment's direction, clamp the
// parameter t to [0, 1]. Degenerate (zero-length) segments return `a`
// with t=0 rather than dividing by zero.
export function closestPointOnSegment(p: Vec3, a: Vec3, b: Vec3): { point: Vec3; t: number } {
  const abx = b[0] - a[0]
  const aby = b[1] - a[1]
  const abz = b[2] - a[2]
  const lenSq = abx * abx + aby * aby + abz * abz
  if (lenSq < 1e-12) return { point: a, t: 0 }

  const apx = p[0] - a[0]
  const apy = p[1] - a[1]
  const apz = p[2] - a[2]
  const rawT = (apx * abx + apy * aby + apz * abz) / lenSq
  const t = Math.max(0, Math.min(1, rawT))
  return { point: [a[0] + abx * t, a[1] + aby * t, a[2] + abz * t], t }
}

// Closest point on a finite rectangle to p: the rectangle is centered at
// `center`, spanning `[-halfU, halfU]` along `uAxis` and `[-halfV, halfV]`
// along `vAxis` (both assumed unit-length and orthogonal — true for this
// app's axis-aligned box faces). Same clamped-projection idea as
// closestPointOnSegment, applied independently on two axes instead of one.
export function closestPointOnRect(
  p: Vec3,
  center: Vec3,
  uAxis: Vec3,
  vAxis: Vec3,
  halfU: number,
  halfV: number,
): { point: Vec3; u: number; v: number } {
  const dx = p[0] - center[0]
  const dy = p[1] - center[1]
  const dz = p[2] - center[2]
  const rawU = dx * uAxis[0] + dy * uAxis[1] + dz * uAxis[2]
  const rawV = dx * vAxis[0] + dy * vAxis[1] + dz * vAxis[2]
  const u = Math.max(-halfU, Math.min(halfU, rawU))
  const v = Math.max(-halfV, Math.min(halfV, rawV))
  return {
    point: [
      center[0] + uAxis[0] * u + vAxis[0] * v,
      center[1] + uAxis[1] * u + vAxis[1] * v,
      center[2] + uAxis[2] * u + vAxis[2] * v,
    ],
    u,
    v,
  }
}
```

- [x] **Step 5: Run tests to verify they pass**

Run: `cd wood-cad-workshop && npx vitest run src/engine/core/geometry.test.ts`
Expected: PASS, all 8 cases.

- [x] **Step 6: Run the full check (tsc + full test suite)**

Run: `cd wood-cad-workshop && npx tsc -b && npx vitest run`
Expected: PASS, no type errors, all existing tests still green (this task only adds files, doesn't touch existing ones).

- [x] **Step 7: Commit**

```bash
git add wood-cad-workshop/src/engine/core/types.ts wood-cad-workshop/src/engine/core/geometry.ts wood-cad-workshop/src/engine/core/geometry.test.ts
git commit -m "feat: add closest-point geometry primitives (segment, rect)"
```

---

### Task 2: Anchor primitives and world-space matching

**Files:**
- Modify: `wood-cad-workshop/src/engine/core/connectionPoints.ts` (full rewrite)
- Modify: `wood-cad-workshop/src/engine/core/connectionPoints.test.ts` (full rewrite)

**Interfaces:**
- Consumes: `Vec3`, `distance`, `closestPointOnSegment`, `closestPointOnRect` from Task 1.
- Produces: `export type AnchorPrimitive = { kind: 'point'; point: Vec3 } | { kind: 'segment'; a: Vec3; b: Vec3 } | { kind: 'face'; center: Vec3; uAxis: Vec3; vAxis: Vec3; halfU: number; halfV: number }`, `export type WorldAnchor = AnchorPrimitive`, `export function getAnchors(instance: ComponentInstance): AnchorPrimitive[]`, `export function toWorldAnchor(instance: ComponentInstance, anchor: AnchorPrimitive): WorldAnchor`, `export function pointAtParam(anchor: WorldAnchor, param?: { t: number } | { u: number; v: number }): Vec3`, `export interface AnchorMatch { distance: number; pointA: Vec3; pointB: Vec3; paramA?: {t:number}|{u:number;v:number}; paramB?: {t:number}|{u:number;v:number} }`, `export function closestBetweenWorldAnchors(a: WorldAnchor, b: WorldAnchor): AnchorMatch`, `export interface ConnectionMatch { otherId: string; movingAnchorIndex: number; otherAnchorIndex: number; delta: Vec3; movingParam?: {t:number}|{u:number;v:number}; otherParam?: {t:number}|{u:number;v:number} }`, `export function findClosestConnectionMatch(movingInstance: ComponentInstance, proposedPosition: Vec3, allInstances: ComponentInstance[], excludeAnchors?: { pieceId: string; anchorIndex: number }[]): ConnectionMatch | null` — for Task 3 (`connections.ts`) and Task 4 (`sceneSessionStore.ts`) to consume.

This task fully replaces `connectionPoints.ts`'s old point-only API (`getConnectionPoints`, `toWorldPoint`, `findConnectionSnapDelta` — the last one was already dead code, unused outside its own tests, per a repo-wide grep confirming no other file imports it). `SNAP_DISTANCE` stays exactly as-is (still `0.7`, still exported from this file).

- [x] **Step 1: Write the failing tests**

Replace the full contents of `wood-cad-workshop/src/engine/core/connectionPoints.test.ts` with:

```ts
import { describe, it, expect, beforeEach } from 'vitest'
import { registerComponent, clearRegistry } from '../registry/registry'
import {
  getAnchors,
  toWorldAnchor,
  closestBetweenWorldAnchors,
  findClosestConnectionMatch,
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
```

- [x] **Step 2: Run tests to verify they fail**

Run: `cd wood-cad-workshop && npx vitest run src/engine/core/connectionPoints.test.ts`
Expected: FAIL — `getAnchors`, `toWorldAnchor`, `closestBetweenWorldAnchors` not exported / not defined.

- [x] **Step 3: Implement the full rewrite of `connectionPoints.ts`**

Replace the full contents of `wood-cad-workshop/src/engine/core/connectionPoints.ts` with:

```ts
import type { ComponentInstance, Vec3 } from './types'
import { getComponent } from '../registry/registry'
import { closestPointOnSegment, closestPointOnRect, distance } from './geometry'

export const SNAP_DISTANCE = 0.7

export type AnchorPrimitive =
  | { kind: 'point'; point: Vec3 }
  | { kind: 'segment'; a: Vec3; b: Vec3 }
  | { kind: 'face'; center: Vec3; uAxis: Vec3; vAxis: Vec3; halfU: number; halfV: number }

// World-space anchors have the exact same shape as local-space ones —
// only the coordinate values differ (translated/rotated).
export type WorldAnchor = AnchorPrimitive

// Local-space attach primitives for this piece's shape, before its
// position/rotation are applied. See ConnectionRole (core/types.ts) for
// what each role means.
//
// Box 'ends' pieces (board, squareBeam, verticalPost — decided
// structurally by geometry.shape === 'box', not a hardcoded component
// list) get, in order: the 2 existing end points (indices 0/1,
// unchanged); 2 discrete edge-center points (indices 2/3) — needed
// because segment-segment matching isn't supported this increment, so
// two boards' edges can only glue via a point-vs-point or point-vs-segment
// path, and every box piece needs to offer a point at its own edge
// center for that to work symmetrically; 2 edge segment anchors (indices
// 4/5, the same two edges as indices 2/3, but spanning their full length)
// — for a piece's end touching that edge off-center; 4 face anchors
// (indices 6-9, all four side faces) — for a piece's end touching
// anywhere on a wide or narrow face.
export function getAnchors(instance: ComponentInstance): AnchorPrimitive[] {
  const definition = getComponent(instance.componentDefinitionId)
  const { length } = instance.dimensions
  switch (definition.connectionRole) {
    case 'ends': {
      const hz = length / 2
      const anchors: AnchorPrimitive[] = [
        { kind: 'point', point: [0, 0, -hz] },
        { kind: 'point', point: [0, 0, hz] },
      ]
      if (definition.geometry.shape === 'box') {
        const { thickness, width } = instance.dimensions
        const hx = thickness / 2
        const hy = width / 2
        anchors.push(
          { kind: 'point', point: [0, -hy, 0] },
          { kind: 'point', point: [0, hy, 0] },
          { kind: 'segment', a: [0, -hy, -hz], b: [0, -hy, hz] },
          { kind: 'segment', a: [0, hy, -hz], b: [0, hy, hz] },
          { kind: 'face', center: [0, -hy, 0], uAxis: [1, 0, 0], vAxis: [0, 0, 1], halfU: hx, halfV: hz },
          { kind: 'face', center: [0, hy, 0], uAxis: [1, 0, 0], vAxis: [0, 0, 1], halfU: hx, halfV: hz },
          { kind: 'face', center: [-hx, 0, 0], uAxis: [0, 1, 0], vAxis: [0, 0, 1], halfU: hy, halfV: hz },
          { kind: 'face', center: [hx, 0, 0], uAxis: [0, 1, 0], vAxis: [0, 0, 1], halfU: hy, halfV: hz },
        )
      }
      return anchors
    }
    case 'single':
      return [{ kind: 'point', point: [0, 0, 0] }]
    default:
      return []
  }
}

// Full 3-axis rotation matrix for three.js's default Euler order 'XYZ'
// (matches THREE.Matrix4.makeRotationFromEuler exactly, so this stays in
// sync with how Piece.tsx renders `instance.rotation`). Rotates a
// direction vector only — no translation. Reduces to the previous
// yaw-only formula when rx = rz = 0.
function applyRotation(rotation: Vec3, local: Vec3): Vec3 {
  const [rx, ry, rz] = rotation
  const [lx, ly, lz] = local
  const c1 = Math.cos(rx)
  const s1 = Math.sin(rx)
  const c2 = Math.cos(ry)
  const s2 = Math.sin(ry)
  const c3 = Math.cos(rz)
  const s3 = Math.sin(rz)

  const m11 = c2 * c3
  const m12 = -c2 * s3
  const m13 = s2
  const m21 = c1 * s3 + s1 * s2 * c3
  const m22 = c1 * c3 - s1 * s2 * s3
  const m23 = -s1 * c2
  const m31 = s1 * s3 - c1 * s2 * c3
  const m32 = s1 * c3 + c1 * s2 * s3
  const m33 = c1 * c2

  return [m11 * lx + m12 * ly + m13 * lz, m21 * lx + m22 * ly + m23 * lz, m31 * lx + m32 * ly + m33 * lz]
}

function toWorldPoint(instance: ComponentInstance, local: Vec3): Vec3 {
  const r = applyRotation(instance.rotation, local)
  return [instance.position[0] + r[0], instance.position[1] + r[1], instance.position[2] + r[2]]
}

// Transforms a local-space anchor primitive into world space using the
// piece's current position/rotation. Points and segment/face origins
// translate + rotate; segment/face in-plane axes rotate only (they're
// directions, not positions).
export function toWorldAnchor(instance: ComponentInstance, anchor: AnchorPrimitive): WorldAnchor {
  switch (anchor.kind) {
    case 'point':
      return { kind: 'point', point: toWorldPoint(instance, anchor.point) }
    case 'segment':
      return { kind: 'segment', a: toWorldPoint(instance, anchor.a), b: toWorldPoint(instance, anchor.b) }
    case 'face':
      return {
        kind: 'face',
        center: toWorldPoint(instance, anchor.center),
        uAxis: applyRotation(instance.rotation, anchor.uAxis),
        vAxis: applyRotation(instance.rotation, anchor.vAxis),
        halfU: anchor.halfU,
        halfV: anchor.halfV,
      }
  }
}

// The material (piece-relative), not world, coordinate a Connection
// pins for a segment/face anchor — locked in once at confirm time, never
// re-derived. undefined for a point-kind anchor (which has nothing to
// parameterize).
export type AnchorParam = { t: number } | { u: number; v: number }

// Evaluates a world-space anchor at a stored param (re-clamped against
// the anchor's CURRENT extents — see isConnectionCoincident in
// connections.ts for why this doubles as a staleness detector for face
// params). Defaults to the anchor's own center/midpoint when no param is
// given (point anchors always ignore param; this only matters if a
// segment/face anchor is ever evaluated without one, which callers in
// this codebase never do).
export function pointAtParam(anchor: WorldAnchor, param?: AnchorParam): Vec3 {
  if (anchor.kind === 'point') return anchor.point
  if (anchor.kind === 'segment') {
    const t = Math.max(0, Math.min(1, param && 't' in param ? param.t : 0.5))
    return [anchor.a[0] + (anchor.b[0] - anchor.a[0]) * t, anchor.a[1] + (anchor.b[1] - anchor.a[1]) * t, anchor.a[2] + (anchor.b[2] - anchor.a[2]) * t]
  }
  const rawU = param && 'u' in param ? param.u : 0
  const rawV = param && 'v' in param ? param.v : 0
  const u = Math.max(-anchor.halfU, Math.min(anchor.halfU, rawU))
  const v = Math.max(-anchor.halfV, Math.min(anchor.halfV, rawV))
  return [
    anchor.center[0] + anchor.uAxis[0] * u + anchor.vAxis[0] * v,
    anchor.center[1] + anchor.uAxis[1] * u + anchor.vAxis[1] * v,
    anchor.center[2] + anchor.uAxis[2] * u + anchor.vAxis[2] * v,
  ]
}

export interface AnchorMatch {
  distance: number
  pointA: Vec3 // closest-approach point ON A's anchor, world space
  pointB: Vec3 // closest-approach point ON B's anchor, world space
  paramA?: AnchorParam // set iff A is segment/face
  paramB?: AnchorParam // set iff B is segment/face
}

// Closest-approach distance and points between two world-space anchors.
// point-point, point-segment, point-face (and their mirror images) are
// supported. segment-segment and face-face are NOT implemented this
// increment (see the design doc) — this throws rather than silently
// returning null or a wrong result, so a future anchor kind combination
// can't slip through unhandled. Callers must filter out
// non-point/non-point pairs before calling (see findClosestConnectionMatch
// and connections.ts's findConnectionCandidates for the filter).
export function closestBetweenWorldAnchors(a: WorldAnchor, b: WorldAnchor): AnchorMatch {
  if (a.kind === 'point' && b.kind === 'point') {
    return { distance: distance(a.point, b.point), pointA: a.point, pointB: b.point }
  }
  if (a.kind === 'point' && b.kind === 'segment') {
    const { point, t } = closestPointOnSegment(a.point, b.a, b.b)
    return { distance: distance(a.point, point), pointA: a.point, pointB: point, paramB: { t } }
  }
  if (a.kind === 'segment' && b.kind === 'point') {
    const { point, t } = closestPointOnSegment(b.point, a.a, a.b)
    return { distance: distance(point, b.point), pointA: point, pointB: b.point, paramA: { t } }
  }
  if (a.kind === 'point' && b.kind === 'face') {
    const { point, u, v } = closestPointOnRect(a.point, b.center, b.uAxis, b.vAxis, b.halfU, b.halfV)
    return { distance: distance(a.point, point), pointA: a.point, pointB: point, paramB: { u, v } }
  }
  if (a.kind === 'face' && b.kind === 'point') {
    const { point, u, v } = closestPointOnRect(b.point, a.center, a.uAxis, a.vAxis, a.halfU, a.halfV)
    return { distance: distance(point, b.point), pointA: point, pointB: b.point, paramA: { u, v } }
  }
  throw new Error(`closestBetweenWorldAnchors: unsupported anchor kind pair (${a.kind}, ${b.kind})`)
}

export interface ConnectionMatch {
  otherId: string
  movingAnchorIndex: number
  otherAnchorIndex: number
  delta: Vec3
  movingParam?: AnchorParam
  otherParam?: AnchorParam
}

// Given a piece mid-drag at `proposedPosition`, checks whether any of its
// anchors land close to another piece's anchor, and reports exactly which
// anchors matched (not just the resulting delta) so a caller can turn a
// match into a persisted Connection (see engine/core/connections.ts).
// `excludeAnchors` skips anchors already claimed by an existing
// connection (callers are expected to only ever pass point-kind anchor
// refs here — segment/face anchors are never claimed, see the design
// doc). Pairs where neither anchor is point-kind are skipped, since
// segment-segment/face-face matching isn't supported this increment.
export function findClosestConnectionMatch(
  movingInstance: ComponentInstance,
  proposedPosition: Vec3,
  allInstances: ComponentInstance[],
  excludeAnchors: { pieceId: string; anchorIndex: number }[] = [],
): ConnectionMatch | null {
  const isExcluded = (pieceId: string, anchorIndex: number) =>
    excludeAnchors.some((p) => p.pieceId === pieceId && p.anchorIndex === anchorIndex)

  const proposedInstance: ComponentInstance = { ...movingInstance, position: proposedPosition }
  const movingAnchors = getAnchors(proposedInstance)
  if (movingAnchors.length === 0) return null

  let best: (ConnectionMatch & { distance: number }) | null = null

  for (const other of allInstances) {
    if (other.id === movingInstance.id) continue
    const otherAnchors = getAnchors(other)
    if (otherAnchors.length === 0) continue

    for (let movingAnchorIndex = 0; movingAnchorIndex < movingAnchors.length; movingAnchorIndex++) {
      if (isExcluded(movingInstance.id, movingAnchorIndex)) continue
      const movingAnchor = movingAnchors[movingAnchorIndex]
      const worldMoving = toWorldAnchor(proposedInstance, movingAnchor)
      for (let otherAnchorIndex = 0; otherAnchorIndex < otherAnchors.length; otherAnchorIndex++) {
        if (isExcluded(other.id, otherAnchorIndex)) continue
        const otherAnchor = otherAnchors[otherAnchorIndex]
        if (movingAnchor.kind !== 'point' && otherAnchor.kind !== 'point') continue
        const worldOther = toWorldAnchor(other, otherAnchor)
        const match = closestBetweenWorldAnchors(worldMoving, worldOther)
        if (match.distance < SNAP_DISTANCE && (!best || match.distance < best.distance)) {
          best = {
            distance: match.distance,
            otherId: other.id,
            movingAnchorIndex,
            otherAnchorIndex,
            delta: [
              match.pointB[0] - match.pointA[0],
              match.pointB[1] - match.pointA[1],
              match.pointB[2] - match.pointA[2],
            ],
            movingParam: match.paramA,
            otherParam: match.paramB,
          }
        }
      }
    }
  }

  if (!best) return null
  return {
    otherId: best.otherId,
    movingAnchorIndex: best.movingAnchorIndex,
    otherAnchorIndex: best.otherAnchorIndex,
    delta: best.delta,
    movingParam: best.movingParam,
    otherParam: best.otherParam,
  }
}
```

- [x] **Step 4: Run tests to verify they pass**

Run: `cd wood-cad-workshop && npx vitest run src/engine/core/connectionPoints.test.ts`
Expected: PASS, all cases.

- [x] **Step 5: Run the full check (tsc + full test suite)**

Run: `cd wood-cad-workshop && npx tsc -b && npx vitest run`
Expected: FAIL at this point — `connections.ts`, `sceneSessionStore.ts`, and `ConnectionMarkers.tsx` still import the now-removed `getConnectionPoints`/`toWorldPoint` from this file. This is expected; Tasks 3-5 fix each of those files in turn. Confirm the ONLY failures are TypeScript errors in those three files (missing export errors), not anything inside `connectionPoints.ts`/`connectionPoints.test.ts`/`geometry.ts` themselves.

- [x] **Step 6: Commit**

```bash
git add wood-cad-workshop/src/engine/core/connectionPoints.ts wood-cad-workshop/src/engine/core/connectionPoints.test.ts
git commit -m "feat: generalize connection anchors from points to point/segment/face primitives"
```

---

### Task 3: `Connection`/`ConnectionCandidate` on `AnchorRef`, and the claimed-set rule

**Files:**
- Modify: `wood-cad-workshop/src/engine/core/types.ts`
- Modify: `wood-cad-workshop/src/engine/core/connections.ts` (full rewrite)
- Modify: `wood-cad-workshop/src/engine/core/connections.test.ts` (full rewrite)

**Interfaces:**
- Consumes: `getAnchors`, `toWorldAnchor`, `closestBetweenWorldAnchors`, `AnchorParam` from Task 2.
- Produces: `export interface AnchorRef { anchorIndex: number; param?: AnchorParam }` and updated `export interface Connection { id: string; pieceAId: string; pieceBId: string; a: AnchorRef; b: AnchorRef }` (types.ts); `export function isAnchorClaimable(instances: ComponentInstance[], pieceId: string, anchorIndex: number): boolean`, `export function isConnectionCoincident(...)`, `export function pruneStaleConnections(...)`, `export function getConnectedPieceIds(...)` (unchanged from today), `export type ConnectionCandidate = Omit<Connection, 'id'>`, `export function findConnectionCandidates(...)` (connections.ts) — for Task 4 (`sceneSessionStore.ts`) and Task 5 (`ConnectionMarkers.tsx`) to consume.

`getConnectedPieceIds` is untouched — it only ever reads `pieceAId`/`pieceBId` off a `Connection`, never anchor geometry, so it needs no changes at all (copy it forward verbatim from the current file).

- [x] **Step 1: Update `types.ts`**

In `wood-cad-workshop/src/engine/core/types.ts`, replace:

```ts
export interface Connection {
  id: string
  pieceAId: string
  pieceBId: string
  pointAIndex: number // index into getConnectionPoints(pieceA)
  pointBIndex: number // index into getConnectionPoints(pieceB)
}
```

with:

```ts
export interface AnchorRef {
  anchorIndex: number
  // Present only when the referenced anchor is 'segment' or 'face' — a
  // material, piece-relative coordinate locked in once at confirm time,
  // never re-derived as "wherever is currently closest." See
  // connectionPoints.ts's AnchorParam/AnchorMatch.
  param?: { t: number } | { u: number; v: number }
}

export interface Connection {
  id: string
  pieceAId: string
  pieceBId: string
  a: AnchorRef // anchor on pieceA — index into getAnchors(pieceA)
  b: AnchorRef // anchor on pieceB — index into getAnchors(pieceB)
}
```

- [x] **Step 2: Write the failing tests**

Replace the full contents of `wood-cad-workshop/src/engine/core/connections.test.ts` with:

```ts
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
```

- [x] **Step 3: Run tests to verify they fail**

Run: `cd wood-cad-workshop && npx vitest run src/engine/core/connections.test.ts`
Expected: FAIL — `isAnchorClaimable` not exported, and `Connection` literals using `a`/`b` fail against the OLD `connections.ts` (still expects `pointAIndex`/`pointBIndex` at this point since Step 1 already changed `types.ts`, but `connections.ts` hasn't been rewritten yet — this will be a TypeScript compile error, not a runtime assertion failure, which is the expected "fails for the right reason" state before Step 4).

- [x] **Step 4: Implement the full rewrite of `connections.ts`**

Replace the full contents of `wood-cad-workshop/src/engine/core/connections.ts` with:

```ts
import type { AnchorRef, ComponentInstance, Connection } from './types'
import { getAnchors, toWorldAnchor, closestBetweenWorldAnchors, pointAtParam } from './connectionPoints'

// The 4 fields both a persisted Connection and an unconfirmed
// ConnectionCandidate share — lets this function (and sceneSessionStore's
// confirmConnection) accept either without requiring a Connection's `id`.
type ConnectionLike = Pick<Connection, 'pieceAId' | 'pieceBId' | 'a' | 'b'>

// Whether a persisted Connection's two anchors are still within
// `threshold` of each other in world space — used to decide whether a
// connection survives after either of its pieces moves. Evaluated at
// each side's stored `param` (re-clamped against that anchor's CURRENT
// extents) — so if changeDimensions shrinks a piece's face out from
// under a stored contact point, this naturally returns false with no
// special-case staleness code.
export function isConnectionCoincident(
  connection: ConnectionLike,
  instances: ComponentInstance[],
  threshold: number,
): boolean {
  const pieceA = instances.find((i) => i.id === connection.pieceAId)
  const pieceB = instances.find((i) => i.id === connection.pieceBId)
  if (!pieceA || !pieceB) return false

  const anchorA = getAnchors(pieceA)[connection.a.anchorIndex]
  const anchorB = getAnchors(pieceB)[connection.b.anchorIndex]
  if (!anchorA || !anchorB) return false

  const worldA = toWorldAnchor(pieceA, anchorA)
  const worldB = toWorldAnchor(pieceB, anchorB)
  const pointA = pointAtParam(worldA, connection.a.param)
  const pointB = pointAtParam(worldB, connection.b.param)
  const dx = pointB[0] - pointA[0]
  const dy = pointB[1] - pointA[1]
  const dz = pointB[2] - pointA[2]
  // Deliberately <=, not <: creation uses a strict `<` so exact ties
  // don't matter there, but survival should err toward keeping a
  // connection at the exact boundary rather than flickering it in and
  // out — the two thresholds are allowed to differ.
  return Math.sqrt(dx * dx + dy * dy + dz * dz) <= threshold
}

// Drops any connection whose two anchors are no longer within `threshold`
// of each other — used after any action that can move a piece's anchors
// (dragging, rotating, resizing, standing up). Returns the original array
// reference when nothing was pruned, so callers that spread this into a
// new state object don't force an unnecessary re-render when nothing
// actually changed.
export function pruneStaleConnections(
  instances: ComponentInstance[],
  connections: Connection[],
  threshold: number,
): Connection[] {
  const surviving = connections.filter((c) => isConnectionCoincident(c, instances, threshold))
  return surviving.length === connections.length ? connections : surviving
}

// Breadth-first traversal of the connection graph (each Connection is an
// undirected edge between pieceAId and pieceBId), starting from pieceId.
// Returns the full connected component, including pieceId itself —
// visited-set-guarded so a cycle in the graph terminates normally.
// Unaffected by the anchor-primitive generalization: this only ever
// reads pieceAId/pieceBId, never anchor geometry.
export function getConnectedPieceIds(pieceId: string, connections: Connection[]): Set<string> {
  const visited = new Set<string>([pieceId])
  const queue = [pieceId]

  for (let head = 0; head < queue.length; head++) {
    const current = queue[head]
    for (const c of connections) {
      let neighbor: string | null = null
      if (c.pieceAId === current) neighbor = c.pieceBId
      else if (c.pieceBId === current) neighbor = c.pieceAId
      if (neighbor !== null && !visited.has(neighbor)) {
        visited.add(neighbor)
        queue.push(neighbor)
      }
    }
  }

  return visited
}

// Whether a given anchor on a piece is "claimable" — i.e. should ever be
// added to a claimed/exclude set. Only point-kind anchors are: a board's
// own end can only ever touch one thing, but a segment/face anchor is an
// inherently multi-occupancy surface (e.g. several joists resting on one
// beam) and is never marked claimed. Shared by findConnectionCandidates
// below and sceneSessionStore.ts's movePiece/confirmConnection, so the
// two never drift apart on this rule.
export function isAnchorClaimable(instances: ComponentInstance[], pieceId: string, anchorIndex: number): boolean {
  const piece = instances.find((i) => i.id === pieceId)
  if (!piece) return false
  return getAnchors(piece)[anchorIndex]?.kind === 'point'
}

export type ConnectionCandidate = Omit<Connection, 'id'>

// Scene-wide version of connectionPoints.ts's findClosestConnectionMatch
// (which is anchored to one "moving" piece): finds every pair of
// currently-available, compatible anchors within `threshold` of each
// other, anywhere in the scene. "Available" means not claimed by an
// existing connection (point-kind anchors only — see isAnchorClaimable);
// segment/face anchors are always available, so a face can host several
// simultaneous candidates. Among point-kind anchors, "closest pairing
// wins" still applies within a single call: if a free point is in range
// of two others, only the closer pairing becomes a candidate, leaving
// the point on the losing side free to pair with something else.
export function findConnectionCandidates(
  instances: ComponentInstance[],
  connections: Connection[],
  threshold: number,
): ConnectionCandidate[] {
  const claimed = new Set<string>()
  for (const c of connections) {
    if (isAnchorClaimable(instances, c.pieceAId, c.a.anchorIndex)) claimed.add(`${c.pieceAId}:${c.a.anchorIndex}`)
    if (isAnchorClaimable(instances, c.pieceBId, c.b.anchorIndex)) claimed.add(`${c.pieceBId}:${c.b.anchorIndex}`)
  }
  const isClaimed = (pieceId: string, anchorIndex: number) => claimed.has(`${pieceId}:${anchorIndex}`)

  interface Pair {
    pieceAId: string
    pieceBId: string
    a: AnchorRef
    b: AnchorRef
    distance: number
  }
  const allPairs: Pair[] = []

  for (let a = 0; a < instances.length; a++) {
    const pieceA = instances[a]
    const anchorsA = getAnchors(pieceA)
    for (let b = a + 1; b < instances.length; b++) {
      const pieceB = instances[b]
      const anchorsB = getAnchors(pieceB)
      for (let aIndex = 0; aIndex < anchorsA.length; aIndex++) {
        if (isClaimed(pieceA.id, aIndex)) continue
        const worldA = toWorldAnchor(pieceA, anchorsA[aIndex])
        for (let bIndex = 0; bIndex < anchorsB.length; bIndex++) {
          if (isClaimed(pieceB.id, bIndex)) continue
          const anchorB = anchorsB[bIndex]
          if (worldA.kind !== 'point' && anchorB.kind !== 'point') continue
          const worldB = toWorldAnchor(pieceB, anchorB)
          const match = closestBetweenWorldAnchors(worldA, worldB)
          if (match.distance < threshold) {
            allPairs.push({
              pieceAId: pieceA.id,
              pieceBId: pieceB.id,
              a: { anchorIndex: aIndex, param: match.paramA },
              b: { anchorIndex: bIndex, param: match.paramB },
              distance: match.distance,
            })
          }
        }
      }
    }
  }

  allPairs.sort((x, y) => x.distance - y.distance)
  const used = new Set<string>()
  const candidates: ConnectionCandidate[] = []
  for (const pair of allPairs) {
    const aClaimable = isAnchorClaimable(instances, pair.pieceAId, pair.a.anchorIndex)
    const bClaimable = isAnchorClaimable(instances, pair.pieceBId, pair.b.anchorIndex)
    const keyA = `${pair.pieceAId}:${pair.a.anchorIndex}`
    const keyB = `${pair.pieceBId}:${pair.b.anchorIndex}`
    if ((aClaimable && used.has(keyA)) || (bClaimable && used.has(keyB))) continue
    if (aClaimable) used.add(keyA)
    if (bClaimable) used.add(keyB)
    candidates.push({ pieceAId: pair.pieceAId, pieceBId: pair.pieceBId, a: pair.a, b: pair.b })
  }

  return candidates
}
```

- [x] **Step 5: Run tests to verify they pass**

Run: `cd wood-cad-workshop && npx vitest run src/engine/core/connections.test.ts`
Expected: PASS, all cases.

- [x] **Step 6: Run the full check (tsc + full test suite)**

Run: `cd wood-cad-workshop && npx tsc -b && npx vitest run`
Expected: FAIL at this point — `sceneSessionStore.ts` and `ConnectionMarkers.tsx` still reference the old `Connection.pointAIndex`/`pointBIndex` fields and the old `getConnectionPoints`/`toWorldPoint` exports. Confirm the only failures are TypeScript errors in those two files; Tasks 4-5 fix them.

- [x] **Step 7: Commit**

```bash
git add wood-cad-workshop/src/engine/core/types.ts wood-cad-workshop/src/engine/core/connections.ts wood-cad-workshop/src/engine/core/connections.test.ts
git commit -m "feat: move Connection/ConnectionCandidate to AnchorRef, add multi-occupancy claimed-set rule"
```

---

### Task 4: Store wiring — `movePiece` and `confirmConnection` on anchors

**Files:**
- Modify: `wood-cad-workshop/src/store/sceneSessionStore.ts`
- Modify: `wood-cad-workshop/src/store/sceneSessionStore.test.ts`

**Interfaces:**
- Consumes: `getAnchors`, `toWorldAnchor`, `closestBetweenWorldAnchors` (Task 2); `isAnchorClaimable`, `pruneStaleConnections`, `getConnectedPieceIds` (Task 3) — all via the `../engine` barrel, same import pattern already used.
- Produces: no new exports — `movePiece`/`confirmConnection`/`detachConnection` keep their existing signatures (`detachConnection` needs no changes at all, since it only ever removes by `connection.id`).

This task is store orchestration — per this project's established convention, left untested beyond keeping the existing `sceneSessionStore.test.ts` suite green (updating its `Connection` literal fixtures to the new `a`/`b: AnchorRef` shape, since those are currently written against the removed `pointAIndex`/`pointBIndex` fields and won't compile otherwise).

- [x] **Step 1: Update imports**

In `wood-cad-workshop/src/store/sceneSessionStore.ts`, replace:

```ts
import type { ComponentDefinition, ComponentInstance, Connection, ConnectionCandidate, Dimensions } from '../engine'
import {
  createInstance,
  createPullupKitInstances,
  createSeedInstances,
  findClosestConnectionMatch,
  getComponent,
  getConnectedPieceIds,
  getConnectionPoints,
  isConnectionCoincident,
  pruneStaleConnections,
  SNAP_DISTANCE,
  toWorldPoint,
} from '../engine'
```

with:

```ts
import type { ComponentDefinition, ComponentInstance, Connection, ConnectionCandidate, Dimensions } from '../engine'
import {
  closestBetweenWorldAnchors,
  createInstance,
  createPullupKitInstances,
  createSeedInstances,
  findClosestConnectionMatch,
  getAnchors,
  getComponent,
  getConnectedPieceIds,
  isAnchorClaimable,
  pruneStaleConnections,
  SNAP_DISTANCE,
  toWorldAnchor,
} from '../engine'
```

(`isConnectionCoincident` is dropped from this file's imports — the rewritten `confirmConnection` below calls `closestBetweenWorldAnchors` directly instead, and nothing else in this file used `isConnectionCoincident`. Leaving it imported but unused would fail `tsc -b` if the project's strict settings flag unused imports.)

- [x] **Step 2: Update `movePiece`'s exclude-list construction**

Replace:

```ts
        // A point already claimed by ANY existing connection — anywhere in
        // the scene, not just on the dragged piece — can't be claimed by a
        // new one.
        const excludePoints = state.connections.flatMap((c) => [
          { pieceId: c.pieceAId, pointIndex: c.pointAIndex },
          { pieceId: c.pieceBId, pointIndex: c.pointBIndex },
        ])
```

with:

```ts
        // A point-kind anchor already claimed by ANY existing connection
        // — anywhere in the scene, not just on the dragged piece — can't
        // be claimed by a new one. Segment/face anchors are never
        // excluded, since they can host multiple simultaneous
        // connections (see isAnchorClaimable).
        const excludeAnchors = state.connections.flatMap((c) => [
          ...(isAnchorClaimable(state.instances, c.pieceAId, c.a.anchorIndex)
            ? [{ pieceId: c.pieceAId, anchorIndex: c.a.anchorIndex }]
            : []),
          ...(isAnchorClaimable(state.instances, c.pieceBId, c.b.anchorIndex)
            ? [{ pieceId: c.pieceBId, anchorIndex: c.b.anchorIndex }]
            : []),
        ])
```

Then, a few lines below, replace the `findClosestConnectionMatch` call's last argument from `excludePoints` to `excludeAnchors`:

```ts
        const match = findClosestConnectionMatch(
          moving,
          position,
          state.instances.filter((i) => !groupIds.has(i.id)),
          excludeAnchors,
        )
```

- [x] **Step 3: Rewrite `confirmConnection`**

Replace the entire `confirmConnection` action (from its leading comment through its closing `}),`) with:

```ts
    // Persists a candidate found by findConnectionCandidates, after
    // translating pieceB's current connected group (via
    // getConnectedPieceIds, the same rigid-group convention movePiece
    // uses) by the exact delta that brings the two anchors' closest
    // points into coincidence — a candidate is only ever within
    // SNAP_DISTANCE, not necessarily touching, and a confirmed connection
    // must always be an exact, touching joint, never a frozen gap.
    // Re-derives the match at click time (in case something else moved a
    // piece between the candidate being rendered and the click landing)
    // and no-ops if it's gone stale. Also no-ops if either side's anchor
    // is point-kind AND already claimed by an existing connection (a
    // defensive guard against a duplicate confirm) — segment/face
    // anchors never conflict this way, since they can host multiple
    // connections.
    confirmConnection: (candidate) =>
      set((state) => {
        const pieceA = state.instances.find((i) => i.id === candidate.pieceAId)
        const pieceB = state.instances.find((i) => i.id === candidate.pieceBId)
        if (!pieceA || !pieceB) return state

        const anchorA = getAnchors(pieceA)[candidate.a.anchorIndex]
        const anchorB = getAnchors(pieceB)[candidate.b.anchorIndex]
        if (!anchorA || !anchorB) return state

        const worldA = toWorldAnchor(pieceA, anchorA)
        const worldB = toWorldAnchor(pieceB, anchorB)
        const match = closestBetweenWorldAnchors(worldA, worldB)
        if (match.distance > SNAP_DISTANCE) return state

        const claimConflict = state.connections.some((c) => {
          const aConflict =
            isAnchorClaimable(state.instances, candidate.pieceAId, candidate.a.anchorIndex) &&
            ((c.pieceAId === candidate.pieceAId && c.a.anchorIndex === candidate.a.anchorIndex) ||
              (c.pieceBId === candidate.pieceAId && c.b.anchorIndex === candidate.a.anchorIndex))
          const bConflict =
            isAnchorClaimable(state.instances, candidate.pieceBId, candidate.b.anchorIndex) &&
            ((c.pieceAId === candidate.pieceBId && c.a.anchorIndex === candidate.b.anchorIndex) ||
              (c.pieceBId === candidate.pieceBId && c.b.anchorIndex === candidate.b.anchorIndex))
          return aConflict || bConflict
        })
        if (claimConflict) return state

        const delta: [number, number, number] = [
          match.pointA[0] - match.pointB[0],
          match.pointA[1] - match.pointB[1],
          match.pointA[2] - match.pointB[2],
        ]

        const groupIds = getConnectedPieceIds(candidate.pieceBId, state.connections)
        const instances = state.instances.map((i) =>
          groupIds.has(i.id)
            ? {
                ...i,
                position: [i.position[0] + delta[0], i.position[1] + delta[1], i.position[2] + delta[2]] as [
                  number,
                  number,
                  number,
                ],
              }
            : i,
        )

        return {
          instances,
          connections: [
            ...state.connections,
            {
              id: `conn-${candidate.pieceAId}-${candidate.pieceBId}-${candidate.a.anchorIndex}-${candidate.b.anchorIndex}`,
              pieceAId: candidate.pieceAId,
              pieceBId: candidate.pieceBId,
              a: { anchorIndex: candidate.a.anchorIndex, param: match.paramA },
              b: { anchorIndex: candidate.b.anchorIndex, param: match.paramB },
            },
          ],
        }
      }),
```

`detachConnection` is unchanged — leave it exactly as-is.

- [x] **Step 4: Update `sceneSessionStore.test.ts`'s `Connection` fixtures**

Its two `movePiece — group translation` tests each construct `Connection` literals. Replace:

```ts
    const connection: Connection = { id: 'c1', pieceAId: 'r1', pieceBId: 'r2', pointAIndex: 1, pointBIndex: 0 }
```

with:

```ts
    const connection: Connection = { id: 'c1', pieceAId: 'r1', pieceBId: 'r2', a: { anchorIndex: 1 }, b: { anchorIndex: 0 } }
```

and replace:

```ts
    const c1: Connection = { id: 'c1', pieceAId: 'r1', pieceBId: 'r2', pointAIndex: 1, pointBIndex: 0 }
    const c2: Connection = { id: 'c2', pieceAId: 'r2', pieceBId: 'r3', pointAIndex: 1, pointBIndex: 0 }
```

with:

```ts
    const c1: Connection = { id: 'c1', pieceAId: 'r1', pieceBId: 'r2', a: { anchorIndex: 1 }, b: { anchorIndex: 0 } }
    const c2: Connection = { id: 'c2', pieceAId: 'r2', pieceBId: 'r3', a: { anchorIndex: 1 }, b: { anchorIndex: 0 } }
```

No other changes to this file — every other assertion (positions, connection counts, reference identity) is unaffected, since these tests use `rodDefinition()` (a cylinder, unaffected by the anchor-primitive change) and never assert on `pointAIndex`/`pointBIndex`/`a`/`b` values directly, only on connection *counts* and *membership*.

- [x] **Step 5: Run the full check (tsc + full test suite)**

Run: `cd wood-cad-workshop && npx tsc -b && npx vitest run`
Expected: FAIL only in `ConnectionMarkers.tsx` (Task 5 fixes it) — confirm `sceneSessionStore.ts` and `sceneSessionStore.test.ts` themselves compile clean and all `sceneSessionStore.test.ts` tests pass.

- [x] **Step 6: Commit**

```bash
git add wood-cad-workshop/src/store/sceneSessionStore.ts wood-cad-workshop/src/store/sceneSessionStore.test.ts
git commit -m "feat: wire movePiece/confirmConnection to anchor-based matching"
```

---

### Task 5: Marker placement on anchor matches

**Files:**
- Modify: `wood-cad-workshop/src/scene/ConnectionMarkers.tsx`

**Interfaces:**
- Consumes: `closestBetweenWorldAnchors`, `getAnchors`, `toWorldAnchor`, `findConnectionCandidates`, `SNAP_DISTANCE`, `ConnectionCandidate` (Tasks 2-3, via the `../engine` barrel).
- Produces: no new exports — this is a leaf UI component, nothing depends on it.

This is UI/rendering code — per this project's established convention (matching every other `scene/*.tsx` component), left untested. Verify via `tsc` + manual smoke test, deferred per the batched manual-verification note already established this session.

- [x] **Step 1: Replace `ConnectionMarkers.tsx`'s contents**

Replace the full contents of `wood-cad-workshop/src/scene/ConnectionMarkers.tsx` with:

```tsx
import { useRef } from 'react'
import type { ThreeEvent } from '@react-three/fiber'
import { closestBetweenWorldAnchors, findConnectionCandidates, getAnchors, SNAP_DISTANCE, toWorldAnchor } from '../engine'
import type { ConnectionCandidate } from '../engine'
import { useSceneSession } from '../store/sceneSessionStore'

// Bigger than the piece geometry it sits on top of, and bigger than the
// old 0.3-radius marker — an easier touch target for both the
// candidate-confirm and connection-detach clicks below.
const MARKER_RADIUS = 0.5
const CANDIDATE_COLOR = '#ff8c00'
const CONNECTED_COLOR = '#d9342b'
// A fast double-tap confirms then instantly detaches, since the two
// markers sit at the identical screen position and React flushes both
// synchronous clicks before either marker's position updates. This
// cooldown makes a detach click on a connection ignored if it lands within
// this many ms of that same connection's own confirm click.
const DETACH_COOLDOWN_MS = 400

// One marker per active Connection, plus one per not-yet-confirmed
// candidate (two available, compatible anchors within SNAP_DISTANCE of
// each other) — both hidden during exploded view, same as the rotation
// gizmo and vertical-move handle in Piece.tsx.
export function ConnectionMarkers() {
  const instances = useSceneSession((s) => s.instances)
  const connections = useSceneSession((s) => s.connections)
  const explodeAmount = useSceneSession((s) => s.explodeAmount)
  const confirmConnection = useSceneSession((s) => s.confirmConnection)
  const detachConnection = useSceneSession((s) => s.detachConnection)
  const justConfirmedAt = useRef<Map<string, number>>(new Map())

  if (explodeAmount > 0) return null

  // Midpoint of the two anchors' closest-approach points — degenerates
  // to the exact midpoint of two fixed points for a point-point pair
  // (unchanged from before this change), and lands on the true
  // closest-approach location for a segment/face pair.
  const midpointOf = (
    pieceAId: string,
    aAnchorIndex: number,
    pieceBId: string,
    bAnchorIndex: number,
  ): [number, number, number] | null => {
    const pieceA = instances.find((i) => i.id === pieceAId)
    const pieceB = instances.find((i) => i.id === pieceBId)
    if (!pieceA || !pieceB) return null
    const anchorA = getAnchors(pieceA)[aAnchorIndex]
    const anchorB = getAnchors(pieceB)[bAnchorIndex]
    if (!anchorA || !anchorB) return null
    const worldA = toWorldAnchor(pieceA, anchorA)
    const worldB = toWorldAnchor(pieceB, anchorB)
    const match = closestBetweenWorldAnchors(worldA, worldB)
    return [
      (match.pointA[0] + match.pointB[0]) / 2,
      (match.pointA[1] + match.pointB[1]) / 2,
      (match.pointA[2] + match.pointB[2]) / 2,
    ]
  }

  // Stops the click/pointerdown from also reaching Scene.tsx's ground
  // plane behind the marker, which would otherwise deselect the
  // currently-selected piece as a side effect of confirming/detaching.
  const stop = (e: ThreeEvent<PointerEvent> | ThreeEvent<MouseEvent>) => e.stopPropagation()

  const candidates = findConnectionCandidates(instances, connections, SNAP_DISTANCE)

  const candidateKey = (c: ConnectionCandidate) =>
    `candidate-${c.pieceAId}-${c.a.anchorIndex}-${c.pieceBId}-${c.b.anchorIndex}`

  return (
    <>
      {candidates.map((candidate) => {
        const midpoint = midpointOf(candidate.pieceAId, candidate.a.anchorIndex, candidate.pieceBId, candidate.b.anchorIndex)
        if (!midpoint) return null
        return (
          <mesh
            key={candidateKey(candidate)}
            position={midpoint}
            onPointerDown={stop}
            onClick={(e: ThreeEvent<MouseEvent>) => {
              stop(e)
              const connectionId = `conn-${candidate.pieceAId}-${candidate.pieceBId}-${candidate.a.anchorIndex}-${candidate.b.anchorIndex}`
              justConfirmedAt.current.set(connectionId, Date.now())
              confirmConnection(candidate)
            }}
          >
            <sphereGeometry args={[MARKER_RADIUS, 12, 12]} />
            <meshStandardMaterial color={CANDIDATE_COLOR} />
          </mesh>
        )
      })}
      {connections.map((connection) => {
        const midpoint = midpointOf(connection.pieceAId, connection.a.anchorIndex, connection.pieceBId, connection.b.anchorIndex)
        if (!midpoint) return null
        return (
          <mesh
            key={connection.id}
            position={midpoint}
            onPointerDown={stop}
            onClick={(e: ThreeEvent<MouseEvent>) => {
              stop(e)
              const confirmedAt = justConfirmedAt.current.get(connection.id)
              if (confirmedAt !== undefined && Date.now() - confirmedAt < DETACH_COOLDOWN_MS) return
              detachConnection(connection.id)
            }}
          >
            <sphereGeometry args={[MARKER_RADIUS, 12, 12]} />
            <meshStandardMaterial color={CONNECTED_COLOR} />
          </mesh>
        )
      })}
    </>
  )
}
```

- [x] **Step 2: Run the full check (tsc + full test suite)**

Run: `cd wood-cad-workshop && npx tsc -b && npx vitest run`
Expected: PASS, no type errors, all tests green — this is the first point in this plan where the whole project compiles clean end-to-end.

- [x] **Step 3: Commit**

```bash
git add wood-cad-workshop/src/scene/ConnectionMarkers.tsx
git commit -m "feat: place connection markers at anchors' closest-approach points"
```

---

## Manual verification (deferred — batch with other pending checks per the user's established preference this session)

1. Drag a board's end to touch mid-span along another board's wide face (not at the face's exact center) — a candidate orb appears at the true contact point, not a fixed center.
2. Confirm — the two pieces snap into an exact touching joint (no gap); dragging either now moves both together (rigid group movement applies).
3. Drag a third piece's end to a *different* point on that same already-connected face — a second, independent candidate forms and can be confirmed without disturbing the first connection.
4. Detach one of the two face connections — the other stays intact.
5. Shrink a connected piece via the Inspector's dimension fields until the confirmed joint's stored contact point falls outside the piece's new (smaller) extents — the connection prunes automatically, matching today's rotate/resize-breaks-connection behavior.
6. Existing end-to-end board behavior (drag two boards tip to tip) still works exactly as before — unaffected by this change.
7. Existing edge-to-edge board behavior (two same-length boards laid side by side, centers aligned) still connects via the discrete edge-center points, same as before.
8. Place a rod (cylinder) near a board's new face/segment anchors — the rod's own anchors are unaffected (still just its 2 end points); no rod-specific face/segment candidate should appear (cylinder support is still deferred to Sub-project C).
