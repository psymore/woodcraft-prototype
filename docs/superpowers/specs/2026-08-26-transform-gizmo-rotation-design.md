# Transform Gizmo — Rotation (Sub-project: 3D Editor Next Steps, Step 1)

Status: implemented.

## Context

This is step 1 of a 5-step "3D editor next steps" initiative (rotation
gizmo → theme system → vertical/stand-up action → part joining → z-fighting
fix), run as separate bounded/architectural passes with manual user
verification between each. This document covers step 1 only.

Today, `wood-cad-workshop`'s pieces only rotate around the vertical (Y)
axis, via a "Rotate" button that bumps `rotation[1]` by 90°.
`ComponentInstance.rotation` is typed as `[x, y, z]` but `x` and `z` are
never set or read anywhere except as always-zero placeholders. This step
adds a Unity/Unreal-style on-viewport rotation gizmo that lets the user
rotate a selected piece freely around all three axes.

## Decision: library

Use drei's `<TransformControls mode="rotate">` rather than a hand-built
3-ring gizmo. `three-stdlib`'s `TransformControls` (which drei wraps)
already solves camera-relative sizing, ray/plane projection for drag
angle computation, and sign correction when viewing a ring edge-on —
reimplementing this correctly is high-risk, high-effort for no
architectural benefit. Its one limitation — gizmo ring colors are
hardcoded internally, not exposed as props — is deferred to step 2
(theme system), which will recolor the gizmo's mesh materials by
traversing its object graph after mount.

drei's wrapper also auto-wires the drag-vs-camera-orbit conflict: it
listens for the underlying controls' `dragging-changed` event and
toggles `state.controls.enabled` (the R3F "default controls" registered
by `<OrbitControls makeDefault>` in `App.tsx`) automatically. No changes
to `App.tsx`'s existing `isDraggingPiece` wiring are needed.

## Data model change

`ComponentInstance.rotation` becomes a real 3-axis Euler triple, applied
in three.js's default `'XYZ'` order, instead of a Y-only value with two
unused zero fields. No field/type changes — `[number, number, number]`
already supports this; only its *usage* changes.

`engine/core/connectionPoints.ts`'s `toWorldPoint` is generalized from a
yaw-only 2D rotation to the full 3-axis rotation matrix for Euler order
`'XYZ'`, applied by hand (matching three.js's `Matrix4.makeRotationFromEuler`
convention) rather than importing `three` — `engine/core` is deliberately
framework-agnostic today and this preserves that. The general formula
reduces exactly to the current yaw-only formula when x=z=0, so existing
behavior and existing tests (`connectionPoints.test.ts`) are unaffected.

## Rendering restructure + an incidental bug fix

Each `Piece` currently renders its mesh with `position={displayPosition}`
directly, and — for cylinders only — combines a shape-intrinsic 90°
X-offset (three.js cylinders default to a Y-aligned axis; this offset
tips them to lie along local Z, matching the "ends" connection-point
convention) with the user's yaw in a single Euler triple on that one mesh.

Mathematically, this combination means **a cylinder-shaped piece's visual
orientation is currently invariant to yaw** — the "Rotate" button has no
visible effect on dowels or the pull-up bar, even though
`connectionPoints.ts` already assumes yaw sweeps their end points. Visual
and logical models are already out of sync for cylinders.

Fix (required to make the gizmo work at all, and incidentally corrects
this): each `Piece` wraps its content in an outer `<group>` carrying
`instance.rotation` directly (this is what the gizmo attaches to and
edits). The cylinder's shape-intrinsic 90° offset moves to the *inner*
mesh's own local rotation, composing correctly with the outer group's
user-editable rotation. Box-shaped pieces are unaffected (no intrinsic
offset; outer group's rotation is exactly what the mesh's rotation prop
was already set to, since `x`/`z` were always 0) — no visual change for
existing box pieces.

The body drag handlers are unaffected: they operate in world space via
`e.ray` and `movePiece`, independent of this local nesting.

The vertical-move handle was *not* unaffected, contrary to this document's
original claim. It was rendered as a child of the piece's group at local
`[0, topY + gap, 0]`, which pointed at world up only while pitch and roll
were zero. Once pieces can pitch (Stand Up, or the gizmo's X/Z rings) the
handle swung off to the side of the piece while its drag logic still moved
along world Y. It is now rendered as a *sibling* of the group, positioned in
world space at `displayPosition + (maxHalfExtent + gap)` on Y, where
`maxHalfExtent` is half the piece's largest dimension — a deliberate slight
over-estimate that is always above the piece regardless of orientation.

## Gizmo wiring

- Each `Piece` conditionally renders `<TransformControls object={group}
  mode="rotate" space="world" rotationSnap={THREE.MathUtils.degToRad(15)}
  showX showY showZ onObjectChange={...} />` when `selected &&
  explodeAmount === 0` — matching the guard used for the vertical handle.
  `space="world"` keeps the rings aligned to the world axes so the drag
  direction stays predictable after a piece has been pitched.
- `object` is a state-backed callback ref (`useState<THREE.Group | null>`
  + `ref={setGroup}`), not a `useRef`: a `useRef` is `null` on the first
  render and never re-renders, so a piece mounting already-selected (e.g.
  right after DUPLICATE) would attach the gizmo to drei's own empty
  wrapper at the origin.
- `rotationSnap` is drei's native prop — no custom snapping math needed,
  unlike position dragging's hand-rolled `snapValue`.
- `onObjectChange` reads the group's live `rotation.{x,y,z}` and calls a
  new store action `setRotation(id, [x, y, z])`, mirroring `movePiece`'s
  shape but without connection-snap logic (out of scope for this step;
  connection/orientation snapping is step 4's concern).
- The existing "Rotate" button (`rotateSelected`) continues to work
  alongside the gizmo — both act on the same `rotation` field. Its
  implementation did change: a raw `rotation[1] += 90°` is a world-Y spin
  only while pitch and roll are zero, so it now composes a world-Y
  quaternion turn onto the current orientation and converts back to Euler.

## Stand Up (added during implementation)

"Stand Up" was brainstormed and approved inline in chat during this
branch's implementation; it was not part of the original plan for step 1.
It was originally scoped as step 3 of the broader 5-step initiative
(vertical/stand-up action), but was pulled forward into step 1's branch at
the user's request, since the 3-axis rotation model it depends on landed
here.

- Canonical absolute pose: `rotation = [Math.PI / 2, 0, 0]` with
  `position.y = dimensions.length / 2`, so the piece stands on the ground
  plane on one end. Absolute, not relative — the result is the same
  regardless of the piece's prior orientation, which keeps it predictable
  after a free gizmo rotation.
- Gated to pieces whose definition has `connectionRole === 'ends'` —
  board, squareBeam, roundRod, verticalPost, pullupBar. Anything else
  (small hardware, `'single'`/`'none'`) is a no-op, since "vertical" has no
  clear meaning there.
- The store action writes `position` directly rather than going through
  `movePiece`, deliberately: connection-point snapping would nudge the
  absolute pose toward nearby pieces.

## Testing

`toWorldPoint`'s generalization is core engine math with existing unit
coverage (`connectionPoints.test.ts`); no new tests are added, but
`vitest run` must stay green (yaw-only cases are a special case of the
general formula, so this is a regression check, not new coverage). The
gizmo itself is pointer-driven 3D interaction with no automated coverage
in this codebase's style (consistent with the prior vertical-move step) —
verification is manual, by the user, per the checklist below.

## Manual verification (user, after implementation)

1. Select a piece, box-shaped, and rotate it via the X, then Y, then Z
   gizmo ring.
2. Select a cylinder-shaped piece (dowel or pull-up bar) and confirm the
   "Rotate" button now visibly spins it, and the gizmo rings rotate it
   correctly on all three axes.
3. Confirm rotation snaps to 15° increments.
4. Change camera angle (orbit/pan/zoom, including view presets) and
   confirm the gizmo stays usable and doesn't fight with orbit controls.
5. Confirm deselecting a piece hides its gizmo, and only one piece's
   gizmo is visible at a time.
6. Confirm the existing "Rotate" button and body/vertical-handle dragging
   still work with no state conflicts.
