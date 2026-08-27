# Part Joining System Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a persisted `Connection` record between two pieces' anchor points in `wood-cad-workshop`, created automatically when they snap together during a drag and broken automatically when dragged apart, plus a small visual marker at each active connection.

**Architecture:** Extract the existing drag-time proximity search (`findConnectionSnapDelta`) into a richer `findClosestConnectionMatch` that also reports *which* anchor points matched, add a new pure `engine/core/connections.ts` module for connection-lifecycle logic (coincidence checking), wire connection creation/pruning into the store's existing `movePiece`, and render a marker mesh per active connection in the scene.

**Tech Stack:** TypeScript, Zustand (store), React Three Fiber (marker rendering), Vitest.

**Spec:** `docs/superpowers/specs/2026-08-26-part-joining-system-design.md`

## Global Constraints

- `engine/core/*` stays framework-agnostic — no `three` import (existing project convention, unaffected by this feature since it needs none).
- Invariant: a given `(pieceId, pointIndex)` pair appears in at most one `Connection` at a time — enforced by excluding already-claimed points as match candidates, not by a separate validation pass.
- The same `SNAP_DISTANCE` constant (currently `3`, private to `connectionPoints.ts`) is reused as both the creation threshold (existing behavior) and the break threshold (new) — no second magic number.
- Out of scope for this plan (do not implement): rotation alignment on connect, moving connected pieces together (that's the separate, not-yet-built `Group` feature), an explicit "remove connection" UI action, and face-based connection points (`getConnectionPoints` keeps returning only `'ends'`/`'single'` points).
- The connection marker is hidden whenever `explodeAmount > 0`, matching the existing guard used for the rotation gizmo and the vertical-move handle in `Piece.tsx`.
- No new tests for Zustand store orchestration or React/pointer UI — this project's established convention (see every prior step's plan) is to unit-test only pure `engine/core` functions and leave store wiring and rendering to manual verification.

---

### Task 1: Extract `findClosestConnectionMatch`; add the `Connection` type

**Files:**
- Modify: `wood-cad-workshop/src/engine/core/types.ts` (add `Connection` interface)
- Modify: `wood-cad-workshop/src/engine/core/connectionPoints.ts` (full replacement below)
- Test: `wood-cad-workshop/src/engine/core/connectionPoints.test.ts` (add new tests; existing tests must keep passing unmodified)

**Interfaces:**
- Consumes: nothing new.
- Produces: `Connection` (`types.ts`) — `{ id: string; pieceAId: string; pieceBId: string; pointAIndex: number; pointBIndex: number }`, for Task 2 and Task 3. `SNAP_DISTANCE` (now exported, `connectionPoints.ts`), `ConnectionMatch` (`{ otherId: string; movingPointIndex: number; otherPointIndex: number; delta: [number, number, number] }`), and `findClosestConnectionMatch(movingInstance, proposedPosition, allInstances, excludePoints?)` returning `ConnectionMatch | null` — for Task 3. `findConnectionSnapDelta`'s existing signature and behavior are unchanged (it becomes a thin wrapper over the new function).

- [ ] **Step 1: Write the failing tests**

Add these two `describe` blocks to the end of `wood-cad-workshop/src/engine/core/connectionPoints.test.ts` (the file already imports `registerComponent`/`clearRegistry`/`ComponentDefinition`/`ComponentInstance` and has `rodDefinition()`/`footDefinition()` fixtures from the existing `beforeEach` — reuse them):

```ts
describe('findClosestConnectionMatch', () => {
  it('reports which points matched, in addition to the delta', () => {
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
    const match = findClosestConnectionMatch(rod, [0, 0, 0.5], [foot])
    expect(match).not.toBeNull()
    expect(match!.otherId).toBe('f1')
    expect(match!.movingPointIndex).toBe(1) // rod's far end, local z=+5
    expect(match!.otherPointIndex).toBe(0) // foot's only point
  })

  it('excludes points already claimed by an existing connection', () => {
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
    const match = findClosestConnectionMatch(rod, [0, 0, 0.5], [foot], [
      { pieceId: 'f1', pointIndex: 0 },
    ])
    expect(match).toBeNull()
  })
})
```

Also change the test file's import line (currently `import { findConnectionSnapDelta, getConnectionPoints, toWorldPoint } from './connectionPoints'`) to also import the new symbol:

```ts
import { findClosestConnectionMatch, findConnectionSnapDelta, getConnectionPoints, toWorldPoint } from './connectionPoints'
```

- [ ] **Step 2: Run tests to verify the new ones fail**

Run: `cd wood-cad-workshop && npx vitest run connectionPoints`
Expected: FAIL — `findClosestConnectionMatch` is not exported yet (existing tests in the file still pass).

- [ ] **Step 3: Add the `Connection` type**

In `wood-cad-workshop/src/engine/core/types.ts`, add this after the `ComponentInstance` interface (end of file):

```ts

export interface Connection {
  id: string
  pieceAId: string
  pieceBId: string
  pointAIndex: number // index into getConnectionPoints(pieceA)
  pointBIndex: number // index into getConnectionPoints(pieceB)
}
```

- [ ] **Step 4: Replace `connectionPoints.ts`**

Replace the full contents of `wood-cad-workshop/src/engine/core/connectionPoints.ts` with:

```ts
import type { ComponentInstance } from './types'
import { getComponent } from '../registry/registry'

export const SNAP_DISTANCE = 3

// Local-space attach points for this piece's shape, before its position/
// rotation are applied. See ConnectionRole (core/types.ts) for what each
// role means.
export function getConnectionPoints(instance: ComponentInstance): [number, number, number][] {
  const definition = getComponent(instance.componentDefinitionId)
  const { length } = instance.dimensions
  switch (definition.connectionRole) {
    case 'ends':
      return [
        [0, 0, -length / 2],
        [0, 0, length / 2],
      ]
    case 'single':
      return [[0, 0, 0]]
    default:
      return []
  }
}

export function toWorldPoint(
  instance: ComponentInstance,
  local: [number, number, number],
): [number, number, number] {
  const [lx, ly, lz] = local
  const [rx, ry, rz] = instance.rotation

  // Full 3-axis rotation matrix for three.js's default Euler order 'XYZ'
  // (matches THREE.Matrix4.makeRotationFromEuler exactly, so this stays in
  // sync with how Piece.tsx renders `instance.rotation`). Reduces to the
  // previous yaw-only formula when rx = rz = 0.
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

  return [
    instance.position[0] + m11 * lx + m12 * ly + m13 * lz,
    instance.position[1] + m21 * lx + m22 * ly + m23 * lz,
    instance.position[2] + m31 * lx + m32 * ly + m33 * lz,
  ]
}

export interface ConnectionMatch {
  otherId: string
  movingPointIndex: number
  otherPointIndex: number
  delta: [number, number, number]
}

// Given a piece mid-drag at `proposedPosition`, checks whether any of its
// connection points land close to another piece's connection point, and
// reports exactly which points matched (not just the resulting delta) so a
// caller can turn a match into a persisted Connection (see
// engine/core/connections.ts). `excludePoints` skips points already
// claimed by an existing connection — one physical end can only be joined
// to one other piece at a time.
export function findClosestConnectionMatch(
  movingInstance: ComponentInstance,
  proposedPosition: [number, number, number],
  allInstances: ComponentInstance[],
  excludePoints: { pieceId: string; pointIndex: number }[] = [],
): ConnectionMatch | null {
  const isExcluded = (pieceId: string, pointIndex: number) =>
    excludePoints.some((p) => p.pieceId === pieceId && p.pointIndex === pointIndex)

  const proposedInstance: ComponentInstance = { ...movingInstance, position: proposedPosition }
  const movingPointsLocal = getConnectionPoints(proposedInstance)
  if (movingPointsLocal.length === 0) return null

  let best: (ConnectionMatch & { distance: number }) | null = null

  for (const other of allInstances) {
    if (other.id === movingInstance.id) continue
    const otherPointsLocal = getConnectionPoints(other)
    if (otherPointsLocal.length === 0) continue

    movingPointsLocal.forEach((localA, movingPointIndex) => {
      if (isExcluded(movingInstance.id, movingPointIndex)) return
      const worldA = toWorldPoint(proposedInstance, localA)
      otherPointsLocal.forEach((localB, otherPointIndex) => {
        if (isExcluded(other.id, otherPointIndex)) return
        const worldB = toWorldPoint(other, localB)
        const dx = worldB[0] - worldA[0]
        const dy = worldB[1] - worldA[1]
        const dz = worldB[2] - worldA[2]
        const distance = Math.sqrt(dx * dx + dy * dy + dz * dz)
        if (distance < SNAP_DISTANCE && (!best || distance < best.distance)) {
          best = { distance, otherId: other.id, movingPointIndex, otherPointIndex, delta: [dx, dy, dz] }
        }
      })
    })
  }

  return best ? { otherId: best.otherId, movingPointIndex: best.movingPointIndex, otherPointIndex: best.otherPointIndex, delta: best.delta } : null
}

// Given a piece mid-drag at `proposedPosition`, returns the (dx,dy,dz)
// nudge that makes its closest connection point pair coincide exactly, or
// null if nothing is within snap distance — basic proximity snapping.
export function findConnectionSnapDelta(
  movingInstance: ComponentInstance,
  proposedPosition: [number, number, number],
  allInstances: ComponentInstance[],
): [number, number, number] | null {
  return findClosestConnectionMatch(movingInstance, proposedPosition, allInstances)?.delta ?? null
}
```

- [ ] **Step 5: Run tests to verify everything passes**

Run: `cd wood-cad-workshop && npx vitest run connectionPoints`
Expected: PASS — all cases in `connectionPoints.test.ts`, old and new, green.

- [ ] **Step 6: Run the full suite and commit**

Run: `cd wood-cad-workshop && npx tsc -b && npx vitest run`
Expected: clean type-check, all test files pass.

```bash
git add wood-cad-workshop/src/engine/core/types.ts wood-cad-workshop/src/engine/core/connectionPoints.ts wood-cad-workshop/src/engine/core/connectionPoints.test.ts
git commit -m "feat(wood-cad-workshop): add Connection type, extract findClosestConnectionMatch"
```

---

### Task 2: Connection lifecycle logic (`connections.ts`)

**Files:**
- Create: `wood-cad-workshop/src/engine/core/connections.ts`
- Test: `wood-cad-workshop/src/engine/core/connections.test.ts`
- Modify: `wood-cad-workshop/src/engine/index.ts` (add one export line)

**Interfaces:**
- Consumes: `Connection`, `ComponentInstance` (Task 1's `types.ts`), `getConnectionPoints`, `toWorldPoint` (`connectionPoints.ts`, unchanged by Task 1).
- Produces: `isConnectionCoincident(connection: Connection, instances: ComponentInstance[], threshold: number): boolean`, for Task 3 to call from `movePiece`.

- [ ] **Step 1: Write the failing test**

Create `wood-cad-workshop/src/engine/core/connections.test.ts`:

```ts
import { describe, it, expect, beforeEach } from 'vitest'
import { registerComponent, clearRegistry } from '../registry/registry'
import { isConnectionCoincident } from './connections'
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
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd wood-cad-workshop && npx vitest run connections`
Expected: FAIL — `wood-cad-workshop/src/engine/core/connections.ts` doesn't exist yet.

- [ ] **Step 3: Write the implementation**

Create `wood-cad-workshop/src/engine/core/connections.ts`:

```ts
import type { ComponentInstance, Connection } from './types'
import { getConnectionPoints, toWorldPoint } from './connectionPoints'

// Whether a persisted Connection's two anchor points are still within
// `threshold` of each other in world space — used to decide whether a
// connection survives after either of its pieces moves.
export function isConnectionCoincident(
  connection: Connection,
  instances: ComponentInstance[],
  threshold: number,
): boolean {
  const pieceA = instances.find((i) => i.id === connection.pieceAId)
  const pieceB = instances.find((i) => i.id === connection.pieceBId)
  if (!pieceA || !pieceB) return false

  const localA = getConnectionPoints(pieceA)[connection.pointAIndex]
  const localB = getConnectionPoints(pieceB)[connection.pointBIndex]
  if (!localA || !localB) return false

  const worldA = toWorldPoint(pieceA, localA)
  const worldB = toWorldPoint(pieceB, localB)
  const dx = worldB[0] - worldA[0]
  const dy = worldB[1] - worldA[1]
  const dz = worldB[2] - worldA[2]
  return Math.sqrt(dx * dx + dy * dy + dz * dz) <= threshold
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd wood-cad-workshop && npx vitest run connections`
Expected: PASS, all 3 cases green.

- [ ] **Step 5: Export the new module**

In `wood-cad-workshop/src/engine/index.ts`, add this line among the other `export * from './core/...'` lines (alphabetically near `connectionPoints`):

```ts
export * from './core/connections'
```

- [ ] **Step 6: Run the full suite and commit**

Run: `cd wood-cad-workshop && npx tsc -b && npx vitest run`
Expected: clean type-check, all test files pass.

```bash
git add wood-cad-workshop/src/engine/core/connections.ts wood-cad-workshop/src/engine/core/connections.test.ts wood-cad-workshop/src/engine/index.ts
git commit -m "feat(wood-cad-workshop): add connection-coincidence check"
```

---

### Task 3: Wire connections into the store

**Files:**
- Modify: `wood-cad-workshop/src/store/sceneSessionStore.ts`

**Interfaces:**
- Consumes: `Connection` (Task 1), `findClosestConnectionMatch`, `SNAP_DISTANCE` (Task 1), `isConnectionCoincident` (Task 2).
- Produces: `connections: Connection[]` on `SceneSessionState`, for Task 4's `ConnectionMarkers` component to read via `useSceneSession((s) => s.connections)`.

- [ ] **Step 1: Update imports**

In `wood-cad-workshop/src/store/sceneSessionStore.ts`, change:

```ts
import type { ComponentDefinition, ComponentInstance, Dimensions } from '../engine'
import {
  createInstance,
  createPullupKitInstances,
  createSeedInstances,
  findConnectionSnapDelta,
  getComponent,
} from '../engine'
```

to:

```ts
import type { ComponentDefinition, ComponentInstance, Connection, Dimensions } from '../engine'
import {
  createInstance,
  createPullupKitInstances,
  createSeedInstances,
  findClosestConnectionMatch,
  getComponent,
  isConnectionCoincident,
  SNAP_DISTANCE,
} from '../engine'
```

(`findConnectionSnapDelta` is no longer used by this file — it stays exported from `engine/core/connectionPoints.ts` for its own tests, just not imported here anymore.)

- [ ] **Step 2: Add `connections` to state**

In the `SceneSessionState` interface, add this field right after `isDraggingPiece: boolean`:

```ts
  connections: Connection[]
```

In the store body's initial state, add this right after `isDraggingPiece: false,`:

```ts
    connections: [],
```

- [ ] **Step 3: Replace `movePiece`**

Replace the existing `movePiece` implementation:

```ts
    movePiece: (id, position) =>
      set((state) => {
        const moving = state.instances.find((i) => i.id === id)
        if (!moving) return state
        const delta = findConnectionSnapDelta(moving, position, state.instances)
        const finalPosition: [number, number, number] = delta
          ? [position[0] + delta[0], position[1] + delta[1], position[2] + delta[2]]
          : position
        return {
          instances: state.instances.map((i) => (i.id === id ? { ...i, position: finalPosition } : i)),
        }
      }),
```

with:

```ts
    movePiece: (id, position) =>
      set((state) => {
        const moving = state.instances.find((i) => i.id === id)
        if (!moving) return state

        // Staleness is checked against the raw drag position, not the
        // post-snap one: the snap correction below is always smaller than
        // SNAP_DISTANCE, so it can never flip a connection between stale
        // and coincident on its own — this sidesteps needing the final
        // position before it's known.
        const instancesAtProposed = state.instances.map((i) => (i.id === id ? { ...i, position } : i))
        const survivingConnections = state.connections.filter((c) => {
          if (c.pieceAId !== id && c.pieceBId !== id) return true
          return isConnectionCoincident(c, instancesAtProposed, SNAP_DISTANCE)
        })

        // Points already claimed by a surviving connection can't be
        // claimed by a new one — this also means a point that just broke
        // free above is available again in this same move.
        const excludePoints = survivingConnections.flatMap((c) => [
          { pieceId: c.pieceAId, pointIndex: c.pointAIndex },
          { pieceId: c.pieceBId, pointIndex: c.pointBIndex },
        ])
        const match = findClosestConnectionMatch(moving, position, state.instances, excludePoints)
        const finalPosition: [number, number, number] = match
          ? [position[0] + match.delta[0], position[1] + match.delta[1], position[2] + match.delta[2]]
          : position

        let nextConnections = survivingConnections
        if (match) {
          const alreadyConnected = survivingConnections.some(
            (c) =>
              (c.pieceAId === id &&
                c.pieceBId === match.otherId &&
                c.pointAIndex === match.movingPointIndex &&
                c.pointBIndex === match.otherPointIndex) ||
              (c.pieceBId === id &&
                c.pieceAId === match.otherId &&
                c.pointBIndex === match.movingPointIndex &&
                c.pointAIndex === match.otherPointIndex),
          )
          if (!alreadyConnected) {
            nextConnections = [
              ...survivingConnections,
              {
                id: `conn-${id}-${match.otherId}-${Date.now()}`,
                pieceAId: id,
                pieceBId: match.otherId,
                pointAIndex: match.movingPointIndex,
                pointBIndex: match.otherPointIndex,
              },
            ]
          }
        }

        return {
          instances: state.instances.map((i) => (i.id === id ? { ...i, position: finalPosition } : i)),
          connections: nextConnections,
        }
      }),
```

- [ ] **Step 4: Update `deleteSelected`**

Replace:

```ts
    deleteSelected: () =>
      set((state) => ({
        instances: state.instances.filter((i) => i.id !== state.selectedId),
        selectedId: null,
      })),
```

with:

```ts
    deleteSelected: () =>
      set((state) => ({
        instances: state.instances.filter((i) => i.id !== state.selectedId),
        connections: state.connections.filter(
          (c) => c.pieceAId !== state.selectedId && c.pieceBId !== state.selectedId,
        ),
        selectedId: null,
      })),
```

- [ ] **Step 5: Run the full suite and commit**

Run: `cd wood-cad-workshop && npx tsc -b && npx vitest run`
Expected: clean type-check, all test files pass (this task adds no new tests — store orchestration isn't unit-tested in this project, per Global Constraints).

```bash
git add wood-cad-workshop/src/store/sceneSessionStore.ts
git commit -m "feat(wood-cad-workshop): create and prune connections in movePiece"
```

---

### Task 4: Render connection markers

**Files:**
- Create: `wood-cad-workshop/src/scene/ConnectionMarkers.tsx`
- Modify: `wood-cad-workshop/src/scene/Scene.tsx`

**Interfaces:**
- Consumes: `connections` (Task 3's store state), `getConnectionPoints`, `toWorldPoint` (Task 1, unchanged).
- Produces: nothing consumed by later tasks — this is the final task in this plan.

- [ ] **Step 1: Create the marker component**

Create `wood-cad-workshop/src/scene/ConnectionMarkers.tsx`:

```tsx
import { getConnectionPoints, toWorldPoint } from '../engine'
import { useSceneSession } from '../store/sceneSessionStore'

// One small marker per active Connection, at the midpoint of its two
// (already-coincident) anchor points. Hidden during exploded view, same as
// the rotation gizmo and vertical-move handle in Piece.tsx — exploded view
// means "pulled apart," so a joint marker sitting there would misread.
export function ConnectionMarkers() {
  const instances = useSceneSession((s) => s.instances)
  const connections = useSceneSession((s) => s.connections)
  const explodeAmount = useSceneSession((s) => s.explodeAmount)

  if (explodeAmount > 0) return null

  return (
    <>
      {connections.map((connection) => {
        const pieceA = instances.find((i) => i.id === connection.pieceAId)
        const pieceB = instances.find((i) => i.id === connection.pieceBId)
        if (!pieceA || !pieceB) return null

        const localA = getConnectionPoints(pieceA)[connection.pointAIndex]
        const localB = getConnectionPoints(pieceB)[connection.pointBIndex]
        if (!localA || !localB) return null

        const worldA = toWorldPoint(pieceA, localA)
        const worldB = toWorldPoint(pieceB, localB)
        const midpoint: [number, number, number] = [
          (worldA[0] + worldB[0]) / 2,
          (worldA[1] + worldB[1]) / 2,
          (worldA[2] + worldB[2]) / 2,
        ]

        return (
          <mesh key={connection.id} position={midpoint}>
            <sphereGeometry args={[0.3, 12, 12]} />
            <meshStandardMaterial color="#2b2b2b" />
          </mesh>
        )
      })}
    </>
  )
}
```

- [ ] **Step 2: Mount it in the scene**

In `wood-cad-workshop/src/scene/Scene.tsx`, add the import:

```ts
import { ConnectionMarkers } from './ConnectionMarkers'
```

and render it right after the `{instances.map((instance) => ( ... ))}` block, still inside the outer `<>...</>` fragment:

```tsx
      {instances.map((instance) => (
        <Piece
          key={instance.id}
          instance={instance}
          definition={getComponent(instance.componentDefinitionId)}
          centroid={centroid}
          multiTouchActiveRef={multiTouchActiveRef}
        />
      ))}
      <ConnectionMarkers />
```

- [ ] **Step 3: Run the full suite**

Run: `cd wood-cad-workshop && npx tsc -b && npx vitest run`
Expected: clean type-check, all test files pass (this task adds no new tests — rendering isn't unit-tested in this project, per Global Constraints).

- [ ] **Step 4: Commit**

```bash
git add wood-cad-workshop/src/scene/ConnectionMarkers.tsx wood-cad-workshop/src/scene/Scene.tsx
git commit -m "feat(wood-cad-workshop): render a marker at each active connection"
```

- [ ] **Step 5: Manual verification (final check-in)**

Start the dev server (`cd wood-cad-workshop && npm run dev`) and ask the user to walk through the spec's manual verification checklist (`docs/superpowers/specs/2026-08-26-part-joining-system-design.md`, "Manual verification" section):

1. Drag two "ends"-role pieces (e.g. two boards) until their ends snap together — a small dark marker should appear at the joint.
2. Drag one of them away — the marker should disappear once they separate past the snap distance.
3. Build the pull-up kit (bar + two posts + two feet) and confirm markers appear at both bar-to-post joints.
4. Drag a third piece's end close to an already-connected end — it should not steal or duplicate that connection (the occupied point is skipped).
5. Delete a connected piece — its marker(s) should disappear with it, with no leftover/orphaned marker.
6. Toggle exploded view — markers should hide while exploded and reappear correctly once reassembled.

Do not report this plan complete until the user confirms all six checks.

---

## Self-Review Notes

- **Spec coverage:** data model (Task 1), connection lifecycle / coincidence check (Task 2), store integration incl. `deleteSelected` cleanup (Task 3), visual marker + exploded-view guard (Task 4), testing approach (Tasks 1-2 get new pure-function tests; Tasks 3-4 intentionally don't, matching the spec's stated convention) — all covered. Explicitly-out-of-scope items (rotation alignment, group-move, remove-connection UI, face-based points) are called out in Global Constraints so no task drifts into them.
- **Placeholder scan:** none found; every step has literal code or literal shell commands.
- **Type consistency:** `Connection` (Task 1: `types.ts`) fields (`id`, `pieceAId`, `pieceBId`, `pointAIndex`, `pointBIndex`) match exactly across `isConnectionCoincident`'s usage (Task 2), the store's `connections: Connection[]` and the object literal built in `movePiece` (Task 3), and `ConnectionMarkers`' destructuring (Task 4). `findClosestConnectionMatch`'s return shape (`otherId`, `movingPointIndex`, `otherPointIndex`, `delta`) matches its consumption in `movePiece` (Task 3) exactly.
