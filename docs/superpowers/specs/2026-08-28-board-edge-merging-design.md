# Board Edge-to-Edge Merging (Sub-project A)

Status: approved, implementation pending.

## Context

Today, `getConnectionPoints` (`engine/core/connectionPoints.ts`) only returns
anchor points at a piece's length-wise ends (`'ends'` role) or its center
(`'single'` role) — two boards can only join tip-to-tip. This is the first
of three sub-projects splitting the user's "make all edges mergeable, not
just tips" request:

- **Sub-project A (this spec):** box-shaped pieces can also join along
  their long side edges (e.g. two same-length boards laid side by side to
  form a wider panel), using the same discrete-point model the whole
  connection system (part-joining, rigid group move, confirm/detach) is
  already built on.
- **Sub-project B (later, separate spec):** T-joints — a piece's end
  touching *anywhere* along another piece's face — needs real
  point-to-line-segment geometry, a materially different matching model
  from today's point-to-point one. Deferred to its own design round.
- **Sub-project C (later, separate spec):** cylinder (rod) edge support —
  a rod has no flat face or corner, so "edge" needs its own definition
  (most likely closest-point-on-centerline), different math again. Proven
  out only after boxes work.

## Explicitly out of scope for this step

- **T-joints and cylinder edges** — see Sub-projects B and C above.
- **Point-type tagging.** Anchor points aren't tagged "tip" vs "edge" —
  an edge-center point can in principle also snap-match against another
  piece's tip point if they land close together. Geometrically unusual
  (not a proper edge-to-edge or end-to-end join) but not broken, since
  confirming still forces exact coincidence via `confirmConnection`'s
  existing gap-closing translation. Shipping the simple version first;
  point-type filtering is a fast follow-up if this actually causes
  confusing pairings in practice, not a preemptive addition.
- **Offset/partial edge overlap.** Only one discrete anchor per long edge
  (its center) — two boards edge-glue cleanly when their centers land
  within `SNAP_DISTANCE` of each other, i.e. same or near-same length.
  Sliding a shorter board to different offsets along a longer one's edge
  is a continuous-position problem, out of scope for the discrete-point
  model (same reasoning as the T-joint deferral).

## Design

### `getConnectionPoints` (`engine/core/connectionPoints.ts`)

For the `'ends'` case, when the piece's `geometry.shape === 'box'` (checked
structurally against the piece's `ComponentDefinition`, not a hardcoded
component-id list — applies automatically to `board`, `squareBeam`,
`verticalPost` today and any future box `'ends'` component without further
changes), two more points are appended after the existing two length-end
points:

```ts
case 'ends': {
  const points: [number, number, number][] = [
    [0, 0, -length / 2],
    [0, 0, length / 2],
  ]
  if (definition.geometry.shape === 'box') {
    const { width } = instance.dimensions
    points.push([0, -width / 2, 0], [0, width / 2, 0])
  }
  return points
}
```

(Local axes, per `getBoxSize`: X = thickness, Y = width, Z = length — so
these new points sit at the center of each of the two long side edges,
each spanning the piece's full length.) Cylinder `'ends'` pieces (rods)
are completely unaffected — still exactly the 2 end points they return
today. Existing indices 0/1 (the two ends) are unchanged; the new points
are appended at indices 2/3, so nothing that already assumes "index 0/1 =
the two ends" (several comments across the codebase do) needs updating.

### Why nothing else changes

Every other piece of the connection system already operates generically
over "however many points `getConnectionPoints` returns" — none of it
hardcodes a count of 2:

- `findClosestConnectionMatch` / `findConnectionSnapDelta`
  (drag-time position snap) iterate over both pieces' full point lists.
- `findConnectionCandidates` (the orange-orb scan) and `isConnectionCoincident`
  / `pruneStaleConnections` (lifecycle) are the same — no point-count
  assumption anywhere.
- `ConnectionMarkers.tsx`'s rendering and `confirmConnection`'s
  gap-closing translation key off whatever `pointAIndex`/`pointBIndex` a
  `Connection` or `ConnectionCandidate` names, not a fixed range.

So once the anchor data exists, edge-to-edge candidates, snapping,
confirming, and detaching all work with no further code changes — this
spec's only diff is the `getConnectionPoints` addition above.

## Testing

New test in `connectionPoints.test.ts`'s existing `describe('getConnectionPoints', ...)`
block: a box `'ends'` fixture (new, since the file's current `rodDefinition()`
is a cylinder) returns exactly 4 points — the 2 existing length-ends
unchanged, plus the 2 new edge-centers at the correct `width`-derived
values. The existing cylinder `'ends'` test is untouched and still expects
2 points.

## Manual verification (user, after implementation)

1. Place two same-length boards side by side so their long edges nearly
   touch (within `SNAP_DISTANCE`) — an orange orb should appear at the
   edge midpoint, same as an end-to-end candidate does today.
2. Click to confirm — the boards snap into exact edge contact (no visible
   gap), forming a flush wider panel; the orb turns red.
3. Existing end-to-end board behavior (drag two boards tip to tip) still
   works exactly as before — unaffected by this change.
4. Place a rod (cylinder) near a board's long edge — no edge-candidate orb
   should appear (only the rod's own 2 end points participate, as today).
