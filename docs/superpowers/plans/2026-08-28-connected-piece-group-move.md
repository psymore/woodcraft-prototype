# Connected-Piece Rigid Group Movement Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** When a piece connected to others is dragged (body drag or the vertical-move handle), every piece transitively reachable through the `Connection` graph moves with it by the same delta, preserving relative offsets exactly.

**Architecture:** Add a pure BFS helper `getConnectedPieceIds` to `engine/core/connections.ts` that returns a connection-graph component as a `Set<string>`. Extend `movePiece` in `store/sceneSessionStore.ts` to compute the dragged piece's actual displacement (`finalPosition - movingInstance.position`) and apply that same delta to every other member of its connected set, after the existing snap/prune logic runs unchanged.

**Tech Stack:** TypeScript, Zustand, Vitest (existing project stack — no new dependencies).

**Spec:** [docs/superpowers/specs/2026-08-28-connected-piece-group-move-design.md](../specs/2026-08-28-connected-piece-group-move-design.md)

## Global Constraints

- `getConnectedPieceIds` lives in `wood-cad-workshop/src/engine/core/connections.ts` and must not import `three` — this file is part of the `engine/core` pure-function layer (no framework imports), matching every existing function in that file.
- `movePiece`'s existing snap-delta, pre-snap prune, and post-snap prune behavior is unchanged — the group-translation step is purely additive, inserted after `finalPosition` is already computed.
- Only position is made rigid across the group — rotation, Stand Up, and resize remain per-piece, per the spec's "Explicitly out of scope" section. Do not touch `setRotation`, `rotateSelected`, `standSelectedUp`, or `changeDimensions`.
- While dragging, only the grabbed piece's own anchor points are searched for a new connection match (`findClosestConnectionMatch(moving, position, ...)` stays called with the single `moving` instance) — other pieces riding along in the same rigid move do not also search for new connections.
- `getConnectedPieceIds` gets unit tests (pure `engine/core` convention); the `movePiece` store change does not (established store-orchestration convention followed by every prior task in this initiative).

---

### Task 1: `getConnectedPieceIds` pure BFS helper

**Files:**
- Modify: `wood-cad-workshop/src/engine/core/connections.ts`
- Test: `wood-cad-workshop/src/engine/core/connections.test.ts`

**Interfaces:**
- Consumes: `Connection` type from `./types` (already imported in this file — `{ id, pieceAId, pieceBId, pointAIndex, pointBIndex }`).
- Produces: `export function getConnectedPieceIds(pieceId: string, connections: Connection[]): Set<string>` — for Task 2 (`movePiece`) to call. Returns the full connected component reachable from `pieceId` via the `connections` edge list, **including `pieceId` itself**. Treats each `Connection` as an undirected edge between `pieceAId` and `pieceBId`. Cycle-safe (visited-set guarded).

- [ ] **Step 1: Write the failing tests**

Add to `wood-cad-workshop/src/engine/core/connections.test.ts`, after the existing `pruneStaleConnections` describe block:

```ts
describe('getConnectedPieceIds', () => {
  it('returns just the piece itself when it has no connections', () => {
    const connections: Connection[] = []
    expect(getConnectedPieceIds('a', connections)).toEqual(new Set(['a']))
  })

  it('includes a single directly connected piece', () => {
    const connections: Connection[] = [
      { id: 'c1', pieceAId: 'a', pieceBId: 'b', pointAIndex: 0, pointBIndex: 0 },
    ]
    expect(getConnectedPieceIds('a', connections)).toEqual(new Set(['a', 'b']))
  })

  it('follows a transitive chain A-B-C-D starting from either end', () => {
    const connections: Connection[] = [
      { id: 'c1', pieceAId: 'a', pieceBId: 'b', pointAIndex: 0, pointBIndex: 0 },
      { id: 'c2', pieceAId: 'b', pieceBId: 'c', pointAIndex: 1, pointBIndex: 0 },
      { id: 'c3', pieceAId: 'c', pieceBId: 'd', pointAIndex: 1, pointBIndex: 0 },
    ]
    expect(getConnectedPieceIds('a', connections)).toEqual(new Set(['a', 'b', 'c', 'd']))
    expect(getConnectedPieceIds('d', connections)).toEqual(new Set(['a', 'b', 'c', 'd']))
  })

  it('follows a branch — one piece connected to two others', () => {
    const connections: Connection[] = [
      { id: 'c1', pieceAId: 'bar', pieceBId: 'postLeft', pointAIndex: 0, pointBIndex: 0 },
      { id: 'c2', pieceAId: 'bar', pieceBId: 'postRight', pointAIndex: 1, pointBIndex: 0 },
    ]
    expect(getConnectedPieceIds('postLeft', connections)).toEqual(
      new Set(['bar', 'postLeft', 'postRight']),
    )
  })

  it('terminates and returns the correct set when the graph has a cycle', () => {
    const connections: Connection[] = [
      { id: 'c1', pieceAId: 'a', pieceBId: 'b', pointAIndex: 0, pointBIndex: 0 },
      { id: 'c2', pieceAId: 'b', pieceBId: 'c', pointAIndex: 1, pointBIndex: 0 },
      { id: 'c3', pieceAId: 'c', pieceBId: 'a', pointAIndex: 1, pointBIndex: 1 },
    ]
    expect(getConnectedPieceIds('a', connections)).toEqual(new Set(['a', 'b', 'c']))
  })

  it('does not include pieces from a disconnected component', () => {
    const connections: Connection[] = [
      { id: 'c1', pieceAId: 'a', pieceBId: 'b', pointAIndex: 0, pointBIndex: 0 },
      { id: 'c2', pieceAId: 'x', pieceBId: 'y', pointAIndex: 0, pointBIndex: 0 },
    ]
    expect(getConnectedPieceIds('a', connections)).toEqual(new Set(['a', 'b']))
  })
})
```

Also add `getConnectedPieceIds` to the import line at the top of the test file:

```ts
import { isConnectionCoincident, pruneStaleConnections, getConnectedPieceIds } from './connections'
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd wood-cad-workshop && npx vitest run src/engine/core/connections.test.ts`
Expected: FAIL — `getConnectedPieceIds` is not exported / not defined.

- [ ] **Step 3: Implement `getConnectedPieceIds`**

Add to `wood-cad-workshop/src/engine/core/connections.ts`, after `pruneStaleConnections`:

```ts
// Breadth-first traversal of the connection graph (each Connection is an
// undirected edge between pieceAId and pieceBId), starting from pieceId.
// Returns the full connected component, including pieceId itself —
// visited-set-guarded so a cycle in the graph terminates normally.
export function getConnectedPieceIds(pieceId: string, connections: Connection[]): Set<string> {
  const visited = new Set<string>([pieceId])
  const queue = [pieceId]

  while (queue.length > 0) {
    const current = queue.shift() as string
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
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd wood-cad-workshop && npx vitest run src/engine/core/connections.test.ts`
Expected: PASS, all cases including the new `getConnectedPieceIds` describe block.

- [ ] **Step 5: Run the full check (tsc + full test suite)**

Run: `cd wood-cad-workshop && npx tsc -b && npx vitest run`
Expected: PASS, no type errors, all tests green.

- [ ] **Step 6: Commit**

```bash
git add wood-cad-workshop/src/engine/core/connections.ts wood-cad-workshop/src/engine/core/connections.test.ts
git commit -m "feat: add getConnectedPieceIds BFS helper for connection graph traversal"
```

---

### Task 2: Rigid group translation in `movePiece`

**Files:**
- Modify: `wood-cad-workshop/src/store/sceneSessionStore.ts`

**Interfaces:**
- Consumes: `getConnectedPieceIds(pieceId: string, connections: Connection[]): Set<string>` from Task 1 (exported via `engine/core/connections.ts`, and already re-exported through the `engine/index.ts` barrel via `export * from './core/connections'` — add it to the existing `../engine` import line in this file, same as `pruneStaleConnections` already is).
- Produces: no new public interface — this only changes `movePiece`'s internal behavior. Later tasks (none currently planned) would consume the fact that `movePiece` now moves connected assemblies together.

This task is store orchestration (Zustand action), not a pure `engine/core` function — per this project's established convention (confirmed in the spec's Testing section and every prior task in this initiative), it is implemented directly with manual/browser verification, not unit tests.

- [ ] **Step 1: Add `getConnectedPieceIds` to the store's import from `../engine`**

In `wood-cad-workshop/src/store/sceneSessionStore.ts`, update the import block:

```ts
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

- [ ] **Step 2: Extend `movePiece` to apply the group delta**

Replace the current `movePiece` body:

```ts
    movePiece: (id, position) =>
      set((state) => {
        const moving = state.instances.find((i) => i.id === id)
        if (!moving) return state

        const instancesAtProposed = state.instances.map((i) => (i.id === id ? { ...i, position } : i))
        const survivingConnections = pruneStaleConnections(instancesAtProposed, state.connections, SNAP_DISTANCE)

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

        const instancesAtFinal = state.instances.map((i) => (i.id === id ? { ...i, position: finalPosition } : i))
        // Re-prune against the FINAL (post-snap) position: the snap
        // correction above can be up to SNAP_DISTANCE and can move a
        // different anchor point on this same piece out of range of an
        // unrelated surviving connection, so the first prune (against the
        // pre-snap position) isn't sufficient on its own.
        let nextConnections = pruneStaleConnections(instancesAtFinal, survivingConnections, SNAP_DISTANCE)

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
    movePiece: (id, position) =>
      set((state) => {
        const moving = state.instances.find((i) => i.id === id)
        if (!moving) return state

        const instancesAtProposed = state.instances.map((i) => (i.id === id ? { ...i, position } : i))
        const survivingConnections = pruneStaleConnections(instancesAtProposed, state.connections, SNAP_DISTANCE)

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

        // The dragged piece's real displacement this call, including any
        // snap correction — every other member of its connected assembly
        // rides along by exactly this much, so relative offsets (and their
        // own connections to each other) are preserved.
        const delta: [number, number, number] = [
          finalPosition[0] - moving.position[0],
          finalPosition[1] - moving.position[1],
          finalPosition[2] - moving.position[2],
        ]
        const groupIds = getConnectedPieceIds(id, survivingConnections)

        const instancesAtFinal = state.instances.map((i) => {
          if (i.id === id) return { ...i, position: finalPosition }
          if (!groupIds.has(i.id)) return i
          return {
            ...i,
            position: [i.position[0] + delta[0], i.position[1] + delta[1], i.position[2] + delta[2]] as [
              number,
              number,
              number,
            ],
          }
        })
        // Re-prune against the FINAL (post-snap, post-group-translation)
        // positions: the snap correction above can be up to SNAP_DISTANCE
        // and can move a different anchor point out of range of an
        // unrelated surviving connection, so the first prune (against the
        // pre-snap position) isn't sufficient on its own. Every group
        // member moved by the same delta, so connections *within* the
        // group survive this pass unchanged; only connections to pieces
        // outside the group (now left behind) can be pruned here.
        let nextConnections = pruneStaleConnections(instancesAtFinal, survivingConnections, SNAP_DISTANCE)

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

- [ ] **Step 3: Run the full check (tsc + full test suite)**

Run: `cd wood-cad-workshop && npx tsc -b && npx vitest run`
Expected: PASS, no type errors, all existing tests still green (this task adds no new automated tests — `movePiece` is store orchestration, verified manually in Step 4).

- [ ] **Step 4: Manual verification (user, in-browser)**

Run: `cd wood-cad-workshop && npm run dev`, open the app, and walk through the spec's 6-item checklist:

1. Connect two boards end-to-end, then drag one — the other should move with it, maintaining the same relative offset and connection marker.
2. Build a 3+ piece chain (e.g. board–board–board, each end-connected to the next) and drag one end piece — the whole chain should move together.
3. Build the pull-up kit (bar connected to both posts) and drag the bar — both posts should move with it.
4. Rotate one piece in a connected pair — only that piece should rotate; the connection should break (marker disappears) rather than the group rotating together, matching existing rotate-breaks-connection behavior.
5. Drag a piece that is connected to a chain, close enough to a *third*, unconnected piece to form a new connection — the new connection should form correctly and the rest of the dragged chain should still have moved together.
6. Use the vertical-move handle (not just horizontal drag) on a connected piece — its connected assembly should rise/fall with it too.

**Do not report this task as complete until the user has confirmed all 6 items pass.** Per this project's standing rule, never assume "tested"/"working" without explicit manual user confirmation.

- [ ] **Step 5: Commit**

```bash
git add wood-cad-workshop/src/store/sceneSessionStore.ts
git commit -m "feat: move connected pieces together as a rigid group when dragged"
```

---

## Post-plan housekeeping (after both tasks are merged)

Update `docs/superpowers/plans/ACTIVE-WORK-vscode.md`'s "Next action" bullet to record this feature as complete and reflect the remaining deferred follow-ups (detach button, face-based connection points, better connector visual), per this repo's continuity-record convention.
