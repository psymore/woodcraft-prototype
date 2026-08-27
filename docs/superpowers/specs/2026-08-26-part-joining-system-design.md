# Part Joining / Connection System (Sub-project: 3D Editor Next Steps, Step 4)

Status: approved, implementation pending.

## Context

This is step 4 of the user-directed "3D editor next steps" initiative
(rotation gizmo → theme system → vertical/stand-up action → part joining →
z-fighting fix; step 2 skipped for now, step 3 already pulled forward and
completed alongside step 1 — see
[2026-08-26-transform-gizmo-rotation-design.md](2026-08-26-transform-gizmo-rotation-design.md)).

Today, `wood-cad-workshop` has no persisted notion of two pieces being
joined. `engine/core/connectionPoints.ts` already defines per-piece local
anchor points (`getConnectionPoints`, keyed by `ConnectionRole: 'ends' |
'single' | 'none'`) and a drag-time proximity nudge
(`findConnectionSnapDelta`, `SNAP_DISTANCE = 3`), but this is purely a
one-shot position assist recomputed every drag frame — nothing records
that two pieces *are* connected, so there is no way to query, remove, or
visually confirm a joint, and rotation is never touched by it.

This step adds a real, persisted `Connection` record between two pieces'
anchor points, created automatically when they snap together and broken
automatically when they're dragged apart, plus a small visual marker at
each active connection.

## Explicitly out of scope for this step

- **Rotation alignment.** Connecting two pieces only snaps *position*,
  matching `findConnectionSnapDelta`'s existing scope. Auto-orienting a
  piece's rotation to sit flush against another (e.g. a bracket's face
  turning to match a board's face) is the product design doc's separately
  ranked "joint hinting" feature (#5 in its wow/effort list) — a later
  pass, not this one.
- **Moving connected pieces together.** A connection is a soft,
  break-on-separation relationship, not a rigid link — dragging one
  connected piece moves only that piece, silently breaking the connection
  once its anchor points move out of range. Multi-piece rigid movement is
  the product design doc's separate, not-yet-built `Group` concept (one
  level deep, no nesting) — conflating the two would blur what each is for.
- **An explicit "remove connection" UI action.** Since connections break
  by dragging pieces apart, no separate remove control is added this pass.
- **Face-based connection points** (e.g. a shelf's end resting mid-span on
  another board's face, for T-joints). `getConnectionPoints` still only
  returns `'ends'` (two Z-extreme points) and `'single'` (one center
  point) — this step extends the connection *lifecycle*, not the anchor
  *geometry*.

## Data model

A new `Connection` interface in `engine/core/types.ts`:

```ts
export interface Connection {
  id: string
  pieceAId: string
  pieceBId: string
  pointAIndex: number // index into getConnectionPoints(pieceA)
  pointBIndex: number // index into getConnectionPoints(pieceB)
}
```

`SceneSessionState` gains `connections: Connection[]` (default `[]`).
Invariant: a given `(pieceId, pointIndex)` pair appears in at most one
`Connection` at a time — one physical end can only be joined to one other
piece at once. This is enforced at creation time (see below), not with a
separate validation pass.

## Connection lifecycle (pure logic, `engine/core/connections.ts`)

A new file, since this is a distinct concern (persisted pairs and their
lifecycle) from `connectionPoints.ts` (per-piece anchor geometry and the
existing drag-time delta calculation) — keeping each file to one
responsibility.

- `findClosestConnectionMatch(movingInstance, proposedPosition, allInstances, existingConnections)`
  → `{ otherId, movingPointIndex, otherPointIndex, delta } | null`.
  `connectionPoints.ts`'s existing point-pair search loop is extracted
  into this shared implementation (candidate points already claimed by
  `existingConnections` are excluded), and `findConnectionSnapDelta` — the
  function `movePiece` already calls — becomes a thin wrapper that returns
  just `.delta`. Its signature, behavior, and existing tests are
  unchanged.
- `isConnectionCoincident(connection, instances, threshold)` → `boolean`.
  Looks up both pieces, computes both anchor points' world positions via
  the existing `toWorldPoint`, and checks whether they're still within
  `threshold` of each other. `connectionPoints.ts`'s `SNAP_DISTANCE`
  constant is exported and reused here as the break threshold too, rather
  than introducing a second magic number — if this produces flicker right
  at the boundary during manual testing, hysteresis (a larger break
  distance than snap distance) is a cheap follow-up, not a blocker now.

## Store integration

`sceneSessionStore.ts`'s `movePiece(id, position)` is extended (its
existing snap-delta behavior is unchanged, just followed by two new
steps):

1. After computing `finalPosition` (as today), filter `state.connections`:
   any connection touching `id` whose `isConnectionCoincident(...)` is now
   `false` is dropped.
2. Call `findClosestConnectionMatch` (passing the *surviving* connections
   from step 1, so a just-broken point becomes available again in the same
   move) — if it returns a match not already present, append a new
   `Connection` with a fresh id.

`deleteSelected` additionally filters out any connection referencing the
deleted piece, so no connection ever dangles on a missing id.
`duplicateSelected` is unchanged — a fresh duplicate starts with no
connections, matching its existing "spawn at an offset, touching nothing"
behavior.

## Visual marker

A new `scene/ConnectionMarkers.tsx`, mounted in `Scene.tsx` alongside the
existing `instances.map(...)` piece rendering. For each `Connection`, it
looks up both pieces, computes each side's world anchor point (same
`toWorldPoint` + `getConnectionPoints` calls used above), and renders a
small dark sphere at their midpoint (they should be coincident by
construction; averaging is just defensive against any float drift).
Hidden whenever `explodeAmount > 0`, matching the existing guard used for
the rotation gizmo and the vertical-move handle — exploded view already
means "pulled apart," so a joint marker sitting there would misread.

## Testing

`findClosestConnectionMatch` and `isConnectionCoincident` are pure
`engine/core` functions — new coverage in `connections.test.ts`, following
`connectionPoints.test.ts`'s existing style (registry-backed fixture
pieces, `beforeEach` registry reset). `findConnectionSnapDelta`'s existing
tests are unaffected since its signature and behavior don't change.
Store wiring (`movePiece`'s two new steps, `deleteSelected`'s filter) and
the marker component follow this project's established convention of
leaving Zustand-store orchestration and pointer/render UI untested —
consistent with every prior step in this initiative.

## Manual verification (user, after implementation)

1. Drag two "ends"-role pieces (e.g. two boards) until their ends snap
   together — a small dark marker should appear at the joint.
2. Drag one of them away — the marker should disappear once they separate
   past the snap distance.
3. Build the pull-up kit (bar + two posts + two feet) and confirm markers
   appear at both bar-to-post joints.
4. Drag a third piece's end close to an already-connected end — it should
   not steal or duplicate that connection (the occupied point is skipped).
5. Delete a connected piece — its marker(s) should disappear with it, with
   no leftover/orphaned marker.
6. Toggle exploded view — markers should hide while exploded and
   reappear correctly once reassembled.
