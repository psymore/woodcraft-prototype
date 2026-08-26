# Transform Gizmo Rotation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a Unity/Unreal-style on-viewport X/Y/Z rotation gizmo (drei's `TransformControls`) for the selected piece in `wood-cad-workshop`, generalizing the currently yaw-only rotation model to full 3-axis rotation.

**Architecture:** Generalize `connectionPoints.ts`'s local-to-world point transform from a yaw-only 2D rotation to the full 3-axis Euler `'XYZ'` rotation matrix (hand-written, no `three` import, preserving `engine/core`'s framework-agnostic purity). Restructure `Piece.tsx` so each piece's body/handle live inside an outer `<group>` carrying `instance.rotation`, with any shape-intrinsic mesh offset (the cylinder's 90° tip) moved to an inner mesh — this is required for the gizmo to attach to a single object representing the piece's full orientation, and incidentally fixes a pre-existing bug where cylinder pieces didn't visually respond to yaw. Wire drei's `<TransformControls mode="rotate">` to that group when the piece is selected.

**Tech Stack:** React Three Fiber, `@react-three/drei` (`TransformControls`), Three.js, Zustand, Vitest.

**Spec:** `docs/superpowers/specs/2026-08-26-transform-gizmo-rotation-design.md`

## Global Constraints

- `engine/core/*` must not import `three` — keep it framework-agnostic (existing project convention; see spec's "Data model change" section).
- The general 3-axis rotation formula must reduce exactly to the existing yaw-only formula when `rotation = [0, y, 0]` — verified by keeping all existing `connectionPoints.test.ts` cases green, no changes to those cases.
- Rotation snap increment is 15°, using drei's native `rotationSnap` prop — no hand-rolled snapping math for rotation.
- No new automated tests for pointer/gizmo UI interaction (matches this session's established preference); the one new test in Task 1 covers pure engine math only.
- Box-shaped pieces must look visually identical before/after this change (no intrinsic offset existed for them).

---

### Task 1: Generalize `toWorldPoint` to full 3-axis rotation

**Files:**
- Modify: `wood-cad-workshop/src/engine/core/connectionPoints.ts:25-38`
- Test: `wood-cad-workshop/src/engine/core/connectionPoints.test.ts`

**Interfaces:**
- Consumes: nothing new — `ComponentInstance.rotation: [number, number, number]` (already exists, `wood-cad-workshop/src/engine/core/types.ts:33`).
- Produces: `toWorldPoint(instance, local)` — same signature as before, now honoring all three rotation axes. `findConnectionSnapDelta` and `getConnectionPoints` (same file) are unchanged and keep working through this function.

- [ ] **Step 1: Write the failing test**

Add this test inside the existing `describe('toWorldPoint', ...)` block in `wood-cad-workshop/src/engine/core/connectionPoints.test.ts` (after the existing yaw test, before its closing `})`):

```ts
  it('applies pitch (X-axis) rotation to a local point', () => {
    const instance: ComponentInstance = {
      id: 'r1',
      componentDefinitionId: 'test_rod',
      position: [0, 0, 0],
      rotation: [Math.PI / 2, 0, 0],
      dimensions: { diameter: 1, length: 10 },
      material: '#000',
    }
    const world = toWorldPoint(instance, [0, 0, 5])
    expect(world[0]).toBeCloseTo(0)
    expect(world[1]).toBeCloseTo(-5)
    expect(world[2]).toBeCloseTo(0)
  })
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd wood-cad-workshop && npx vitest run connectionPoints`
Expected: FAIL — the new test fails because `toWorldPoint` currently ignores `rotation[0]` entirely, so `world` stays `[0, 0, 5]` instead of `[0, -5, 0]`.

- [ ] **Step 3: Write the minimal implementation**

Replace `toWorldPoint` in `wood-cad-workshop/src/engine/core/connectionPoints.ts` (lines 25-38) with:

```ts
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd wood-cad-workshop && npx vitest run connectionPoints`
Expected: PASS, all cases in `connectionPoints.test.ts` (including the pre-existing yaw test and the new pitch test) green.

- [ ] **Step 5: Run the full suite and commit**

Run: `cd wood-cad-workshop && npx tsc -b && npx vitest run`
Expected: clean type-check, all test files pass.

```bash
git add wood-cad-workshop/src/engine/core/connectionPoints.ts wood-cad-workshop/src/engine/core/connectionPoints.test.ts
git commit -m "feat(wood-cad-workshop): generalize connection-point rotation to 3 axes"
```

---

### Task 2: Add `setRotation` store action

**Files:**
- Modify: `wood-cad-workshop/src/store/sceneSessionStore.ts`

**Interfaces:**
- Consumes: nothing new.
- Produces: `setRotation: (id: string, rotation: [number, number, number]) => void` on `SceneSessionState`, for Task 4 to call from the gizmo's `onObjectChange` handler.

- [ ] **Step 1: Add to the `SceneSessionState` interface**

In `wood-cad-workshop/src/store/sceneSessionStore.ts`, in the `SceneSessionState` interface (around line 15, right after `movePiece`), add:

```ts
  setRotation: (id: string, rotation: [number, number, number]) => void
```

- [ ] **Step 2: Implement the action**

In the store body, right after the `movePiece` implementation (after its closing `}),` around line 57), add:

```ts
    setRotation: (id, rotation) =>
      set((state) => ({
        instances: state.instances.map((i) => (i.id === id ? { ...i, rotation } : i)),
      })),
```

This mirrors `changeDimensions`'s shape exactly (simple per-id field replace, no connection-snap logic — orientation-aware snapping is out of scope for this step per the spec).

- [ ] **Step 3: Verify the project still type-checks**

Run: `cd wood-cad-workshop && npx tsc -b`
Expected: clean, no errors (no existing test covers the store directly — this matches the project's existing convention of only unit-testing `engine/core`, not Zustand stores).

- [ ] **Step 4: Commit**

```bash
git add wood-cad-workshop/src/store/sceneSessionStore.ts
git commit -m "feat(wood-cad-workshop): add setRotation store action"
```

---

### Task 3: Restructure `Piece.tsx` into a group hierarchy (no gizmo yet)

**Files:**
- Modify: `wood-cad-workshop/src/scene/Piece.tsx`

**Interfaces:**
- Consumes: nothing new from other tasks (this task is a pure rendering restructure).
- Produces: a `groupRef` (a `useRef<THREE.Group>(null)`) wrapping each piece's body + vertical handle, positioned with `instance.rotation` — Task 4 attaches `TransformControls` to this same `groupRef`.

This task is reviewable on its own: run the app, confirm box-shaped pieces are pixel-identical to before, and confirm cylinder-shaped pieces (dowels, pull-up bar) now visibly rotate when you click the existing "Rotate" button (previously they didn't — see spec's "an incidental bug fix" section for why).

- [ ] **Step 1: Replace the component body**

Replace the full contents of `wood-cad-workshop/src/scene/Piece.tsx` from the `const color = ...` line (currently line 114) through the end of the file (currently line 168) with:

```tsx
  const color = selected ? '#ffb347' : instance.material
  const displayPosition = getExplodedPosition(instance.position, centroid, explodeAmount)
  const groupRef = useRef<THREE.Group>(null)

  const showVerticalHandle = selected && explodeAmount === 0

  const verticalHandle = (topY: number) =>
    showVerticalHandle && (
      <mesh
        position={[0, topY + HANDLE_GAP, 0]}
        onPointerDown={handleVerticalPointerDown}
        onPointerMove={handleVerticalPointerMove}
        onPointerUp={handleVerticalPointerUp}
      >
        <coneGeometry args={[0.15, 0.3, 12]} />
        <meshStandardMaterial color="#4a90d9" />
      </mesh>
    )

  if (definition.geometry.shape === 'cylinder') {
    const { radius, height } = getCylinderSize(instance)
    return (
      <group ref={groupRef} position={displayPosition} rotation={instance.rotation}>
        <mesh
          rotation={[Math.PI / 2, 0, 0]}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
        >
          <cylinderGeometry args={[radius, radius, height, 16]} />
          <meshStandardMaterial color={color} />
        </mesh>
        {verticalHandle(height / 2)}
      </group>
    )
  }

  const size = getBoxSize(instance)
  return (
    <group ref={groupRef} position={displayPosition} rotation={instance.rotation}>
      <mesh
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
      >
        <boxGeometry args={size} />
        <meshStandardMaterial color={color} />
      </mesh>
      {verticalHandle(size[1] / 2)}
    </group>
  )
}
```

Notes on what changed from the current file:
- The cylinder mesh's rotation is now the fixed shape-intrinsic `[Math.PI / 2, 0, 0]` (no more `yaw` mixed in) — the outer `<group>`'s `rotation={instance.rotation}` now carries the piece's full orientation instead.
- The box mesh has no `rotation` prop at all now (identity local rotation) — its outer `<group>` carries `instance.rotation`, which is exactly equivalent to the old `rotation={[0, yaw, 0]}` on the mesh directly, since `rotation[0]`/`rotation[2]` were always 0 before this plan.
- `verticalHandle`'s position is now local to the group (`[0, topY + HANDLE_GAP, 0]`) instead of world-absolute (`[displayPosition[0], topY + HANDLE_GAP, displayPosition[2]]`) — the group's own `position={displayPosition}` now supplies that offset.
- The old top-level `const yaw = instance.rotation[1]` line is removed — no longer needed.
- The pointer handlers (`handlePointerDown`/`Move`/`Up`, `handleVerticalPointerDown`/`Move`/`Up`) are unchanged and keep working: they operate in world space via `e.ray` and call `movePiece` with world-absolute positions, independent of this local nesting.

- [ ] **Step 2: Type-check and run the test suite**

Run: `cd wood-cad-workshop && npx tsc -b && npx vitest run`
Expected: clean type-check, all tests pass (this task touches no engine logic, only JSX structure).

- [ ] **Step 3: Commit**

```bash
git add wood-cad-workshop/src/scene/Piece.tsx
git commit -m "refactor(wood-cad-workshop): wrap piece rendering in an orientation group"
```

- [ ] **Step 4: Manual check-in (ask the user before continuing to Task 4)**

Start the dev server (`cd wood-cad-workshop && npm run dev`) and ask the user to confirm in the browser:
1. Existing box-shaped pieces (boards, beams, the pull-up bar's L-brackets/foot, etc.) look and behave exactly as before — same position, same drag behavior.
2. Select a cylinder-shaped piece (a dowel, or the pull-up bar's round rod) and click the existing "Rotate" button — it should now visibly spin 90° each click (previously it silently did nothing visually).
3. The vertical move handle (from the prior step) still works on both shapes.

Do not proceed to Task 4 until the user confirms.

---

### Task 4: Wire the rotation gizmo

**Files:**
- Modify: `wood-cad-workshop/src/scene/Piece.tsx`

**Interfaces:**
- Consumes: `groupRef` from Task 3; `setRotation` from Task 2 (`useSceneSession((s) => s.setRotation)`).
- Produces: the visible, user-facing rotation gizmo feature. Nothing downstream depends on new exports — this is the final task in this plan.

- [ ] **Step 1: Import `TransformControls`**

In `wood-cad-workshop/src/scene/Piece.tsx`, change the import line:

```ts
import { useRef } from 'react'
```

to:

```ts
import { useRef } from 'react'
import { TransformControls } from '@react-three/drei'
```

(keep it right after the existing `import { useThree } from '@react-three/fiber'` line, or anywhere among the existing imports — ordering doesn't matter here).

- [ ] **Step 2: Add the rotation-snap constant**

Next to the existing `const HANDLE_GAP = 0.5` constant, add:

```ts
const ROTATION_SNAP = THREE.MathUtils.degToRad(15)
```

- [ ] **Step 3: Read `setRotation` from the store**

Next to the existing `const setDraggingPiece = useSceneSession((s) => s.setDraggingPiece)` line, add:

```ts
  const setRotation = useSceneSession((s) => s.setRotation)
```

- [ ] **Step 4: Add the gizmo-change handler**

Add this function near the other handlers (e.g. right after `handlePointerUp`):

```ts
  const handleGizmoChange = () => {
    const group = groupRef.current
    if (!group) return
    setRotation(instance.id, [group.rotation.x, group.rotation.y, group.rotation.z])
  }
```

- [ ] **Step 5: Render the gizmo when selected**

Add a `showGizmo` flag next to the existing `showVerticalHandle` line:

```ts
  const showGizmo = selected && explodeAmount === 0 && !multiTouchActiveRef.current
```

Then wrap each `return (<group ...>...</group>)` (both the cylinder branch and the box branch from Task 3) in a fragment that also renders the gizmo as a sibling. For the cylinder branch:

```tsx
    return (
      <>
        <group ref={groupRef} position={displayPosition} rotation={instance.rotation}>
          <mesh
            rotation={[Math.PI / 2, 0, 0]}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
          >
            <cylinderGeometry args={[radius, radius, height, 16]} />
            <meshStandardMaterial color={color} />
          </mesh>
          {verticalHandle(height / 2)}
        </group>
        {showGizmo && (
          <TransformControls
            object={groupRef}
            mode="rotate"
            space="world"
            rotationSnap={ROTATION_SNAP}
            showX
            showY
            showZ
            onObjectChange={handleGizmoChange}
          />
        )}
      </>
    )
```

And equivalently for the box branch:

```tsx
  return (
    <>
      <group ref={groupRef} position={displayPosition} rotation={instance.rotation}>
        <mesh
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
        >
          <boxGeometry args={size} />
          <meshStandardMaterial color={color} />
        </mesh>
        {verticalHandle(size[1] / 2)}
      </group>
      {showGizmo && (
        <TransformControls
          object={groupRef}
          mode="rotate"
          space="world"
          rotationSnap={ROTATION_SNAP}
          showX
          showY
          showZ
          onObjectChange={handleGizmoChange}
        />
      )}
    </>
  )
}
```

- [ ] **Step 6: Type-check and run the test suite**

Run: `cd wood-cad-workshop && npx tsc -b && npx vitest run`
Expected: clean type-check, all tests pass (no engine logic touched in this task).

- [ ] **Step 7: Commit**

```bash
git add wood-cad-workshop/src/scene/Piece.tsx
git commit -m "feat(wood-cad-workshop): add X/Y/Z rotation transform gizmo"
```

- [ ] **Step 8: Manual verification (final check-in)**

Start the dev server (`cd wood-cad-workshop && npm run dev`) if it isn't already running, and ask the user to walk through the spec's manual verification checklist (`docs/superpowers/specs/2026-08-26-transform-gizmo-rotation-design.md`, "Manual verification" section):

1. Select a box-shaped piece and rotate it via the X, then Y, then Z gizmo ring.
2. Select a cylinder-shaped piece (dowel or pull-up bar) and confirm the "Rotate" button visibly spins it, and the gizmo rings rotate it correctly on all three axes.
3. Confirm rotation snaps to 15° increments.
4. Change camera angle (orbit/pan/zoom, including view presets) and confirm the gizmo stays usable and doesn't fight with orbit controls.
5. Confirm deselecting a piece hides its gizmo, and only one piece's gizmo is visible at a time.
6. Confirm the existing "Rotate" button and body/vertical-handle dragging still work with no state conflicts.

Do not report this plan complete until the user confirms all six checks.

---

## Self-Review Notes

- **Spec coverage:** library decision (Task 4 imports drei's `TransformControls`), data model generalization (Task 1), rendering restructure + cylinder bug fix (Task 3), gizmo wiring incl. snap/orbit-conflict-free integration (Task 4), testing approach (Task 1's single new test; no gizmo UI test, per spec) — all covered.
- **Placeholder scan:** none found; every step has literal code or literal shell commands.
- **Type consistency:** `setRotation(id: string, rotation: [number, number, number])` (Task 2) matches the call site in Task 4 (`setRotation(instance.id, [group.rotation.x, ...])`); `groupRef` type (`useRef<THREE.Group>(null)`, Task 3) matches its use as `TransformControls`'s `object` prop (Task 4) and `.rotation.{x,y,z}` access (Task 4).
