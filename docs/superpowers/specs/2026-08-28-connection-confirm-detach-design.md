# Explicit Connection Confirm / Detach

Status: implemented.

## Context

Today (per
[2026-08-26-part-joining-system-design.md](2026-08-26-part-joining-system-design.md)
and [2026-08-28-connected-piece-group-move-design.md](2026-08-28-connected-piece-group-move-design.md)),
two pieces connect automatically: whenever a drag brings one piece's
connection point within `SNAP_DISTANCE` of another unclaimed, compatible
point, `movePiece` snaps the dragged piece into exact alignment and
immediately persists a `Connection` record, rendered as a small dark
sphere at the joint. There is no way to undo this short of rotating a
piece (which breaks any connection whose anchor points move out of range
as a side effect) or deleting one of the two pieces.

This step replaces the automatic *connecting* step with an explicit one,
while leaving the automatic *position-snap* nudge alone (pieces still
glide into exact alignment when dragged close — that's drag ergonomics,
not "merging"). When a piece's point is within `SNAP_DISTANCE` of another
unclaimed, compatible point, a bigger orange orb appears at the candidate
joint — whether or not anything is currently being dragged, and it stays
visible at rest until acted on. Clicking it creates the actual persisted
`Connection` (rigid group movement, from the previous step, then applies
to it). Once connected, the same-sized orb turns red; clicking a red orb
detaches — removes — that connection. This also delivers the
part-joining-system spec's deferred "explicit remove-connection UI
action" follow-up, using the marker itself as the control rather than a
separate button.

## Explicitly out of scope for this step

- **Removing the position-snap nudge.** `movePiece`'s existing
  `findClosestConnectionMatch`-driven snap correction (nudging the
  dragged piece into exact alignment with the nearest compatible point)
  is unchanged — only the automatic *persisting* of a `Connection` from
  that match is removed. A piece still glides into place when dragged
  close to another; it just doesn't bond until the orb is clicked.
- **Changing how connections break.** Rotation/Stand-Up/resize still
  silently prune out-of-range connections exactly as they do today
  (`pruneStaleConnections`). This step adds an *explicit* way to break a
  connection (clicking its red orb) alongside the existing *implicit*
  ways — it doesn't touch the implicit ones.
- **A more legible connector shape** (nail/bolt/bracket instead of a
  sphere) — still separately deferred, per the part-joining-system
  spec's follow-up list. This step changes color and size, not shape.
- **Multi-select / batch confirm.** Each candidate and each connection
  gets its own independently clickable orb; there is no "confirm all"
  or "detach all" action.

## Design

### `findConnectionCandidates` (pure, `engine/core/connections.ts`)

```ts
export interface ConnectionCandidate {
  pieceAId: string
  pieceBId: string
  pointAIndex: number
  pointBIndex: number
}

export function findConnectionCandidates(
  instances: ComponentInstance[],
  connections: Connection[],
  threshold: number,
): ConnectionCandidate[]
```

Scene-wide version of the point-pair search `findClosestConnectionMatch`
already does for one dragged piece: for every pair of *unclaimed* points
(points not already used by an entry in `connections`) across all
`instances`, find the ones within `threshold` of each other. Same "closest
wins, no point claimed by more than one candidate" rule as today — if a
free point is within range of two different points, only the closer
pairing becomes a candidate, leaving the point on the losing side free to
pair with something else (or nothing). Implemented as its own pass over
all instances (not a thin wrapper around `findClosestConnectionMatch`,
which is anchored to one "moving" piece) but reusing
`getConnectionPoints`/`toWorldPoint` exactly as that function does.

### Store changes (`store/sceneSessionStore.ts`)

- **`movePiece`** loses its "append a new `Connection` when
  `findClosestConnectionMatch` returns a hit" step (the `if (match) {
  nextConnections = [...] }` block). Everything else about `movePiece` —
  the position-snap correction itself, rigid group translation, and the
  post-move prune — is unchanged.
- **`confirmConnection(candidate: ConnectionCandidate)`** (new): looks up
  both pieces by id; if either is missing, or the two points are no
  longer within `SNAP_DISTANCE` (re-validated at click time, in case
  something else moved a piece between the candidate being rendered and
  the click landing), no-ops. Otherwise appends a new `Connection` with
  the same id-generation scheme `movePiece` used to use
  (`conn-${pieceAId}-${pieceBId}-${pointAIndex}-${pointBIndex}`).
- **`detachConnection(connectionId: string)`** (new): removes the
  matching entry from `connections`. No other state changes — the two
  pieces stay exactly where they are.

### Rendering (`scene/ConnectionMarkers.tsx`)

Renders two derived lists side by side, both recomputed from store state
on every render (no new persisted state beyond the `Connection` records
`confirmConnection`/`detachConnection` already manage):

- **Pending candidates** — `findConnectionCandidates(instances,
  connections, SNAP_DISTANCE)`, one bigger (radius 0.5, up from today's
  0.3) orange sphere per candidate at the midpoint of its two (not yet
  coincident, since they're only within range, not touching) points.
  `onClick` calls `confirmConnection` with that candidate.
- **Confirmed connections** — same as today's list, but the sphere grows
  to the same radius 0.5 and turns red instead of `#2b2b2b`. `onClick`
  calls `detachConnection` with that connection's id.

Both stay hidden during exploded view, matching the existing guard.

## Testing

`findConnectionCandidates` is pure `engine/core` logic — new coverage in
`connections.test.ts`, following the existing fixture style (registry-backed
`rodDefinition`/`footDefinition`, `beforeEach` reset): no unclaimed points
nearby → empty array; one unclaimed pair within threshold → one candidate;
a pair whose points are already claimed by an existing `Connection` →
excluded even though they're coincident; a point within range of two
different unclaimed points → only the closer pairing becomes a candidate,
the other point stays free.

`confirmConnection` and `detachConnection` are simple, single-purpose
store actions with no traversal or derived math (unlike `movePiece`'s
group-translation logic, which earned a scoped testing exception in the
previous step after two real bugs) — left untested per this project's
established store-orchestration convention. `movePiece`'s existing
`sceneSessionStore.test.ts` coverage is unaffected by removing the
auto-append block: none of its current cases assert that dragging two
previously unconnected pieces close together creates a connection, so no
test needs updating.

## Manual verification (user, after implementation)

1. Drag two unconnected pieces close together, then let go — an orange
   orb appears at the joint; no connection has formed yet (rigid group
   movement doesn't apply between them).
2. Click the orange orb — it turns red, and dragging either piece now
   moves both together (rigid group movement applies).
3. Click a red orb — the connection is removed, the orb disappears, and
   dragging one piece again leaves the other behind.
4. Drag a piece close to another, then drag it away again before
   clicking — the orange orb disappears with it; no connection was ever
   created.
5. Drag a piece into range of two other pieces' free ends at once — two
   independent orange orbs appear; clicking one to confirm doesn't affect
   or remove the other candidate.
6. Build the pull-up kit, confirm both bar-to-post joints via their orange
   orbs, then drag the bar — both posts should move with it (rigid group
   movement still works once explicitly confirmed).
7. Quickly double-tap an orange orb (confirm, then immediately tap again
   where the now-red marker appears) — the connection should stay
   confirmed, not silently detach.
