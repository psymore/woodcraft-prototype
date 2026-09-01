# Camera Stability & Connection Visualization — Design

**Status:** approved for implementation (P0/P1 only this increment)
**App:** `wood-cad-workshop/` (Three.js / React Three Fiber)

## Background

Two user-reported bugs, both root-caused before any fix was proposed (see
"Root cause investigation" below). Investigating them surfaced a broader
gap between this app's current interaction model and what's expected of a
CAD/3D-assembly tool, so this spec also carries a short, non-architectural
UX audit that feeds a P0–P3 priority list. Only the P0/P1 items in that
list are implemented this increment; P2/P3 are recorded for a future pass.

## Root cause investigation

### Bug 1 — camera struggles with long pieces / large assemblies

**Confirmed root cause:** `computeBounds()` in
`wood-cad-workshop/src/engine/core/framing.ts`, consumed by `App.tsx`'s
`frame()` (used by both "Frame All" and "Frame Selected"), computes its
bounding radius from each piece's **center position only** — it never
reads `dimensions` or `rotation`, so every piece is treated as a
zero-size point. This app routinely contains long pieces (the seed scene
alone has a 48-unit board; `vertical_post`'s default length is 84), so
this systematically produces a `radius`/`distance` far smaller than what
the actual geometry needs.

**Empirical reproduction** (via a temporary Playwright driver against the
running dev server, plus the store/engine exposed on `window` for direct
inspection — both reverted, not part of this repo): a 10-unit board and a
10-unit vertical post (via the "Stand Up" pose) were placed touching at
one anchor. Clicking "Frame All" moved the camera to `(0, 10.50, 10.31)`
targeting `(0, 4.25, 2.5)` — `distance = 10`, computed from a `radius` of
`3.54` (the distance between the two piece *centers*, not their actual
extents). At that position the camera ends up only ~3.6 units from the
post's near face while looking almost straight down the post's own
10-unit length — the screenshot shows the viewport filled edge-to-edge by
one piece's surface, with neither piece recognizably "framed."

**What this is not:** not a `near`/`far` clipping problem (`near: 0.5,
far: 500` are reasonable and untouched by this fix), not a depth-precision
problem (the 500:1 far:near ratio is mild), not a render-performance
problem (this reproduces with exactly 2 pieces).

**Secondary confirmed gap:** `<OrbitControls>` in `App.tsx` sets no
`minDistance`/`maxDistance` — zoom is fully unbounded in both directions.

### Bug 2 — connection marker "disappears"

**Confirmed root cause:** the connection marker
(`wood-cad-workshop/src/scene/ConnectionMarkers.tsx`) is a normal opaque
`meshStandardMaterial` sphere (default `depthTest`/`depthWrite: true`,
`renderOrder: 0`) placed exactly at the two anchors' closest-approach
point — which, by construction, sits **on the boundary surface(s) between
the two connecting solids**. Because it participates in ordinary Z-buffer
depth testing like any other opaque mesh, a large fraction of its volume
is geometrically inside the union of the two pieces' own geometry and
gets self-occluded.

**Empirical verification, not guesswork:** using the same temporary
Playwright/window-exposure setup, a scene-graph inspector confirmed the
marker mesh IS created at the exact mathematically-correct world
position for a horizontal-board-to-vertical-post join
(`(0, 1.75, 5)`, matching hand-computed anchor math exactly). This rules
out a position/transform bug — `getAnchors`/`toWorldAnchor`'s rotation
math (verified separately by hand for the `[π/2, 0, 0]` "Stand Up" pose)
is correct. A direct, unobstructed camera angle onto that exact corner
showed no visible orange sphere at all. **This is "orb is in the right
place but not visible," not "orb is in the wrong place"** — per the
distinction this investigation was asked to make.

For a straight coaxial end-to-end join between two same-cross-section
pieces, this can occlude the marker almost completely (both halves of the
sphere fall inside one piece or the other, with no exposed surface); for
the perpendicular (corner) join reproduced here, roughly three-quarters
of the sphere is buried, leaving only a thin sliver visible from a narrow
range of angles — which is exactly the "disappears" symptom reported.

## Design

### Camera: geometry-aware framing + zoom limits

**`computeBounds` becomes geometry-aware**, replacing point-based bounds
with a real world-space AABB merge:

- New pure function in `engine/core/framing.ts`,
  `computeInstanceBounds(instances: ComponentInstance[]): Bounds`, taking
  full `ComponentInstance[]` (not just positions). For each instance:
  compute its local half-extents from `dimensions` (reusing
  `getBoxSize`/`getCylinderSize` from `dimensions.ts` — a cylinder's AABB
  half-extents are `[radius, radius, height/2]`), rotate each of the 8 box
  corners (or, for a cylinder, a conservative box of its own bounding
  cylinder) by the instance's `rotation` using the same `applyRotation`-style
  matrix already proven correct in `connectionPoints.ts` (do not
  reimplement — factor the rotation matrix out to `geometry.ts` if it
  isn't already shared, so the two call sites can't drift), translate by
  `position`, and expand a running min/max corner. Convert the final
  min/max box to `{ center, radius }` (radius = half-diagonal, matching
  the existing `Bounds` shape so `App.tsx`'s `frame()` needs no signature
  change beyond what it passes in).
- `computeBounds(positions)` (point-only) stays as-is for now — nothing
  else calls it after this change routes `App.tsx` to the new function,
  but deleting it is a separate cleanup call for the implementer (YAGNI:
  don't delete working code speculatively if anything else might still
  reference it — check call sites at implementation time).
- `App.tsx`'s `frame()` calls `computeInstanceBounds(instances)` (Frame
  All) / `computeInstanceBounds([selected])` (Frame Selected) instead of
  mapping to positions first.
- The existing `distance = Math.max(radius * 2.5, 10)` margin formula is
  kept as-is — it already does the right thing once `radius` is correct.

**Zoom limits:** add `minDistance`/`maxDistance` to `<OrbitControls>` in
`App.tsx`. Values: `minDistance={1.5}` (closer than the thinnest common
piece's own thickness would let the camera clip through geometry edge-on;
still close enough for detail inspection), `maxDistance={300}`
(comfortably covers the full 120×120 grid from any angle, stays well
under `camera.far=500` so nothing here interacts with far-plane
clipping).

**Out of scope this increment (P2, recorded not built):** workspace
boundary visuals (grid extents indicator, axis/orientation gizmo). The
grid itself already exists (120×120, `Scene.tsx`) and is not being
resized — the fix here is that the *camera* correctly accounts for real
piece size, not that the workspace grows. A visible boundary/orientation
aid is a legitimate future improvement but isn't required to fix either
reported bug, so it stays out of the P0/P1 cut per this session's YAGNI
instruction ("gereksiz büyük refactor yapma").

### Connection visualization: refined hybrid (Option D)

Three visual states, each mapped to a distinct treatment — no state gets
a marker until there's something to communicate, per the explicit
"don't drown the user in visual complexity" constraint:

| State | Trigger | Visual |
|---|---|---|
| Available (free anchor, nothing nearby) | any unclaimed anchor | **nothing** — unchanged from today; showing a marker on every one of a box piece's up-to-10 anchors at all times would be pure noise |
| Candidate | `findConnectionCandidates` returns a pair within `SNAP_DISTANCE` | orange sphere at the closest-approach midpoint (unchanged from today) **plus** a thin cylinder "preview line" between the two anchors' own closest-approach points (`match.pointA` → `match.pointB`) — meaningful here because a candidate's two points are, by definition, not yet coincident |
| Confirmed | persisted `Connection` | **no sphere** (removed for this state — this is what was getting occluded). Instead: a short cylinder "pin," `PIN_LENGTH = 1.5` units long, from the (now-coincident) join point outward along `pinDirection` (below), radius similar to the old marker's touch-friendliness intent (`0.25`, i.e. `0.5` diameter, comfortable to tap). The pin is the confirm/detach click target, replacing the sphere's `onClick`/`onPointerDown` role 1:1. |

**`pinDirection` algorithm** (pure, in `connectionPoints.ts` or
`connections.ts` — no `three` import, matching the module's existing
convention): given the join point `J` and the two connected pieces' own
`position`s `A`, `B`:

1. `avgCenter = (A + B) / 2`; try `dir = normalize(J - avgCenter)`.
2. If `|J - avgCenter|` is below a small epsilon (degenerate — this
   happens for a straight coaxial end-to-end join, where both piece
   centers and the join point are collinear at the same height), fall
   back to `dir = normalize(J - A)`.
3. If that's also degenerate (only possible when `A`'s own anchor sits at
   its position, i.e. a `'single'`-role piece touching exactly at its own
   center), fall back to `normalize(J - B)`.
4. If all three are degenerate (both pieces are `'single'`-role, centers
   coincident with the join — a pathological case), fall back to world-up
   `(0, 1, 0)`.

This is derived entirely from real piece/joint positions — never a
hardcoded world axis except as the last-resort fallback — satisfying the
"no hardcoded world-axis offset" constraint from the original ask, and it
was hand-verified against the reproduced horizontal-board/vertical-post
case: it points cleanly into open air, clear of both solids.

**Occupied / invalid states:** not given a distinct visual this
increment (P2/P3, see priority list) — today, an anchor that's occupied
or otherwise ineligible simply never produces a candidate, so nothing
renders for it; that's silent-by-omission rather than an explicit
"why not" affordance. Building real "why didn't this connect" feedback is
a genuine UX improvement but is additive, not a fix to either reported
bug, and risks exactly the kind of scope creep this session was told to
avoid ("mevcut connection modelini bozma," "gereksiz büyük refactor
yapma").

**Data model:** unchanged. `Connection`/`ConnectionCandidate`,
`findConnectionCandidates`, `confirmConnection`/`detachConnection` keep
their current signatures and behavior exactly — this is a **visual-layer**
change only. `ConnectionMarkers.tsx` is the only file whose rendering
logic changes (plus the new `pinDirection` helper, wherever it's placed
in `engine/core`).

## UX baseline audit (informs priority list only — not a redesign)

Quick read against CAD/3D-assembly interaction norms, scoped to what's
already implemented vs. genuinely missing:

**Present and working:** orbit/pan/zoom (via drei `OrbitControls`), 7
view presets + Frame All/Selected (buggy per Bug 1, not missing),
select/rotate/duplicate/delete/stand-up, drag-to-move with grid snap,
vertical-move handle, rotation gizmo with independent show/hide toggles,
connection candidate→confirm→detach flow, exploded view, structural
check on the pull-up bar. Selected-piece feedback exists (color change to
`#ffb347`).

**Missing, genuinely worth flagging:**
- No hover feedback on pieces (only click-selected state has any visual
  distinction) — P2.
- No axis/orientation indicator (compass gizmo) — a user who orbits
  freely has no fixed reference for "which way is which" — P2.
- No "why didn't this connect" feedback (see Occupied/invalid above) — P2.
- No workspace-boundary visual beyond the flat grid itself — P2 (ties to
  the camera work above, not required to fix it).

**Explicitly not a gap:** multi-selection (this app's interaction model —
one selection, drag-to-move, connect via proximity — doesn't call for
it; adding it now would be speculative scope, not a fix).

## Priority classification

**P0 — Critical (this increment):**
1. Camera framing (`computeBounds` → `computeInstanceBounds`,
   geometry-aware).

**P1 — Important (this increment):**
2. OrbitControls `minDistance`/`maxDistance`.
3. Connection marker occlusion fix (candidate orb+preview line, confirmed
   pin replacing the buried sphere).

**P2 — Improvement (recorded, not built this increment):**
- Workspace boundary / axis-orientation visual aid.
- Hover feedback on pieces.
- "Why didn't this connect" feedback for occupied/invalid anchors.
- `findConnectionCandidates`/`findClosestConnectionMatch`'s existing
  O(pieces² × anchors²) scan and `ConnectionMarkers`' unmemoized
  per-render candidate search (both pre-existing, not introduced by this
  fix) — fine at current scale, worth revisiting past roughly 40-50
  pieces.

**P3 — Future:** segment/face-face matching, cylinder anchors, multi-touch
gesture refinements beyond what's already implemented — all pre-existing,
explicitly out of scope, not re-litigated here.

## Testing

- `computeInstanceBounds`: pure `engine/core` function → unit tests, per
  this project's established convention. Cover: single box piece
  (radius reflects its own half-diagonal, not a degenerate floor value),
  single cylinder piece, multiple pieces at different rotations, a
  rotated long piece whose AABB must be visibly bigger than its
  unrotated point position would suggest.
- `pinDirection`: pure function → unit tests. Cover: normal case, the
  degenerate coaxial-join fallback, and the `'single'`-role double-fallback.
- `ConnectionMarkers.tsx`: UI/rendering, left untested per this project's
  established convention (matching every other `scene/*.tsx` component) —
  verified via `tsc`/manual smoke test instead.
- Manual verification (both bugs) against the dev server, covering the
  scenarios in the original request: normal board, very long board/beam,
  multiple long pieces, large assembly, zoom in/out/orbit/pan, Frame
  All/Selected; horizontal↔horizontal, vertical↔horizontal,
  vertical↔vertical, rotated↔horizontal, very-close points, existing
  connection, candidate connection, detach.
