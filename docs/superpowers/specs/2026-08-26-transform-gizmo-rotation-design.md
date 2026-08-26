# Transform Gizmo — Rotation (Sub-project: 3D Editor Next Steps, Step 1)

Status: approved, implementation pending.

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

The vertical-move handle (from the prior step) and the body drag
handlers are unaffected: they operate in world space via `e.ray` and
`movePiece`, independent of this local nesting.

## Gizmo wiring

- Each `Piece` conditionally renders `<TransformControls object={groupRef}
  mode="rotate" rotationSnap={THREE.MathUtils.degToRad(15)} showX showY
  showZ onObjectChange={...} />` when `selected && explodeAmount === 0 &&
  !multiTouchActiveRef.current` — matching the existing guard pattern used
  for the vertical handle.
- `rotationSnap` is drei's native prop — no custom snapping math needed,
  unlike position dragging's hand-rolled `snapValue`.
- `onObjectChange` reads the group's live `rotation.{x,y,z}` and calls a
  new store action `setRotation(id, [x, y, z])`, mirroring `movePiece`'s
  shape but without connection-snap logic (out of scope for this step;
  connection/orientation snapping is step 4's concern).
- The existing "Rotate" button (`rotateSelected`, +90° Y bump) is
  unchanged and continues to work alongside the gizmo — both act on the
  same `rotation` field.

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
