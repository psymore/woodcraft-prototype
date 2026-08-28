# Connection Anchor Primitives — Point, Segment, Face

Status: approved, implementation pending.

## Context

The connection system built earlier this session (part-joining, rigid
group movement, confirm/detach) matches pieces purely point-to-point:
`getConnectionPoints` returns a short, fixed array of local coordinates
per piece (currently just the two length-wise ends), and every matching
function compares raw Euclidean distance between one piece's point and
another's. The user found this too rigid for building furniture, sports
equipment, and assemblies with varied joints (L-brackets, T-joints,
edge-to-edge panels) — pieces can currently only join at a handful of
exact fixed positions.

This was investigated properly rather than guessed at, across two rounds
of research:

- **This repo's own canonical design doc**
  ([2026-08-20-woodcraft-prototype-design.md](2026-08-20-woodcraft-prototype-design.md))
  already specifies the intended anchor set as "corners, edge midpoints,
  face centers, end centers... the single most important abstraction in
  the system," ranks "anchor-based smart snapping (edge/face/end)" as the
  #1 differentiator, and explicitly defers real CSG/joinery geometry
  ("resist scope creep here"). The fix was never "build full mesh
  contact" — the anchor set is simply much sparser than the product's own
  design already called for.
- **External prior art** (SketchUp's inference engine, Fusion 360/Onshape
  assembly joints, and building games — Scrap Mechanic, Besiege, Space
  Engineers, Fortnite/UEFN) confirmed essentially every comparable tool
  uses small, precomputed, typed attachment points/slots, not live
  mesh-contact queries — validating extending the anchor model rather
  than replacing its architecture.
- **Computational geometry research** confirmed point-to-segment and
  point-to-face closest-point matching are cheap, well-known, closed-form
  (a handful of lines each), while segment-to-segment and face-to-face are
  a real complexity jump (Lumelsky's algorithm; SAT/GJK-class collision
  detection) — worth deferring.

This spec **supersedes**
[2026-08-28-board-edge-merging-design.md](2026-08-28-board-edge-merging-design.md)'s
implementation approach (never implemented — `getConnectionPoints` still
returns only the 2 end points). That spec's discrete edge-center points
are folded directly into the richer model below rather than shipped first
in the old `[number,number,number][]` shape and touched again immediately
after.

## Explicitly out of scope for this step

- **Segment-to-segment matching** (true edge-to-edge contact at an
  arbitrary offset, e.g. two long boards touching partway along both their
  lengths). Meaningfully harder — real edge-case handling for
  parallel/degenerate cases — and not needed to satisfy "pieces can join
  at more than a few fixed points." A future increment if it proves to
  actually be needed.
- **Face-to-face matching.** Jumps to SAT/GJK-class collision-detection
  complexity unless restricted to exactly-coplanar rectangles. Deferred
  further than segment-to-segment.
- **Rotation-aware "flush" auto-alignment.** Connections stay
  position-only, per this session's established constraint
  ([2026-08-26-part-joining-system-design.md](2026-08-26-part-joining-system-design.md)'s
  own deferral) and the product doc's "decorated snapping logic, no real
  joinery geometry" framing. A user must already have two pieces roughly
  co-planar via their own drag/rotate before a face match reads correctly
  — this step never rotates anything to make one.
- **Joint "type" classification** (Onshape-style declared mate kinds — T-joint
  vs. edge-join vs. butt-join as a first-class, user-visible concept). The
  anchor-kind pairing (point-vs-segment, point-vs-face) already implicitly
  produces a visually plausible result without a new UI surface. A
  possible future "Sub-project D," not this one.
- **Anchor semantic tagging** beyond raw kind (e.g. distinguishing "this
  point is a corner" from "this point is an end" for filtering purposes).
  Same policy the superseded board-edge-merging spec already chose:
  shipping the simple version first.
- **Cylinder (rod) surface anchors.** A rod's centerline is already a
  reusable segment, but landing a contact on its curved *surface* (not
  inside the rod) needs a radius-offset correction — new math, not reuse.
  Still its own increment ("Sub-project C"), though this step halves its
  eventual cost.
- **CSG/notch/mortise-tenon geometry, physics/constraint solving.**
  Reiterated non-goals from the product doc. Nothing in this design
  touches mesh geometry or introduces a solver — connections remain a
  soft, non-destructive relationship between two whole, unmodified
  pieces.

## Design

### Anchor primitives (`engine/core/connectionPoints.ts`)

Each piece's anchor set generalizes from "array of points" to "array of
typed primitives":

```ts
export type Vec3 = [number, number, number]

export type AnchorPrimitive =
  | { kind: 'point'; point: Vec3 }
  | { kind: 'segment'; a: Vec3; b: Vec3 }
  | { kind: 'face'; center: Vec3; uAxis: Vec3; vAxis: Vec3; halfU: number; halfV: number }

export function getAnchors(instance: ComponentInstance): AnchorPrimitive[]
```

`uAxis`/`vAxis` are unit vectors in the piece's local frame (always
axis-aligned to the box's local X/Y/Z, since they're defined before
rotation is applied).

For a box `'ends'` piece (`board`, `squareBeam`, `verticalPost` — decided
structurally by `geometry.shape === 'box'`, same rule the superseded spec
used, not a hardcoded component list), `getAnchors` returns, in order:

1. The 2 existing end-center points (indices 0/1, unchanged — nothing
   that already assumes "index 0/1 = the two ends" needs updating).
2. 2 `segment` anchors — the two long edges at the width extremes
   (`y = ±width/2`), each spanning the full length. These are *additive*
   next to any discrete edge-center point, not a replacement: a discrete
   point solves "two same-length boards, centers aligned" as cheap
   point-point matching; a segment solves the different case of an end
   touching that edge *off-center*.
3. 4 `face` anchors — all four side faces (both wide faces, normal to the
   width axis, and both narrow faces, normal to the thickness axis), each
   spanning the piece's full length × the relevant cross-section
   dimension.

Cylinder `'ends'` pieces (rods) are completely unaffected — still exactly
their 2 end points, per the cylinder-deferral above. `'single'`/`'none'`
role pieces (hardware — `lBracket`, `foot`, `woodScrew`) are unaffected
too: they keep their existing single point or empty array. They
automatically gain the ability to match against *other* pieces' new
segment/face anchors for free, since the dispatch below is generic — no
lBracket/foot-specific code is needed for, say, an L-bracket's point to
snap onto the middle of a board's face.

### Closest-point geometry (`engine/core/geometry.ts`, new)

A new pure module, no `three` import (matching the existing `engine/core`
purity constraint):

```ts
export function closestPointOnSegment(
  p: Vec3, a: Vec3, b: Vec3,
): { point: Vec3; t: number } // t clamped to [0, 1]

export function closestPointOnRect(
  p: Vec3, center: Vec3, uAxis: Vec3, vAxis: Vec3, halfU: number, halfV: number,
): { point: Vec3; u: number; v: number } // u, v independently clamped
```

Both are the standard clamped-projection formulas (project onto the
segment's direction / the face's two in-plane axes via dot products,
clamp each parameter to its valid range, reconstruct the point) — no
iteration, no external dependency. `closestPointOnRect` is
`closestPointOnSegment` applied independently on two orthogonal axes, not
a different algorithm.

### World-space matching (`engine/core/connectionPoints.ts`)

```ts
export type WorldAnchor =
  | { kind: 'point'; point: Vec3 }
  | { kind: 'segment'; a: Vec3; b: Vec3 }
  | { kind: 'face'; center: Vec3; uAxis: Vec3; vAxis: Vec3; halfU: number; halfV: number }

export function toWorldAnchor(instance: ComponentInstance, anchor: AnchorPrimitive): WorldAnchor

export interface AnchorMatch {
  distance: number
  pointA: Vec3 // closest-approach point on A's anchor, world space
  pointB: Vec3 // closest-approach point on B's anchor, world space
  paramA?: { t: number } | { u: number; v: number } // set iff A is segment/face
  paramB?: { t: number } | { u: number; v: number } // set iff B is segment/face
}

export function closestBetweenWorldAnchors(a: WorldAnchor, b: WorldAnchor): AnchorMatch
```

`toWorldAnchor` reuses today's 3-axis Euler rotation matrix (factored out
of the existing `toWorldPoint` into a shared `applyRotation` helper used
for both translating points and rotating a segment/face's constituent
vectors). `closestBetweenWorldAnchors` dispatches on `(a.kind, b.kind)`:
point-point (today's exact formula — a point's "closest point on itself"
is itself, so this is not a special case, just the degenerate one),
point-segment, point-face, and their mirror images are implemented.
**Segment-segment and face-face throw an explicit "not supported in this
increment" error** rather than silently returning null or an incorrect
result — callers filter these pairs out before calling (see below), so a
future engineer adding a new anchor kind combination can't accidentally
hit an unhandled case undetected.

### `Connection` / `ConnectionCandidate` data model (`engine/core/types.ts`)

```ts
export interface AnchorRef {
  anchorIndex: number
  // Present only when the referenced anchor is 'segment' or 'face'.
  // Locked in once, at confirm time, from the AnchorMatch that produced
  // this connection — never recomputed as "wherever is currently
  // closest."
  param?: { t: number } | { u: number; v: number }
}

export interface Connection {
  id: string
  pieceAId: string
  pieceBId: string
  a: AnchorRef
  b: AnchorRef
}

export type ConnectionCandidate = Omit<Connection, 'id'>
```

**Why a locked-in parametric coordinate, not a re-derived "current
closest point":** `param` is a *material*, piece-relative coordinate
("40% along this face's width, centered along its length") rather than a
world position. A rigid-group translation moves the anchor's geometry by
the same delta as everything else on that piece, so the material location
`param` refers to is preserved exactly — the same invariant point-point
coincidence already relies on today. This means:

- `movePiece`'s rigid-group translation needs **zero changes** to its
  mechanism, and `getConnectedPieceIds` needs **zero changes at all** —
  it only ever reads `pieceAId`/`pieceBId` off a `Connection`, never
  anchor geometry.
- Clamping doubles as a free staleness detector: if `changeDimensions`
  shrinks a piece after a connection was confirmed near the far edge of
  a face, re-evaluating the stored `param` against the now-smaller face
  clamps to a point that's no longer near the other side's anchor —
  `isConnectionCoincident` correctly returns false and
  `pruneStaleConnections` (already called from `changeDimensions`) drops
  it, with no special-case code.
- The alternative (re-deriving "the current closest point" on every
  check instead of pinning `param`) would let a T-joint's contact
  location silently slide across a face as either piece nudges by a
  fraction of a unit — physically wrong and a worse feel than a pinned
  joint.

### Store changes (`store/sceneSessionStore.ts`)

- **`findClosestConnectionMatch`** (drag-time position-snap): inner loop
  becomes `getAnchors(moving) × getAnchors(other)`, calling
  `closestBetweenWorldAnchors` for every pair, skipping any pair where
  both sides are non-point (the segment-segment/face-face exclusion).
  `delta = otherMatch.point − movingMatch.point` generalizes cleanly:
  it's exactly today's formula when both sides are points, since a
  point's closest-approach point is itself.
- **Claimed-set rule** (this is where "can a face host more than one
  connection at once" is decided — per the user's explicit choice, yes):
  only `point`-kind anchor refs are added to the claimed/exclude set used
  by `findConnectionCandidates` and `findClosestConnectionMatch`.
  `segment`/`face` anchors are never marked claimed, so a beam's face can
  host multiple simultaneous joint contacts (e.g. several joists resting
  on one beam), while a board's own end still can only ever touch one
  thing — a one-line predicate change (`isClaimed` skips non-point anchor
  refs), no distance-based deduplication needed.
- **`confirmConnection`**: re-derives the `AnchorMatch` for the candidate,
  re-validates `distance <= SNAP_DISTANCE` (unchanged behavior), computes
  `delta` from the match's two closest-approach points (same formula
  shape as today), translates the candidate's `pieceB`-side connected
  group by that delta (unchanged mechanism — `getConnectedPieceIds` still
  drives it), then appends a `Connection` whose `a`/`b` fields pin
  `match.paramA`/`match.paramB`. Structurally the same function as today,
  just sourcing `delta` from `AnchorMatch` and carrying two new optional
  `param` fields.
- **`isConnectionCoincident`/`pruneStaleConnections`** (`engine/core/connections.ts`):
  rebuilt on `AnchorRef` — look up `getAnchors(piece)[anchorIndex]`,
  `toWorldAnchor`, evaluate at the stored `param` if present (clamped
  against the anchor's *current* extents — see staleness note above),
  else use the point directly. Same `<=` threshold comparison as today.

### Rendering (`scene/ConnectionMarkers.tsx`)

Marker placement generalizes from "midpoint of two fixed points" to
"midpoint of the `AnchorMatch`'s two closest-approach points," recomputed
live each render. For **confirmed** connections these two points are, by
construction of `confirmConnection`'s exact-coincidence-forcing
translation, the same world point — the existing midpoint formula
degenerates correctly, just fed from a different input. For **candidates**,
this places the orb at the true closest-approach location on the
segment/face rather than a fixed anchor center, which is the intuitively
correct spot for an off-center T-joint candidate.

## Testing

Pure `engine/core` functions get unit tests, per this project's
established convention (Zustand store orchestration does not, except
where prior bugs earned a scoped exception — none anticipated here since
this reuses `movePiece`'s existing, already-tested translation mechanism
unchanged):

- `geometry.ts`: `closestPointOnSegment` (interior point, clamped at each
  end, degenerate zero-length segment guarded); `closestPointOnRect`
  (interior point, clamped on one axis only, clamped on both axes,
  degenerate zero-extent guarded).
- `connectionPoints.ts`: `getAnchors` returns the correct primitive list
  per piece type (box `'ends'` → 2 points + 2 segments + 4 faces; cylinder
  `'ends'` → 2 points, unchanged; `'single'`/`'none'` → unchanged);
  `closestBetweenWorldAnchors` for every supported kind pair
  (point-point, point-segment, segment-point, point-face, face-point) —
  including cases where the closest point falls inside vs. at a clamped
  edge/corner of the segment/face; segment-segment and face-face throw
  the expected error.
- `connections.ts`: `findConnectionCandidates`'s claimed-set rule —
  a point-kind anchor gets claimed and excluded from further matches; a
  segment/face-kind anchor does NOT get claimed, so two independent
  candidates against the same face coexist in one call's results.
  `isConnectionCoincident`/`pruneStaleConnections` against a `param`-bearing
  `Connection`, including the clamping-as-staleness-detector case
  (shrinking a piece's dimensions moves the evaluated point away from the
  other anchor, past `SNAP_DISTANCE`).

## Manual verification (user, after implementation, batched with other pending checks)

1. Drag a board's end to touch mid-span along another board's wide face
   (not at the face's exact center) — a candidate orb appears at the true
   contact point, not a fixed center.
2. Confirm — the two pieces snap into an exact touching joint (no gap);
   dragging either now moves both together (rigid group movement
   applies).
3. Drag a third piece's end to a *different* point on that same
   already-connected face — a second, independent candidate forms and can
   be confirmed without disturbing the first connection.
4. Detach one of the two face connections — the other stays intact.
5. Shrink a connected piece via the Inspector's dimension fields until the
   confirmed joint's stored contact point falls outside the piece's new
   (smaller) extents — the connection prunes automatically, matching
   today's rotate/resize-breaks-connection behavior.
6. Existing end-to-end board behavior (drag two boards tip to tip) still
   works exactly as before — unaffected by this change.
7. Place a rod (cylinder) near a board's new face/segment anchors — the
   rod's own anchors are unaffected (still just its 2 end points); no
   rod-specific face/segment candidate should appear (cylinder support is
   still deferred).
