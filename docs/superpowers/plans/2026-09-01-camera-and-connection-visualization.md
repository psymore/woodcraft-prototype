# Camera Framing & Connection Visualization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix two root-caused bugs — camera framing that ignores piece geometry size, and a connection marker that self-occludes — by making the camera's bounding computation geometry-aware, adding OrbitControls zoom limits, and replacing the occluded confirmed-connection sphere with a candidate preview line + confirmed pin.

**Architecture:** `computeInstanceBounds` (new, in `engine/core/framing.ts`) replaces the point-only `computeBounds`, computing a real world-space AABB per instance (rotated box corners, or a conservative box for cylinders) and merging them — reusing a newly-shared `applyRotation` (moved from `connectionPoints.ts` to `geometry.ts` so both call sites can't drift). `App.tsx` wires this into "Frame All"/"Frame Selected" and adds `OrbitControls` zoom limits. A new pure `pinDirection` function (in `connections.ts`) computes where a confirmed connection's visual "pin" points, derived from the two pieces' own positions. `ConnectionMarkers.tsx` is rewritten to add a preview line between a candidate's two (not-yet-coincident) anchor points, and to replace the confirmed-connection sphere — the one that gets buried inside the touching geometry — with a short pin cylinder extending away from the joint.

**Tech Stack:** TypeScript, Three.js, React Three Fiber, drei (`OrbitControls`), Zustand, Vitest (existing project stack — no new dependencies).

**Spec:** [docs/superpowers/specs/2026-09-01-camera-and-connection-visualization-design.md](../specs/2026-09-01-camera-and-connection-visualization-design.md)

## Global Constraints

- `geometry.ts`, `framing.ts`, and `connections.ts` are `engine/core` — pure functions, no `three` import, matching every existing function in `engine/core/*`. `App.tsx` and `scene/*.tsx` are app/scene layer, where `three` imports are normal and expected (see the existing `import * as THREE from 'three'` in both `App.tsx` and `sceneSessionStore.ts`).
- Pure `engine/core` functions get unit tests, per this project's established convention. `App.tsx` and `scene/*.tsx` stay untested (orchestration/rendering), matching `sceneSessionStore.ts`'s and `ConnectionMarkers.tsx`'s existing precedent — verified instead via `tsc -b` and manual/scripted smoke testing.
- `SNAP_DISTANCE` stays `0.7`, unchanged by this plan.
- `OrbitControls` zoom limits: `minDistance={1.5}`, `maxDistance={300}` (exact values from the spec).
- Connection visualization sizes: `MARKER_RADIUS = 0.5` (unchanged, existing candidate-orb radius), `LINE_RADIUS = 0.08` (candidate preview line), `PIN_RADIUS = 0.25` (confirmed-connection pin — same diameter as the old marker sphere, for a comparably easy tap target), `PIN_LENGTH = 1.5`.
- `Connection`/`ConnectionCandidate`, `findConnectionCandidates`, `confirmConnection`/`detachConnection` keep their exact current signatures and behavior — this plan is a visual-layer and camera-layer change only, it does not touch the connection data model.
- The old point-only `computeBounds` is deleted (not deprecated-in-place) once `App.tsx` no longer calls it — confirmed by grep that `App.tsx` is its only caller.

---

### Task 1: Share `applyRotation` via `geometry.ts`

**Files:**
- Modify: `wood-cad-workshop/src/engine/core/geometry.ts`
- Modify: `wood-cad-workshop/src/engine/core/geometry.test.ts`
- Modify: `wood-cad-workshop/src/engine/core/connectionPoints.ts`

**Interfaces:**
- Consumes: nothing new from other tasks.
- Produces: `export function applyRotation(rotation: Vec3, local: Vec3): Vec3` (geometry.ts) — for Task 2 (`framing.ts`) to consume.

`connectionPoints.ts` currently has its own local (unexported) `applyRotation` function. This task moves it verbatim to `geometry.ts` and exports it, so `framing.ts` can reuse the exact same rotation math without risking the two copies drifting apart. `connectionPoints.ts`'s own behavior is completely unchanged — it now imports the function instead of defining it.

- [ ] **Step 1: Add `applyRotation` to `geometry.ts`**

Add this function to `wood-cad-workshop/src/engine/core/geometry.ts`, after the existing `distance` function and before `closestPointOnSegment` (or anywhere at the top level — exact position doesn't matter, just keep it out of the other functions' bodies):

```ts
// Full 3-axis rotation matrix for three.js's default Euler order 'XYZ'
// (matches THREE.Matrix4.makeRotationFromEuler exactly, so this stays in
// sync with how Piece.tsx renders `instance.rotation`). Rotates a
// direction vector only — no translation. Reduces to a yaw-only formula
// when rx = rz = 0. Shared by connectionPoints.ts (anchor transforms)
// and framing.ts (camera bounding-box corners) so both stay in sync.
export function applyRotation(rotation: Vec3, local: Vec3): Vec3 {
  const [rx, ry, rz] = rotation
  const [lx, ly, lz] = local
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

  return [m11 * lx + m12 * ly + m13 * lz, m21 * lx + m22 * ly + m23 * lz, m31 * lx + m32 * ly + m33 * lz]
}
```

- [ ] **Step 2: Add direct tests for `applyRotation`**

Add this `describe` block to `wood-cad-workshop/src/engine/core/geometry.test.ts` (add `applyRotation` to the existing `import { ... } from './geometry'` line at the top):

```ts
describe('applyRotation', () => {
  it('leaves a vector unchanged under zero rotation', () => {
    const result = applyRotation([0, 0, 0], [1, 2, 3])
    expect(result[0]).toBeCloseTo(1)
    expect(result[1]).toBeCloseTo(2)
    expect(result[2]).toBeCloseTo(3)
  })

  it('rotates a +Z vector to +X under a 90-degree yaw (Y-axis rotation)', () => {
    const result = applyRotation([0, Math.PI / 2, 0], [0, 0, 1])
    expect(result[0]).toBeCloseTo(1)
    expect(result[1]).toBeCloseTo(0)
    expect(result[2]).toBeCloseTo(0)
  })

  it('rotates a +Z vector to -Y under a 90-degree pitch (X-axis rotation)', () => {
    const result = applyRotation([Math.PI / 2, 0, 0], [0, 0, 1])
    expect(result[0]).toBeCloseTo(0)
    expect(result[1]).toBeCloseTo(-1)
    expect(result[2]).toBeCloseTo(0)
  })
})
```

- [ ] **Step 3: Run the new tests to verify they pass**

Run: `cd wood-cad-workshop && npx vitest run src/engine/core/geometry.test.ts`
Expected: PASS, all cases including the 3 new `applyRotation` ones.

- [ ] **Step 4: Remove the local copy from `connectionPoints.ts` and import the shared one**

In `wood-cad-workshop/src/engine/core/connectionPoints.ts`, replace the import line:

```ts
import { closestPointOnSegment, closestPointOnRect, distance } from './geometry'
```

with:

```ts
import { applyRotation, closestPointOnSegment, closestPointOnRect, distance } from './geometry'
```

Then delete the entire local `applyRotation` function definition (the block starting `// Full 3-axis rotation matrix for three.js's default Euler order 'XYZ'` through its closing `}`, immediately before `function toWorldPoint`). Nothing else in the file changes — `toWorldPoint` and `toWorldAnchor` keep calling `applyRotation(...)` exactly as before, now resolving to the imported function.

- [ ] **Step 5: Run the full check (tsc + full test suite)**

Run: `cd wood-cad-workshop && npx tsc -b && npx vitest run`
Expected: PASS, no type errors, all existing tests green — `connectionPoints.test.ts`'s `toWorldAnchor` tests exercise this exact code path and must be unaffected, since the math itself hasn't changed, only its location.

- [ ] **Step 6: Commit**

```bash
git add wood-cad-workshop/src/engine/core/geometry.ts wood-cad-workshop/src/engine/core/geometry.test.ts wood-cad-workshop/src/engine/core/connectionPoints.ts
git commit -m "refactor: share applyRotation via geometry.ts for framing.ts to reuse"
```

---

### Task 2: `computeInstanceBounds` — geometry-aware camera bounds

**Files:**
- Modify: `wood-cad-workshop/src/engine/core/framing.ts` (full rewrite)
- Create: `wood-cad-workshop/src/engine/core/framing.test.ts`

**Interfaces:**
- Consumes: `applyRotation` (Task 1); `getBoxSize`, `getCylinderSize` from `./dimensions` (existing); `getComponent` from `../registry/registry` (existing); `ComponentInstance`, `Vec3` from `./types` (existing).
- Produces: `export interface Bounds { center: [number, number, number]; radius: number }` (unchanged shape), `export function computeInstanceBounds(instances: ComponentInstance[]): Bounds` — for Task 3 (`App.tsx`) to consume.

This task fully replaces `computeBounds` (point-only) with `computeInstanceBounds` (geometry-aware: reads each instance's actual `dimensions` and `rotation`, not just its `position`). No other file currently imports `computeBounds` besides `App.tsx` (confirmed by repo-wide grep), which Task 3 updates — so this task safely deletes it rather than leaving unused dead code.

- [ ] **Step 1: Write the failing tests**

Create `wood-cad-workshop/src/engine/core/framing.test.ts`:

```ts
import { describe, it, expect, beforeEach } from 'vitest'
import { registerComponent, clearRegistry } from '../registry/registry'
import { computeInstanceBounds } from './framing'
import type { ComponentDefinition, ComponentInstance } from './types'

function boardDefinition(): ComponentDefinition {
  return {
    id: 'test_board',
    name: 'Test Board',
    category: 'WOOD',
    geometry: { shape: 'box' },
    defaultDimensions: { thickness: 2, width: 4, length: 10 },
    material: '#000',
    connectionRole: 'ends',
    structuralProperties: {},
    explodeDirection: null,
  }
}

function rodDefinition(): ComponentDefinition {
  return {
    id: 'test_rod',
    name: 'Test Rod',
    category: 'WOOD',
    geometry: { shape: 'cylinder' },
    defaultDimensions: { diameter: 4, length: 10 },
    material: '#000',
    connectionRole: 'ends',
    structuralProperties: {},
    explodeDirection: null,
  }
}

beforeEach(() => {
  clearRegistry()
  registerComponent(boardDefinition())
  registerComponent(rodDefinition())
})

describe('computeInstanceBounds', () => {
  it('returns a small default sphere at the origin for an empty scene', () => {
    expect(computeInstanceBounds([])).toEqual({ center: [0, 0, 0], radius: 10 })
  })

  it('computes a radius that reflects a single piece\'s actual size, not a fixed floor', () => {
    // thickness=2, width=4, length=10 -> half-extents [1,2,5].
    // Old point-only computeBounds gave radius=1 (the floor) for any
    // single piece, regardless of size — this is the exact bug this
    // function fixes.
    const board: ComponentInstance = {
      id: 'b1', componentDefinitionId: 'test_board', position: [0, 0, 0], rotation: [0, 0, 0],
      dimensions: { thickness: 2, width: 4, length: 10 }, material: '#000',
    }
    const result = computeInstanceBounds([board])
    expect(result.center[0]).toBeCloseTo(0)
    expect(result.center[1]).toBeCloseTo(0)
    expect(result.center[2]).toBeCloseTo(0)
    // half-diagonal of a 2x4x10 box = sqrt(2^2+4^2+10^2)/2 = sqrt(120)/2
    expect(result.radius).toBeCloseTo(Math.sqrt(120) / 2, 3)
  })

  it('centers on the piece\'s own position when translated away from the origin', () => {
    const board: ComponentInstance = {
      id: 'b1', componentDefinitionId: 'test_board', position: [5, -3, 2], rotation: [0, 0, 0],
      dimensions: { thickness: 2, width: 4, length: 10 }, material: '#000',
    }
    const result = computeInstanceBounds([board])
    expect(result.center[0]).toBeCloseTo(5)
    expect(result.center[1]).toBeCloseTo(-3)
    expect(result.center[2]).toBeCloseTo(2)
    expect(result.radius).toBeCloseTo(Math.sqrt(120) / 2, 3)
  })

  it('accounts for rotation — a 45-degree yaw genuinely enlarges the bounding radius', () => {
    // thickness=2, width=2, length=10 -> half-extents [1,1,5]. Unrotated,
    // half-diagonal = sqrt(1^2+1^2+5^2) = sqrt(27). A 45-degree yaw tilts
    // the long axis partly into X, which — because the AABB must contain
    // the tilted box — genuinely grows the bounding radius to sqrt(37)/2.
    // A implementation that ignored rotation would incorrectly report
    // sqrt(27)/2 (~2.598) here instead of the correct ~3.0414.
    const board: ComponentInstance = {
      id: 'b1', componentDefinitionId: 'test_board', position: [0, 0, 0], rotation: [0, Math.PI / 4, 0],
      dimensions: { thickness: 2, width: 2, length: 10 }, material: '#000',
    }
    const result = computeInstanceBounds([board])
    expect(result.radius).toBeCloseTo(Math.sqrt(37) / 2, 3)
  })

  it('computes a cylinder\'s bounds from its radius and length', () => {
    // diameter=4 (radius=2), length=10 (half=5) -> half-extents [2,2,5].
    const rod: ComponentInstance = {
      id: 'r1', componentDefinitionId: 'test_rod', position: [0, 0, 0], rotation: [0, 0, 0],
      dimensions: { diameter: 4, length: 10 }, material: '#000',
    }
    const result = computeInstanceBounds([rod])
    expect(result.radius).toBeCloseTo(Math.sqrt(33) / 2, 3)
  })

  it('merges multiple pieces into one bounding sphere covering all of them', () => {
    const boardA: ComponentInstance = {
      id: 'a', componentDefinitionId: 'test_board', position: [-10, 0, 0], rotation: [0, 0, 0],
      dimensions: { thickness: 1, width: 1, length: 1 }, material: '#000',
    }
    const boardB: ComponentInstance = {
      id: 'b', componentDefinitionId: 'test_board', position: [10, 0, 0], rotation: [0, 0, 0],
      dimensions: { thickness: 1, width: 1, length: 1 }, material: '#000',
    }
    const result = computeInstanceBounds([boardA, boardB])
    expect(result.center[0]).toBeCloseTo(0)
    expect(result.center[1]).toBeCloseTo(0)
    expect(result.center[2]).toBeCloseTo(0)
    // merged AABB half-extents: x=10.5 (10 + half-thickness 0.5), y=0.5, z=0.5
    expect(result.radius).toBeCloseTo(Math.sqrt(21 * 21 + 1 + 1) / 2, 3)
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd wood-cad-workshop && npx vitest run src/engine/core/framing.test.ts`
Expected: FAIL — `computeInstanceBounds` is not exported / not defined (the current `framing.ts` only has `computeBounds`).

- [ ] **Step 3: Replace the full contents of `framing.ts`**

Replace the full contents of `wood-cad-workshop/src/engine/core/framing.ts` with:

```ts
import type { ComponentInstance, Vec3 } from './types'
import { getBoxSize, getCylinderSize } from './dimensions'
import { getComponent } from '../registry/registry'
import { applyRotation } from './geometry'

export interface Bounds {
  center: [number, number, number]
  radius: number
}

// Local (pre-rotation/position) half-extents of one instance's own
// axis-aligned bounding box, in the same local-Z-is-length convention
// getAnchors() (connectionPoints.ts) uses. A cylinder gets a
// conservative box — its own radius on both non-length axes — rather
// than its true rotated-cylinder bounds: simpler, and never
// underestimates the space the piece actually occupies.
function localHalfExtents(instance: ComponentInstance): Vec3 {
  const definition = getComponent(instance.componentDefinitionId)
  if (definition.geometry.shape === 'cylinder') {
    const { radius, height } = getCylinderSize(instance)
    return [radius, radius, height / 2]
  }
  const [thickness, width, length] = getBoxSize(instance)
  return [thickness / 2, width / 2, length / 2]
}

// World-space bounding sphere (center + radius) enclosing every
// instance's ACTUAL rotated geometry — not just its center position.
// Replaces the old point-only computeBounds, which treated every piece
// as a zero-size point and routinely placed the camera inside/grazing a
// long piece's own surface when framing a scene (see the camera design
// spec's root-cause investigation). Falls back to a small sphere at the
// origin for an empty scene, matching the old function's behavior.
export function computeInstanceBounds(instances: ComponentInstance[]): Bounds {
  if (instances.length === 0) {
    return { center: [0, 0, 0], radius: 10 }
  }

  let min: Vec3 = [Infinity, Infinity, Infinity]
  let max: Vec3 = [-Infinity, -Infinity, -Infinity]

  for (const instance of instances) {
    const [hx, hy, hz] = localHalfExtents(instance)
    for (const sx of [-1, 1] as const) {
      for (const sy of [-1, 1] as const) {
        for (const sz of [-1, 1] as const) {
          const local: Vec3 = [sx * hx, sy * hy, sz * hz]
          const rotated = applyRotation(instance.rotation, local)
          const world: Vec3 = [
            instance.position[0] + rotated[0],
            instance.position[1] + rotated[1],
            instance.position[2] + rotated[2],
          ]
          min = [Math.min(min[0], world[0]), Math.min(min[1], world[1]), Math.min(min[2], world[2])]
          max = [Math.max(max[0], world[0]), Math.max(max[1], world[1]), Math.max(max[2], world[2])]
        }
      }
    }
  }

  const center: [number, number, number] = [
    (min[0] + max[0]) / 2,
    (min[1] + max[1]) / 2,
    (min[2] + max[2]) / 2,
  ]
  const dx = max[0] - min[0]
  const dy = max[1] - min[1]
  const dz = max[2] - min[2]
  const radius = Math.sqrt(dx * dx + dy * dy + dz * dz) / 2
  return { center, radius }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd wood-cad-workshop && npx vitest run src/engine/core/framing.test.ts`
Expected: PASS, all 6 cases.

- [ ] **Step 5: Run the full check (tsc + full test suite)**

Run: `cd wood-cad-workshop && npx tsc -b && npx vitest run`
Expected: FAIL at this point — `App.tsx` still imports and calls the now-deleted `computeBounds`. Confirm the ONLY failure is a TypeScript error in `App.tsx` (`computeBounds` no longer exported from `'./engine'`), not anything inside `framing.ts`/`framing.test.ts`/`geometry.ts` themselves. Task 3 fixes `App.tsx`.

- [ ] **Step 6: Commit**

```bash
git add wood-cad-workshop/src/engine/core/framing.ts wood-cad-workshop/src/engine/core/framing.test.ts
git commit -m "feat: compute camera bounds from actual piece geometry, not center points"
```

---

### Task 3: Wire `App.tsx` to `computeInstanceBounds` and add zoom limits

**Files:**
- Modify: `wood-cad-workshop/src/App.tsx`

**Interfaces:**
- Consumes: `computeInstanceBounds` (Task 2), `ComponentInstance` type (existing, via the `../engine` barrel — already re-exports `./core/types`).
- Produces: no new exports — `frame`/`handleFrameAll`/`handleFrameSelected` keep being called the same way from `ViewControls`/`MainMenu`, only their internal implementation changes.

This task is app-layer orchestration — per this project's established convention (matching `sceneSessionStore.ts`), left untested beyond `tsc -b` and a manual/scripted smoke check.

- [ ] **Step 1: Update imports**

In `wood-cad-workshop/src/App.tsx`, replace:

```ts
import { getViewPreset, computeBounds } from './engine'
import type { ViewName } from './engine'
```

with:

```ts
import { getViewPreset, computeInstanceBounds } from './engine'
import type { ComponentInstance, ViewName } from './engine'
```

- [ ] **Step 2: Update `frame()` to take pieces, not positions**

Replace:

```ts
  const frame = (positions: Array<[number, number, number]>) => {
    const controls = controlsRef.current
    if (!controls) return
    const camera = controls.object as THREE.PerspectiveCamera
    const { center, radius } = computeBounds(positions)
    const distance = Math.max(radius * 2.5, 10)
    const direction = new THREE.Vector3().subVectors(camera.position, controls.target).normalize()
    controls.target.set(...center)
    camera.position.copy(controls.target).addScaledVector(direction, distance)
    camera.lookAt(controls.target)
    controls.update()
  }

  const handleFrameAll = () => frame(instances.map((i) => i.position))
  const handleFrameSelected = () => {
    const selected = instances.find((i) => i.id === selectedId)
    if (selected) frame([selected.position])
  }
```

with:

```ts
  const frame = (pieces: ComponentInstance[]) => {
    const controls = controlsRef.current
    if (!controls) return
    const camera = controls.object as THREE.PerspectiveCamera
    const { center, radius } = computeInstanceBounds(pieces)
    const distance = Math.max(radius * 2.5, 10)
    const direction = new THREE.Vector3().subVectors(camera.position, controls.target).normalize()
    controls.target.set(...center)
    camera.position.copy(controls.target).addScaledVector(direction, distance)
    camera.lookAt(controls.target)
    controls.update()
  }

  const handleFrameAll = () => frame(instances)
  const handleFrameSelected = () => {
    const selected = instances.find((i) => i.id === selectedId)
    if (selected) frame([selected])
  }
```

(The `distance`/`direction`/margin logic is untouched — only what feeds `center`/`radius` changes.)

- [ ] **Step 3: Add zoom limits to `OrbitControls`**

Replace:

```tsx
        <OrbitControls
          ref={controlsRef}
          makeDefault
          enabled={!isDraggingPiece}
          onStart={handleOrbitStart}
        />
```

with:

```tsx
        <OrbitControls
          ref={controlsRef}
          makeDefault
          enabled={!isDraggingPiece}
          onStart={handleOrbitStart}
          minDistance={1.5}
          maxDistance={300}
        />
```

- [ ] **Step 4: Run the full check (tsc + full test suite)**

Run: `cd wood-cad-workshop && npx tsc -b && npx vitest run`
Expected: PASS, 0 type errors, all tests green.

- [ ] **Step 5: Manual/scripted smoke test**

Start the dev server (`npm run dev` from `wood-cad-workshop/`) and verify by hand (or via a throwaway Playwright script, not committed) that:
1. With the default 2-board seed scene, "Frame All" still produces a reasonable framed view (not worse than before).
2. Spawn or construct a scene with a long piece (e.g. stand a `vertical_post`, default length 84, upright) and click "Frame All" — the camera should land far enough back to see the whole piece, not end up grazing its surface.
3. Scroll-zoom in as far as possible — the camera stops at a reasonable minimum distance rather than passing through geometry. Scroll-zoom out as far as possible — it stops at a bounded maximum rather than zooming out indefinitely.

- [ ] **Step 6: Commit**

```bash
git add wood-cad-workshop/src/App.tsx
git commit -m "feat: frame camera from real piece geometry, add OrbitControls zoom limits"
```

---

### Task 4: `pinDirection` — where a confirmed connection's visual pin points

**Files:**
- Modify: `wood-cad-workshop/src/engine/core/connections.ts`
- Modify: `wood-cad-workshop/src/engine/core/connections.test.ts`

**Interfaces:**
- Consumes: `Vec3`, `ComponentInstance` types (existing).
- Produces: `export function pinDirection(joint: Vec3, pieceA: ComponentInstance, pieceB: ComponentInstance): Vec3` — for Task 5 (`ConnectionMarkers.tsx`) to consume.

**Deliberate refinement over the spec's literal wording:** the spec describes a 3-level position-based fallback chain (average of both centers → piece A's own center → piece B's own center → world-up). Working through the exact degenerate case that fallback chain exists for (a straight coaxial end-to-end join, where the average-center heuristic goes to zero) showed that the piece-A/piece-B fallback levels point the pin *along the shared axis* — i.e., **into** whichever piece sits on that side, not into open air. That's the opposite of what a pin is for. This task instead falls back directly to world-up in that case, skipping the counterproductive middle levels — still satisfying the spec's actual intent ("derived from real positions, never a hardcoded axis except as a last resort") with a chain that's simpler and correct for the case it exists to handle.

- [ ] **Step 1: Write the failing tests**

Add this `describe` block to `wood-cad-workshop/src/engine/core/connections.test.ts` (add `pinDirection` to the existing `import { ... } from './connections'` line, and add `Vec3` to the existing `import type { ... } from './types'` line, at the top of the file):

```ts
describe('pinDirection', () => {
  it('points from the joint away from the average of both piece centers', () => {
    const pieceA: ComponentInstance = {
      id: 'a', componentDefinitionId: 'test_board', position: [0, 1.75, 0], rotation: [0, 0, 0],
      dimensions: { thickness: 1.5, width: 3.5, length: 10 }, material: '#000',
    }
    const pieceB: ComponentInstance = {
      id: 'b', componentDefinitionId: 'test_rod', position: [0, 6.75, 5], rotation: [Math.PI / 2, 0, 0],
      dimensions: { thickness: 3.5, width: 3.5, length: 10 }, material: '#000',
    }
    // avgCenter = (0, 4.25, 2.5); joint - avgCenter = (0, -2.5, 2.5),
    // which normalizes to (0, -1/sqrt(2), 1/sqrt(2)).
    const joint: Vec3 = [0, 1.75, 5]
    const dir = pinDirection(joint, pieceA, pieceB)
    expect(dir[0]).toBeCloseTo(0)
    expect(dir[1]).toBeCloseTo(-Math.SQRT1_2)
    expect(dir[2]).toBeCloseTo(Math.SQRT1_2)
  })

  it('always returns a unit vector', () => {
    const pieceA: ComponentInstance = {
      id: 'a', componentDefinitionId: 'test_board', position: [1, 2, 3], rotation: [0, 0, 0],
      dimensions: { thickness: 1.5, width: 3.5, length: 10 }, material: '#000',
    }
    const pieceB: ComponentInstance = {
      id: 'b', componentDefinitionId: 'test_board', position: [4, -2, 7], rotation: [0, 0, 0],
      dimensions: { thickness: 1.5, width: 3.5, length: 10 }, material: '#000',
    }
    const dir = pinDirection([2, 1, 4], pieceA, pieceB)
    const len = Math.sqrt(dir[0] * dir[0] + dir[1] * dir[1] + dir[2] * dir[2])
    expect(len).toBeCloseTo(1)
  })

  it('falls back to world-up when the joint coincides with the average of both piece centers (straight coaxial join)', () => {
    // Two boards end to end along Z, same height, touching at their
    // shared midpoint z=5 — which is exactly the average of both
    // centers, degenerating the primary heuristic to a zero vector.
    const pieceA: ComponentInstance = {
      id: 'a', componentDefinitionId: 'test_board', position: [0, 1.75, 0], rotation: [0, 0, 0],
      dimensions: { thickness: 1.5, width: 3.5, length: 10 }, material: '#000',
    }
    const pieceB: ComponentInstance = {
      id: 'b', componentDefinitionId: 'test_board', position: [0, 1.75, 10], rotation: [0, 0, 0],
      dimensions: { thickness: 1.5, width: 3.5, length: 10 }, material: '#000',
    }
    const joint: Vec3 = [0, 1.75, 5]
    expect(pinDirection(joint, pieceA, pieceB)).toEqual([0, 1, 0])
  })

  it('is symmetric under swapping pieceA and pieceB', () => {
    const pieceA: ComponentInstance = {
      id: 'a', componentDefinitionId: 'test_board', position: [0, 1.75, 0], rotation: [0, 0, 0],
      dimensions: { thickness: 1.5, width: 3.5, length: 10 }, material: '#000',
    }
    const pieceB: ComponentInstance = {
      id: 'b', componentDefinitionId: 'test_rod', position: [0, 6.75, 5], rotation: [Math.PI / 2, 0, 0],
      dimensions: { thickness: 3.5, width: 3.5, length: 10 }, material: '#000',
    }
    const joint: Vec3 = [0, 1.75, 5]
    expect(pinDirection(joint, pieceA, pieceB)).toEqual(pinDirection(joint, pieceB, pieceA))
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd wood-cad-workshop && npx vitest run src/engine/core/connections.test.ts`
Expected: FAIL — `pinDirection` is not exported / not defined.

- [ ] **Step 3: Add `pinDirection` to `connections.ts`**

In `wood-cad-workshop/src/engine/core/connections.ts`, update the top import line from:

```ts
import type { AnchorRef, ComponentInstance, Connection } from './types'
```

to:

```ts
import type { AnchorRef, ComponentInstance, Connection, Vec3 } from './types'
```

Then add this function anywhere at the top level (e.g. after `findConnectionCandidates`, at the end of the file):

```ts
const PIN_DIRECTION_EPSILON = 0.01

// Direction a confirmed connection's visual "pin" (see
// ConnectionMarkers.tsx) points, away from the joint into open air. The
// two anchor points of a confirmed Connection are coincident by
// construction (confirmConnection closes any gap exactly), so there's no
// meaningful line to draw between them — the pin instead extends a fixed
// length from that single joint point, in this direction.
//
// Primary heuristic: point away from the average of both connected
// pieces' own positions. Falls back to world-up when that's degenerate
// (near-zero) — which happens for a straight coaxial end-to-end join,
// where both piece centers and the joint sit collinear at the same
// height. A direction ALONG that shared axis would point straight into
// whichever piece sits on that side, not into open air, so world-up (
// perpendicular to a flat-lying join) is used instead of a
// piece-position-based fallback there. Derived entirely from the actual
// piece/joint positions — never a hardcoded world axis except in that
// one fallback case.
export function pinDirection(joint: Vec3, pieceA: ComponentInstance, pieceB: ComponentInstance): Vec3 {
  const avgCenter: Vec3 = [
    (pieceA.position[0] + pieceB.position[0]) / 2,
    (pieceA.position[1] + pieceB.position[1]) / 2,
    (pieceA.position[2] + pieceB.position[2]) / 2,
  ]
  const d: Vec3 = [joint[0] - avgCenter[0], joint[1] - avgCenter[1], joint[2] - avgCenter[2]]
  const len = Math.sqrt(d[0] * d[0] + d[1] * d[1] + d[2] * d[2])
  if (len < PIN_DIRECTION_EPSILON) return [0, 1, 0]
  return [d[0] / len, d[1] / len, d[2] / len]
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd wood-cad-workshop && npx vitest run src/engine/core/connections.test.ts`
Expected: PASS, all cases including the 4 new `pinDirection` ones.

- [ ] **Step 5: Run the full check (tsc + full test suite)**

Run: `cd wood-cad-workshop && npx tsc -b && npx vitest run`
Expected: PASS, no type errors, all tests green (this task only adds a new export, doesn't change any existing behavior).

- [ ] **Step 6: Commit**

```bash
git add wood-cad-workshop/src/engine/core/connections.ts wood-cad-workshop/src/engine/core/connections.test.ts
git commit -m "feat: add pinDirection for confirmed-connection pin placement"
```

---

### Task 5: `ConnectionMarkers.tsx` — candidate preview line + confirmed pin

**Files:**
- Modify: `wood-cad-workshop/src/scene/ConnectionMarkers.tsx` (full rewrite)

**Interfaces:**
- Consumes: `closestBetweenWorldAnchors`, `getAnchors`, `toWorldAnchor`, `findConnectionCandidates`, `SNAP_DISTANCE`, `AnchorMatch`, `ConnectionCandidate` (existing, via the `../engine` barrel), `pinDirection` (Task 4), `ComponentInstance` type (existing).
- Produces: no new exports — this is a leaf UI component, nothing depends on it.

This is UI/rendering code — per this project's established convention (matching every other `scene/*.tsx` component), left untested. Verify via `tsc` + manual/scripted smoke test.

**What changes, conceptually:** today, both a candidate and a confirmed connection render as an opaque sphere at the touching point — which is exactly what gets buried inside the connecting pieces' own geometry (the root-caused bug). This rewrite keeps the candidate sphere (a real gap still exists there, up to `SNAP_DISTANCE`, so the sphere isn't as badly occluded) and adds a thin preview-line cylinder between the candidate's two distinct anchor points. For a **confirmed** connection, the sphere is removed entirely and replaced with a short pin cylinder extending away from the joint along `pinDirection` — since the two points are coincident there, a line *between* them would be zero-length, which is why the pin extends a fixed distance instead.

- [ ] **Step 1: Replace `ConnectionMarkers.tsx`'s contents**

Replace the full contents of `wood-cad-workshop/src/scene/ConnectionMarkers.tsx` with:

```tsx
import { useRef } from 'react'
import type { ThreeEvent } from '@react-three/fiber'
import * as THREE from 'three'
import { closestBetweenWorldAnchors, findConnectionCandidates, getAnchors, pinDirection, SNAP_DISTANCE, toWorldAnchor } from '../engine'
import type { AnchorMatch, ComponentInstance, ConnectionCandidate } from '../engine'
import { useSceneSession } from '../store/sceneSessionStore'

// Candidate orb — bigger than the piece geometry it sits on top of, an
// easier touch target than the raw joint. Unchanged from before this
// change.
const MARKER_RADIUS = 0.5
// Candidate preview line — thinner than the orb, a secondary visual cue
// showing the two anchors about to snap together.
const LINE_RADIUS = 0.08
// Confirmed-connection pin — same diameter as the old marker sphere it
// replaces, for a comparably easy tap target.
const PIN_RADIUS = 0.25
const PIN_LENGTH = 1.5
const CANDIDATE_COLOR = '#ff8c00'
const CONNECTED_COLOR = '#d9342b'
// A fast double-tap confirms then instantly detaches, since the confirm
// and detach markers can land at the same screen position and React
// flushes both synchronous clicks before either marker's position
// updates. This cooldown makes a detach click on a connection ignored if
// it lands within this many ms of that same connection's own confirm
// click.
const DETACH_COOLDOWN_MS = 400

const WORLD_UP = new THREE.Vector3(0, 1, 0)

// Position, orientation, and length for a unit cylinder (default local
// +Y axis, height 1) so it spans from `from` to `to` — shared by the
// candidate preview line (between two distinct anchor points) and the
// confirmed pin (between the joint and a point offset along
// pinDirection). Returns length 0 (caller's responsibility to skip
// rendering) if `from`/`to` are coincident, since a cylinder can't be
// meaningfully oriented over a zero-length span.
function segmentTransform(from: [number, number, number], to: [number, number, number]) {
  const start = new THREE.Vector3(...from)
  const end = new THREE.Vector3(...to)
  const mid = start.clone().add(end).multiplyScalar(0.5)
  const delta = end.clone().sub(start)
  const length = delta.length()
  const quaternion =
    length > 1e-6 ? new THREE.Quaternion().setFromUnitVectors(WORLD_UP, delta.clone().normalize()) : new THREE.Quaternion()
  return { position: mid.toArray() as [number, number, number], quaternion, length }
}

// One visual per active Connection (a pin) and per not-yet-confirmed
// candidate (an orb + preview line) — both hidden during exploded view,
// same as the rotation gizmo and vertical-move handle in Piece.tsx.
export function ConnectionMarkers() {
  const instances = useSceneSession((s) => s.instances)
  const connections = useSceneSession((s) => s.connections)
  const explodeAmount = useSceneSession((s) => s.explodeAmount)
  const confirmConnection = useSceneSession((s) => s.confirmConnection)
  const detachConnection = useSceneSession((s) => s.detachConnection)
  const justConfirmedAt = useRef<Map<string, number>>(new Map())

  if (explodeAmount > 0) return null

  // Full closest-approach match between two anchors, plus the piece
  // instances themselves (pinDirection needs their positions). Returns
  // null if either piece or anchor no longer exists (e.g. deleted
  // mid-render).
  const matchOf = (
    pieceAId: string,
    aAnchorIndex: number,
    pieceBId: string,
    bAnchorIndex: number,
  ): { pieceA: ComponentInstance; pieceB: ComponentInstance; match: AnchorMatch } | null => {
    const pieceA = instances.find((i) => i.id === pieceAId)
    const pieceB = instances.find((i) => i.id === pieceBId)
    if (!pieceA || !pieceB) return null
    const anchorA = getAnchors(pieceA)[aAnchorIndex]
    const anchorB = getAnchors(pieceB)[bAnchorIndex]
    if (!anchorA || !anchorB) return null
    const worldA = toWorldAnchor(pieceA, anchorA)
    const worldB = toWorldAnchor(pieceB, anchorB)
    return { pieceA, pieceB, match: closestBetweenWorldAnchors(worldA, worldB) }
  }

  // Stops the click/pointerdown from also reaching Scene.tsx's ground
  // plane behind the marker, which would otherwise deselect the
  // currently-selected piece as a side effect of confirming/detaching.
  const stop = (e: ThreeEvent<PointerEvent> | ThreeEvent<MouseEvent>) => e.stopPropagation()

  const candidates = findConnectionCandidates(instances, connections, SNAP_DISTANCE)

  const candidateKey = (c: ConnectionCandidate) =>
    `candidate-${c.pieceAId}-${c.a.anchorIndex}-${c.pieceBId}-${c.b.anchorIndex}`

  return (
    <>
      {candidates.map((candidate) => {
        const found = matchOf(candidate.pieceAId, candidate.a.anchorIndex, candidate.pieceBId, candidate.b.anchorIndex)
        if (!found) return null
        const { match } = found
        const midpoint: [number, number, number] = [
          (match.pointA[0] + match.pointB[0]) / 2,
          (match.pointA[1] + match.pointB[1]) / 2,
          (match.pointA[2] + match.pointB[2]) / 2,
        ]
        const line = segmentTransform(match.pointA, match.pointB)
        const onConfirm = (e: ThreeEvent<MouseEvent>) => {
          stop(e)
          const connectionId = `conn-${candidate.pieceAId}-${candidate.pieceBId}-${candidate.a.anchorIndex}-${candidate.b.anchorIndex}`
          justConfirmedAt.current.set(connectionId, Date.now())
          confirmConnection(candidate)
        }
        return (
          <group key={candidateKey(candidate)}>
            {line.length > 1e-6 && (
              <mesh position={line.position} quaternion={line.quaternion} onPointerDown={stop} onClick={onConfirm}>
                <cylinderGeometry args={[LINE_RADIUS, LINE_RADIUS, line.length, 8]} />
                <meshStandardMaterial color={CANDIDATE_COLOR} />
              </mesh>
            )}
            <mesh position={midpoint} onPointerDown={stop} onClick={onConfirm}>
              <sphereGeometry args={[MARKER_RADIUS, 12, 12]} />
              <meshStandardMaterial color={CANDIDATE_COLOR} />
            </mesh>
          </group>
        )
      })}
      {connections.map((connection) => {
        const found = matchOf(connection.pieceAId, connection.a.anchorIndex, connection.pieceBId, connection.b.anchorIndex)
        if (!found) return null
        const { pieceA, pieceB, match } = found
        // Coincident by construction (confirmConnection closes the gap
        // exactly) — either point is the joint.
        const joint = match.pointA
        const direction = pinDirection(joint, pieceA, pieceB)
        const tip: [number, number, number] = [
          joint[0] + direction[0] * PIN_LENGTH,
          joint[1] + direction[1] * PIN_LENGTH,
          joint[2] + direction[2] * PIN_LENGTH,
        ]
        const pin = segmentTransform(joint, tip)
        const onDetach = (e: ThreeEvent<MouseEvent>) => {
          stop(e)
          const confirmedAt = justConfirmedAt.current.get(connection.id)
          if (confirmedAt !== undefined && Date.now() - confirmedAt < DETACH_COOLDOWN_MS) return
          detachConnection(connection.id)
        }
        return (
          <mesh key={connection.id} position={pin.position} quaternion={pin.quaternion} onPointerDown={stop} onClick={onDetach}>
            <cylinderGeometry args={[PIN_RADIUS, PIN_RADIUS, PIN_LENGTH, 12]} />
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
Expected: PASS, no type errors, all tests green — this is the first point in this plan where the whole project compiles clean end-to-end.

- [ ] **Step 3: Manual/scripted smoke test**

Start the dev server and verify by hand (or via a throwaway Playwright script, not committed — the investigation session already built and validated this exact pattern: expose `useSceneSession` and the `engine` barrel on `window` temporarily in `main.tsx`, drive the store directly via `store.setState`, screenshot, then revert):

1. Reproduce the originally-reported bug: a horizontal board and a vertical (stood-up) post touching at their connection points. Where the old sphere was invisible, a red pin should now be clearly visible extending away from the joint into open air.
2. Drag two pieces close together (not yet confirmed) — the orange candidate orb AND a thin preview line between the two anchor points should both be visible.
3. Click the pin (or the candidate orb/line) to confirm/detach — the click targets still work; a fast double-tap on a just-confirmed pin doesn't immediately detach it (the existing cooldown behavior, unchanged).
4. Existing tip-to-tip board connections (the simplest, most common case) still look reasonable — the pin doesn't end up buried or pointing somewhere nonsensical.

- [ ] **Step 4: Commit**

```bash
git add wood-cad-workshop/src/scene/ConnectionMarkers.tsx
git commit -m "feat: replace occluded confirmed-connection sphere with a pin, add candidate preview line"
```
