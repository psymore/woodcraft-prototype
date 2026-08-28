# Explicit Connection Confirm/Detach Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace automatic connection-forming with an explicit click: a bigger orange orb appears at any candidate joint (two unclaimed, compatible points within `SNAP_DISTANCE`) and stays visible until clicked; clicking it persists the connection and turns the orb red; clicking a red orb detaches (removes) that connection.

**Architecture:** A new pure function `findConnectionCandidates` (scene-wide version of the existing single-piece `findClosestConnectionMatch` search) drives a second, parallel marker list in `ConnectionMarkers.tsx`. `movePiece` keeps its existing position-snap nudge but stops auto-persisting a `Connection` from it. Two new store actions (`confirmConnection`, `detachConnection`) do the persisting/removing that used to happen automatically.

**Tech Stack:** TypeScript, Zustand, React Three Fiber, Vitest (existing project stack — no new dependencies).

**Spec:** [docs/superpowers/specs/2026-08-28-connection-confirm-detach-design.md](../specs/2026-08-28-connection-confirm-detach-design.md)

## Global Constraints

- `findConnectionCandidates` lives in `wood-cad-workshop/src/engine/core/connections.ts` and must not import `three` — pure `engine/core` layer, matching every existing function in that file.
- `movePiece`'s position-snap nudge (the `match`/`finalPosition` computation) is unchanged — only the step that turned a match into a persisted `Connection` is removed. Rigid group movement, the pre-move `groupIds` exclusion from the candidate search, and the post-move prune are all unchanged.
- Marker radius is `0.5` for both candidate and confirmed markers (up from today's `0.3`).
- `findConnectionCandidates` gets unit tests (pure `engine/core` convention). `confirmConnection`/`detachConnection` are simple, single-purpose store actions (no traversal, no derived math) — left untested per this project's established store-orchestration convention, same tier as `setRotation`/`deleteSelected`, not the scoped exception `movePiece`'s group-translation logic earned.
- Manual verification for this feature is deferred — the user has asked to batch it with other pending manual checks at the end of this work session, not gate task completion on it this round.

---

### Task 1: `findConnectionCandidates` pure function

**Files:**
- Modify: `wood-cad-workshop/src/engine/core/connections.ts`
- Test: `wood-cad-workshop/src/engine/core/connections.test.ts`

**Interfaces:**
- Consumes: `getConnectionPoints`, `toWorldPoint` from `./connectionPoints` (already imported in this file); `ComponentInstance`, `Connection` from `./types` (already imported).
- Produces: `export interface ConnectionCandidate { pieceAId: string; pieceBId: string; pointAIndex: number; pointBIndex: number }` and `export function findConnectionCandidates(instances: ComponentInstance[], connections: Connection[], threshold: number): ConnectionCandidate[]` — for Task 2 (`sceneSessionStore.ts`'s `confirmConnection`) and Task 3 (`ConnectionMarkers.tsx`) to consume. Also widens `isConnectionCoincident`'s first parameter type from `Connection` to `ConnectionLike` (a 4-field structural type both `Connection` and `ConnectionCandidate` satisfy) — Task 2's `confirmConnection` calls `isConnectionCoincident` directly with a `ConnectionCandidate`, which needs this widening to type-check.

- [ ] **Step 1: Write the failing tests**

Add to `wood-cad-workshop/src/engine/core/connections.test.ts`, after the existing `getConnectedPieceIds` describe block (and add `findConnectionCandidates` to the import line at the top: `import { isConnectionCoincident, pruneStaleConnections, getConnectedPieceIds, findConnectionCandidates } from './connections'`):

```ts
describe('findConnectionCandidates', () => {
  it('returns an empty array when no unclaimed points are within threshold', () => {
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
    expect(findConnectionCandidates([rod, foot], [], 3)).toEqual([])
  })

  it('returns one candidate for one unclaimed pair within threshold', () => {
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
    // rod's far end (local z=+5, index 1) is at world z=5; foot's point
    // (index 0) is also at world z=5 — coincident, within threshold 3.
    expect(findConnectionCandidates([rod, foot], [], 3)).toEqual([
      { pieceAId: 'r1', pieceBId: 'f1', pointAIndex: 1, pointBIndex: 0 },
    ])
  })

  it('excludes a pair whose points are already claimed by an existing connection', () => {
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
    const existing: Connection = { id: 'c1', pieceAId: 'r1', pieceBId: 'f1', pointAIndex: 1, pointBIndex: 0 }
    expect(findConnectionCandidates([rod, foot], [existing], 3)).toEqual([])
  })

  it('when a point is within range of two others, only the closer pairing becomes a candidate', () => {
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
    const fartherFoot: ComponentInstance = {
      id: 'f2',
      componentDefinitionId: 'test_foot',
      position: [0, 0, 6],
      rotation: [0, 0, 0],
      dimensions: { thickness: 1, width: 1, length: 1 },
      material: '#000',
    }
    // rod's index-1 point (world z=5) is within threshold 3 of BOTH f1
    // (world z=5, distance 0) and f2 (world z=6, distance 1) — only the
    // closer pairing (f1) should become a candidate.
    const result = findConnectionCandidates([rod, nearFoot, fartherFoot], [], 3)
    expect(result).toEqual([{ pieceAId: 'r1', pieceBId: 'f1', pointAIndex: 1, pointBIndex: 0 }])
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd wood-cad-workshop && npx vitest run src/engine/core/connections.test.ts`
Expected: FAIL — `findConnectionCandidates` is not exported / not defined.

- [ ] **Step 3: Widen `isConnectionCoincident`'s parameter type**

In `wood-cad-workshop/src/engine/core/connections.ts`, replace:

```ts
export function isConnectionCoincident(
  connection: Connection,
  instances: ComponentInstance[],
  threshold: number,
): boolean {
```

with:

```ts
// The 4 fields both a persisted Connection and an unconfirmed
// ConnectionCandidate share — lets this function (and Task 2's
// confirmConnection) accept either without requiring a Connection's `id`.
type ConnectionLike = Pick<Connection, 'pieceAId' | 'pieceBId' | 'pointAIndex' | 'pointBIndex'>

export function isConnectionCoincident(
  connection: ConnectionLike,
  instances: ComponentInstance[],
  threshold: number,
): boolean {
```

No other changes to the function body — it already only reads `.pieceAId`/`.pieceBId`/`.pointAIndex`/`.pointBIndex`.

- [ ] **Step 4: Implement `findConnectionCandidates`**

Add to `wood-cad-workshop/src/engine/core/connections.ts`, after `getConnectedPieceIds`:

```ts
export interface ConnectionCandidate {
  pieceAId: string
  pieceBId: string
  pointAIndex: number
  pointBIndex: number
}

// Scene-wide version of connectionPoints.ts's findClosestConnectionMatch
// (which is anchored to one "moving" piece): finds every pair of
// currently-unclaimed, compatible connection points within `threshold`
// of each other, anywhere in the scene. Same "closest pairing wins, no
// point claimed by more than one candidate" rule — if a free point is in
// range of two others, only the closer pairing becomes a candidate,
// leaving the point on the losing side free to pair with something else.
export function findConnectionCandidates(
  instances: ComponentInstance[],
  connections: Connection[],
  threshold: number,
): ConnectionCandidate[] {
  const claimed = new Set(
    connections.flatMap((c) => [`${c.pieceAId}:${c.pointAIndex}`, `${c.pieceBId}:${c.pointBIndex}`]),
  )
  const isClaimed = (pieceId: string, pointIndex: number) => claimed.has(`${pieceId}:${pointIndex}`)

  const allPairs: (ConnectionCandidate & { distance: number })[] = []

  for (let a = 0; a < instances.length; a++) {
    const pieceA = instances[a]
    const pointsA = getConnectionPoints(pieceA)
    for (let b = a + 1; b < instances.length; b++) {
      const pieceB = instances[b]
      const pointsB = getConnectionPoints(pieceB)
      for (let pointAIndex = 0; pointAIndex < pointsA.length; pointAIndex++) {
        if (isClaimed(pieceA.id, pointAIndex)) continue
        const worldA = toWorldPoint(pieceA, pointsA[pointAIndex])
        for (let pointBIndex = 0; pointBIndex < pointsB.length; pointBIndex++) {
          if (isClaimed(pieceB.id, pointBIndex)) continue
          const worldB = toWorldPoint(pieceB, pointsB[pointBIndex])
          const dx = worldB[0] - worldA[0]
          const dy = worldB[1] - worldA[1]
          const dz = worldB[2] - worldA[2]
          const distance = Math.sqrt(dx * dx + dy * dy + dz * dz)
          if (distance < threshold) {
            allPairs.push({ pieceAId: pieceA.id, pieceBId: pieceB.id, pointAIndex, pointBIndex, distance })
          }
        }
      }
    }
  }

  allPairs.sort((x, y) => x.distance - y.distance)
  const used = new Set<string>()
  const candidates: ConnectionCandidate[] = []
  for (const pair of allPairs) {
    const keyA = `${pair.pieceAId}:${pair.pointAIndex}`
    const keyB = `${pair.pieceBId}:${pair.pointBIndex}`
    if (used.has(keyA) || used.has(keyB)) continue
    used.add(keyA)
    used.add(keyB)
    candidates.push({
      pieceAId: pair.pieceAId,
      pieceBId: pair.pieceBId,
      pointAIndex: pair.pointAIndex,
      pointBIndex: pair.pointBIndex,
    })
  }

  return candidates
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `cd wood-cad-workshop && npx vitest run src/engine/core/connections.test.ts`
Expected: PASS, all cases including the new `findConnectionCandidates` describe block and every pre-existing test in this file (the `isConnectionCoincident` signature widening must not break its existing tests — they pass full `Connection` object literals, which satisfy the narrower `ConnectionLike` type structurally).

- [ ] **Step 6: Run the full check (tsc + full test suite)**

Run: `cd wood-cad-workshop && npx tsc -b && npx vitest run`
Expected: PASS, no type errors, all tests green.

- [ ] **Step 7: Commit**

```bash
git add wood-cad-workshop/src/engine/core/connections.ts wood-cad-workshop/src/engine/core/connections.test.ts
git commit -m "feat: add findConnectionCandidates for scene-wide unclaimed-point pairing"
```

---

### Task 2: Store wiring — `confirmConnection`, `detachConnection`, and `movePiece`'s auto-append removal

**Files:**
- Modify: `wood-cad-workshop/src/store/sceneSessionStore.ts`

**Interfaces:**
- Consumes: `ConnectionCandidate` type and `isConnectionCoincident` (widened signature) from Task 1, both re-exported via the `engine/core/connections.ts` barrel (`engine/index.ts` already has `export * from './core/connections'`) — add `ConnectionCandidate` to this file's existing `import type {...} from '../engine'` line, and `isConnectionCoincident` to the existing `import {...} from '../engine'` value-import line.
- Produces: `confirmConnection: (candidate: ConnectionCandidate) => void` and `detachConnection: (connectionId: string) => void` on `SceneSessionState`, for Task 3 (`ConnectionMarkers.tsx`) to call.

This task is store orchestration — per this project's established convention (and this plan's Global Constraints), `confirmConnection`/`detachConnection` are simple single-purpose actions left untested; verify via `tsc` + the existing suite, not new tests.

- [ ] **Step 1: Update imports**

In `wood-cad-workshop/src/store/sceneSessionStore.ts`, change:

```ts
import type { ComponentDefinition, ComponentInstance, Connection, Dimensions } from '../engine'
import {
  createInstance,
  createPullupKitInstances,
  createSeedInstances,
  findClosestConnectionMatch,
  getComponent,
  getConnectedPieceIds,
  pruneStaleConnections,
  SNAP_DISTANCE,
} from '../engine'
```

to:

```ts
import type { ComponentDefinition, ComponentInstance, Connection, ConnectionCandidate, Dimensions } from '../engine'
import {
  createInstance,
  createPullupKitInstances,
  createSeedInstances,
  findClosestConnectionMatch,
  getComponent,
  getConnectedPieceIds,
  isConnectionCoincident,
  pruneStaleConnections,
  SNAP_DISTANCE,
} from '../engine'
```

- [ ] **Step 2: Add the two new actions to `SceneSessionState`**

In the `SceneSessionState` interface, after `movePiece: (id: string, position: [number, number, number]) => void`, add:

```ts
  movePiece: (id: string, position: [number, number, number]) => void
  confirmConnection: (candidate: ConnectionCandidate) => void
  detachConnection: (connectionId: string) => void
```

- [ ] **Step 3: Remove `movePiece`'s auto-append step**

In `movePiece`'s body, remove the `if (match) { ... }` block and its trailing blank line, and change `let nextConnections` to `const nextConnections` since it's no longer reassigned. Replace:

```ts
        let nextConnections = pruneStaleConnections(instancesAtFinal, state.connections, SNAP_DISTANCE)

        if (match) {
          nextConnections = [
            ...nextConnections,
            {
              id: `conn-${id}-${match.otherId}-${match.movingPointIndex}-${match.otherPointIndex}`,
              pieceAId: id,
              pieceBId: match.otherId,
              pointAIndex: match.movingPointIndex,
              pointBIndex: match.otherPointIndex,
            },
          ]
        }

        return {
          instances: instancesAtFinal,
          connections: nextConnections,
        }
      }),
```

with:

```ts
        const nextConnections = pruneStaleConnections(instancesAtFinal, state.connections, SNAP_DISTANCE)

        return {
          instances: instancesAtFinal,
          connections: nextConnections,
        }
      }),
```

`match`/`finalPosition`/`delta` above this are unchanged — `movePiece` still uses `match` to compute the position-snap nudge, it just no longer turns that match into a persisted connection.

- [ ] **Step 4: Add `confirmConnection` and `detachConnection`**

Add these two actions to the store object, right after `movePiece`'s closing `}),` and before `setRotation`:

```ts
    // Persists a candidate found by findConnectionCandidates. Re-validates
    // coincidence at click time (SNAP_DISTANCE, same threshold the
    // candidate was found with) in case something else moved a piece
    // between the candidate being rendered and the click landing — if the
    // candidate has gone stale, this silently no-ops rather than
    // persisting a connection whose points aren't actually touching.
    confirmConnection: (candidate) =>
      set((state) => {
        const pieceA = state.instances.find((i) => i.id === candidate.pieceAId)
        const pieceB = state.instances.find((i) => i.id === candidate.pieceBId)
        if (!pieceA || !pieceB) return state
        if (!isConnectionCoincident(candidate, state.instances, SNAP_DISTANCE)) return state
        return {
          connections: [
            ...state.connections,
            {
              id: `conn-${candidate.pieceAId}-${candidate.pieceBId}-${candidate.pointAIndex}-${candidate.pointBIndex}`,
              ...candidate,
            },
          ],
        }
      }),

    detachConnection: (connectionId) =>
      set((state) => ({
        connections: state.connections.filter((c) => c.id !== connectionId),
      })),

```

- [ ] **Step 5: Run the full check (tsc + full test suite)**

Run: `cd wood-cad-workshop && npx tsc -b && npx vitest run`
Expected: PASS, no type errors, all existing tests green — including `sceneSessionStore.test.ts`'s `movePiece` tests, none of which assert that dragging two previously unconnected pieces close together creates a new connection (they either seed connections directly via `setState` or place the second piece far enough away that no match is possible), so removing the auto-append block does not break any of them.

- [ ] **Step 6: Commit**

```bash
git add wood-cad-workshop/src/store/sceneSessionStore.ts
git commit -m "feat: replace movePiece auto-connect with explicit confirmConnection/detachConnection"
```

---

### Task 3: Render candidate and confirmed markers with click-to-confirm/detach

**Files:**
- Modify: `wood-cad-workshop/src/scene/ConnectionMarkers.tsx`

**Interfaces:**
- Consumes: `findConnectionCandidates`, `SNAP_DISTANCE` (Task 1, via the `../engine` barrel), `confirmConnection`, `detachConnection` (Task 2, via `useSceneSession`).
- Produces: no new exports — this is the final task, a leaf UI component. No later task depends on it.

This is UI/rendering code — per this project's established convention (matching every other `scene/*.tsx` component, none of which have test files), left untested. Verify via `tsc` + manual smoke test, deferred per the Global Constraints note (user is batching manual verification for the end of this session).

- [ ] **Step 1: Replace `ConnectionMarkers.tsx`'s contents**

Replace the full contents of `wood-cad-workshop/src/scene/ConnectionMarkers.tsx` with:

```tsx
import type { ThreeEvent } from '@react-three/fiber'
import { findConnectionCandidates, getConnectionPoints, SNAP_DISTANCE, toWorldPoint } from '../engine'
import type { ConnectionCandidate } from '../engine'
import { useSceneSession } from '../store/sceneSessionStore'

// Bigger than the piece geometry it sits on top of, and bigger than the
// old 0.3-radius marker — an easier touch target for both the
// candidate-confirm and connection-detach clicks below.
const MARKER_RADIUS = 0.5
const CANDIDATE_COLOR = '#ff8c00'
const CONNECTED_COLOR = '#d9342b'

// One marker per active Connection, plus one per not-yet-confirmed
// candidate (two unclaimed, compatible points within SNAP_DISTANCE of
// each other) — both hidden during exploded view, same as the rotation
// gizmo and vertical-move handle in Piece.tsx.
export function ConnectionMarkers() {
  const instances = useSceneSession((s) => s.instances)
  const connections = useSceneSession((s) => s.connections)
  const explodeAmount = useSceneSession((s) => s.explodeAmount)
  const confirmConnection = useSceneSession((s) => s.confirmConnection)
  const detachConnection = useSceneSession((s) => s.detachConnection)

  if (explodeAmount > 0) return null

  const midpointOf = (
    pieceAId: string,
    pointAIndex: number,
    pieceBId: string,
    pointBIndex: number,
  ): [number, number, number] | null => {
    const pieceA = instances.find((i) => i.id === pieceAId)
    const pieceB = instances.find((i) => i.id === pieceBId)
    if (!pieceA || !pieceB) return null
    const localA = getConnectionPoints(pieceA)[pointAIndex]
    const localB = getConnectionPoints(pieceB)[pointBIndex]
    if (!localA || !localB) return null
    const worldA = toWorldPoint(pieceA, localA)
    const worldB = toWorldPoint(pieceB, localB)
    return [(worldA[0] + worldB[0]) / 2, (worldA[1] + worldB[1]) / 2, (worldA[2] + worldB[2]) / 2]
  }

  // Stops the click/pointerdown from also reaching Scene.tsx's ground
  // plane behind the marker, which would otherwise deselect the
  // currently-selected piece as a side effect of confirming/detaching.
  const stop = (e: ThreeEvent<PointerEvent> | ThreeEvent<MouseEvent>) => e.stopPropagation()

  const candidates = findConnectionCandidates(instances, connections, SNAP_DISTANCE)

  const candidateKey = (c: ConnectionCandidate) =>
    `candidate-${c.pieceAId}-${c.pointAIndex}-${c.pieceBId}-${c.pointBIndex}`

  return (
    <>
      {candidates.map((candidate) => {
        const midpoint = midpointOf(candidate.pieceAId, candidate.pointAIndex, candidate.pieceBId, candidate.pointBIndex)
        if (!midpoint) return null
        return (
          <mesh
            key={candidateKey(candidate)}
            position={midpoint}
            onPointerDown={stop}
            onClick={(e: ThreeEvent<MouseEvent>) => {
              stop(e)
              confirmConnection(candidate)
            }}
          >
            <sphereGeometry args={[MARKER_RADIUS, 12, 12]} />
            <meshStandardMaterial color={CANDIDATE_COLOR} />
          </mesh>
        )
      })}
      {connections.map((connection) => {
        const midpoint = midpointOf(connection.pieceAId, connection.pointAIndex, connection.pieceBId, connection.pointBIndex)
        if (!midpoint) return null
        return (
          <mesh
            key={connection.id}
            position={midpoint}
            onPointerDown={stop}
            onClick={(e: ThreeEvent<MouseEvent>) => {
              stop(e)
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

- [ ] **Step 2: Run the full check (tsc + full test suite)**

Run: `cd wood-cad-workshop && npx tsc -b && npx vitest run`
Expected: PASS, no type errors, all tests green (this task adds no new automated tests).

- [ ] **Step 3: Commit**

```bash
git add wood-cad-workshop/src/scene/ConnectionMarkers.tsx
git commit -m "feat: render click-to-confirm candidate and click-to-detach connection markers"
```

---

## Manual verification (deferred — batch with other pending checks per the user's request)

1. Drag two unconnected pieces close together, then let go — an orange orb appears at the joint; no connection has formed yet (rigid group movement doesn't apply between them).
2. Click the orange orb — it turns red, and dragging either piece now moves both together (rigid group movement applies).
3. Click a red orb — the connection is removed, the orb disappears, and dragging one piece again leaves the other behind.
4. Drag a piece close to another, then drag it away again before clicking — the orange orb disappears with it; no connection was ever created.
5. Drag a piece into range of two other pieces' free ends at once — two independent orange orbs appear; clicking one to confirm doesn't affect or remove the other candidate.
6. Build the pull-up kit, confirm both bar-to-post joints via their orange orbs, then drag the bar — both posts should move with it (rigid group movement still works once explicitly confirmed).
