# Wood CAD Workshop — Foundation (Three.js/R3F) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a camera/view system, an engine-agnostic component data model, and a minimal view-control bar to `spikes/touch-spike-threejs/`, while migrating the two existing hardcoded boards onto the new data model without regressing tap-select/drag-move.

**Architecture:** New pure, rendering-free modules (`component.ts`, `viewPresets.ts`, `framing.ts`) hold data/math. `Board`/`Scene` are updated to consume `ComponentInstance`/`ComponentDefinition` instead of the old `BoardData` type. Camera orbit/pan/zoom comes from `@react-three/drei`'s `OrbitControls` (already a dependency), gated off during piece-drag via a lifted `isDraggingPiece` ref so a one-finger drag never drives both the camera and a board at once. A new `ViewControls` component renders the preset-view button bar and drives `OrbitControls` via its ref for view snapping and framing.

**Tech Stack:** React 19, `@react-three/fiber` 9, `@react-three/drei` 10, `three` 0.185, TypeScript, Vite — all already in `spikes/touch-spike-threejs/package.json`; no new dependencies.

**Spec:** `docs/superpowers/specs/2026-08-22-wood-cad-workshop-design.md` (Sub-project 1 — Foundation)

## Global Constraints

- **No automated tests this session, for either engine** (explicit user decision, 2026-08-22, overriding this plan's original TDD structure): no new `*.test.ts`/`*.test.tsx` files, no Vitest. Verification is manual/visual only, per each task's manual verification steps. Existing tests already in the repo (`snap.test.ts`) are untouched but not a gate for these tasks.
- One-finger drag on empty space = orbit; two-finger drag = pan; pinch = zoom; tap a piece = select; tap empty space = deselect. Object-drag and camera-drag must never both fire from the same gesture.
- Coordinate system is Y = up, X = left/right, Z = depth (already the case in this codebase).
- Geometry is procedural from dimensions — never swap meshes/assets when dimensions change.
- `ComponentDefinition.connectionPoints`, `structuralProperties`, and `explodeDirection` exist in the schema but are not computed or consumed this phase (empty array / empty object / `null`).
- No shared runtime/source between the Three.js and Godot implementations — same concepts, native code in each.
- Existing `snap.ts`, the grid, and the tap-select/drag-move interaction must keep working exactly as before (regression check).
- Follow the existing flat `src/` layout — no new subdirectories.

---

### Task 1: Component data model

**Files:**
- Create: `spikes/touch-spike-threejs/src/component.ts`

**Interfaces:**
- Consumes: nothing (leaf module).
- Produces: `ComponentCategory`, `GeometryDescriptor`, `Dimensions`, `ComponentDefinition`, `ComponentInstance` types; `BOARD_DEFINITION: ComponentDefinition`; `INITIAL_BOARD_INSTANCES: ComponentInstance[]`; `getBoxSize(instance: ComponentInstance): [number, number, number]` — all consumed by Task 2.

- [ ] **Step 1: Write the module**

```typescript
// spikes/touch-spike-threejs/src/component.ts

export type ComponentCategory = 'WOOD' | 'HARDWARE' | 'FASTENER'

export type GeometryDescriptor = { shape: 'box' } | { shape: 'cylinder' }

export type Dimensions = Record<string, number>

export interface ComponentDefinition {
  id: string
  name: string
  category: ComponentCategory
  geometry: GeometryDescriptor
  defaultDimensions: Dimensions
  material: string
  connectionPoints: unknown[]
  structuralProperties: Record<string, never>
  explodeDirection: null
}

export interface ComponentInstance {
  id: string
  componentDefinitionId: string
  position: [number, number, number]
  rotation: [number, number, number]
  dimensions: Dimensions
  material: string
}

export const BOARD_DEFINITION: ComponentDefinition = {
  id: 'board',
  name: 'Board',
  category: 'WOOD',
  geometry: { shape: 'box' },
  defaultDimensions: { thickness: 1.5, width: 3.5, length: 48 },
  material: '#a6693f',
  connectionPoints: [],
  structuralProperties: {},
  explodeDirection: null,
}

export const INITIAL_BOARD_INSTANCES: ComponentInstance[] = [
  {
    id: 'board-a',
    componentDefinitionId: 'board',
    position: [-6, 1.75, 0],
    rotation: [0, 0, 0],
    dimensions: { thickness: 1.5, width: 3.5, length: 48 },
    material: '#a6693f',
  },
  {
    id: 'board-b',
    componentDefinitionId: 'board',
    position: [6, 1.75, 0],
    rotation: [0, 0, 0],
    dimensions: { thickness: 1.5, width: 3.5, length: 36 },
    material: '#8c5730',
  },
]

export function getBoxSize(instance: ComponentInstance): [number, number, number] {
  const { thickness, width, length } = instance.dimensions
  return [thickness, width, length]
}
```

- [ ] **Step 2: Typecheck**

Run: `cd spikes/touch-spike-threejs && npx tsc -b --noEmit`
Expected: no type errors. (This is a compiler sanity pass, not a test suite — no test files are created this task.)

- [ ] **Step 3: Commit**

```bash
git add spikes/touch-spike-threejs/src/component.ts
git commit -m "feat(threejs-spike): add ComponentDefinition/ComponentInstance data model"
```

---

### Task 2: Migrate Scene/Board to the component model

**Files:**
- Modify: `spikes/touch-spike-threejs/src/Scene.tsx`
- Modify: `spikes/touch-spike-threejs/src/Board.tsx`

**Interfaces:**
- Consumes: `ComponentDefinition`, `ComponentInstance`, `BOARD_DEFINITION`, `INITIAL_BOARD_INSTANCES`, `getBoxSize` from Task 1's `./component`.
- Produces: `Scene` now accepts `onDragStateChange: (dragging: boolean) => void` prop, consumed by Task 5.

This task removes `BoardData`/`BOARDS` entirely — nothing else in the codebase imports them (confirmed: only `Scene.tsx` defines them and `Board.tsx` imports the type).

- [ ] **Step 1: Update Scene.tsx to use the component model**

```typescript
// spikes/touch-spike-threejs/src/Scene.tsx
import { useState } from 'react'
import { Board } from './Board'
import { BOARD_DEFINITION, INITIAL_BOARD_INSTANCES } from './component'
import type { ComponentInstance } from './component'

export function Scene({
  onDragStateChange,
}: {
  onDragStateChange: (dragging: boolean) => void
}) {
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [instances] = useState<ComponentInstance[]>(INITIAL_BOARD_INSTANCES)

  return (
    <>
      <ambientLight intensity={0.6} />
      <directionalLight position={[10, 20, 10]} intensity={0.8} />
      <gridHelper args={[120, 120, '#808080', '#808080']} />
      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        onPointerDown={() => setSelectedId(null)}
      >
        <planeGeometry args={[120, 120]} />
        <meshStandardMaterial transparent opacity={0} />
      </mesh>
      {instances.map((instance) => (
        <Board
          key={instance.id}
          instance={instance}
          definition={BOARD_DEFINITION}
          selected={selectedId === instance.id}
          onSelect={setSelectedId}
          onDragStateChange={onDragStateChange}
        />
      ))}
    </>
  )
}
```

- [ ] **Step 2: Update Board.tsx to consume `instance`/`definition` and report drag state**

```typescript
// spikes/touch-spike-threejs/src/Board.tsx
import { useRef, useState } from 'react'
import type { ThreeEvent } from '@react-three/fiber'
import * as THREE from 'three'
import type { ComponentDefinition, ComponentInstance } from './component'
import { getBoxSize } from './component'
import { snapValue } from './snap'

const GRID_INCREMENT = 1
const GROUND_PLANE = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0)

export function Board({
  instance,
  definition,
  selected,
  onSelect,
  onDragStateChange,
}: {
  instance: ComponentInstance
  definition: ComponentDefinition
  selected: boolean
  onSelect: (id: string) => void
  onDragStateChange: (dragging: boolean) => void
}) {
  const [pos, setPos] = useState(instance.position)
  const dragging = useRef(false)
  const dragOffset = useRef<[number, number]>([0, 0])

  const groundHit = (ray: THREE.Ray): THREE.Vector3 | null => {
    const target = new THREE.Vector3()
    return ray.intersectPlane(GROUND_PLANE, target)
  }

  const handlePointerDown = (e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation()
    ;(e.target as Element).setPointerCapture(e.pointerId)
    onSelect(instance.id)
    dragging.current = true
    onDragStateChange(true)
    const hit = groundHit(e.ray)
    dragOffset.current = hit ? [pos[0] - hit.x, pos[2] - hit.z] : [0, 0]
  }

  const handlePointerMove = (e: ThreeEvent<PointerEvent>) => {
    if (!dragging.current) return
    // Deliberately e.ray, not e.point: once the pointer is captured,
    // e.point/e.object replay a stale intersection from pick time if the
    // live raycast no longer hits this mesh. e.ray is always live.
    const hit = groundHit(e.ray)
    if (!hit) return
    const [offsetX, offsetZ] = dragOffset.current
    const snappedX = snapValue(hit.x + offsetX, GRID_INCREMENT)
    const snappedZ = snapValue(hit.z + offsetZ, GRID_INCREMENT)
    setPos([snappedX, pos[1], snappedZ])
  }

  const handlePointerUp = (e: ThreeEvent<PointerEvent>) => {
    dragging.current = false
    onDragStateChange(false)
    ;(e.target as Element).releasePointerCapture(e.pointerId)
  }

  const size = getBoxSize(instance)
  void definition // threaded through for future sub-projects (materials, geometry variants); unused this phase beyond its instance override

  return (
    <mesh
      position={pos}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
    >
      <boxGeometry args={size} />
      <meshStandardMaterial color={selected ? '#ffb347' : instance.material} />
    </mesh>
  )
}
```

- [ ] **Step 3: Update App.tsx to pass a no-op `onDragStateChange` for now (Task 5 wires it for real)**

```typescript
// spikes/touch-spike-threejs/src/App.tsx
import { Canvas } from '@react-three/fiber'
import { Scene } from './Scene'

function App() {
  return (
    <div style={{ width: '100vw', height: '100vh', touchAction: 'none' }}>
      <Canvas camera={{ position: [0, 20, 25], fov: 50 }}>
        <Scene onDragStateChange={() => {}} />
      </Canvas>
    </div>
  )
}

export default App
```

- [ ] **Step 4: Typecheck**

Run: `cd spikes/touch-spike-threejs && npx tsc -b --noEmit`
Expected: no type errors.

- [ ] **Step 5: Manual regression check**

Run: `cd spikes/touch-spike-threejs && npm run dev -- --host`, open the printed local URL.
Verify: two boards render at the same positions/sizes/colors as before; clicking a board selects it (turns `#ffb347`); dragging a selected board moves it snapped to the grid; clicking empty space deselects. This must look and behave identically to before this task.

- [ ] **Step 6: Commit**

```bash
git add spikes/touch-spike-threejs/src/Scene.tsx spikes/touch-spike-threejs/src/Board.tsx spikes/touch-spike-threejs/src/App.tsx
git commit -m "refactor(threejs-spike): migrate boards onto ComponentDefinition/ComponentInstance model"
```

---

### Task 3: View presets (pure module)

**Files:**
- Create: `spikes/touch-spike-threejs/src/viewPresets.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: `ViewName` type, `ViewPreset` interface, `VIEW_NAMES: ViewName[]`, `getViewPreset(view: ViewName): ViewPreset` — consumed by Task 5.

- [ ] **Step 1: Write the module**

```typescript
// spikes/touch-spike-threejs/src/viewPresets.ts

export type ViewName = '3d' | 'front' | 'back' | 'left' | 'right' | 'top' | 'bottom'

export interface ViewPreset {
  position: [number, number, number]
  up: [number, number, number]
}

const DISTANCE = 32

const VIEW_PRESETS: Record<ViewName, ViewPreset> = {
  '3d': { position: [0, 20, 25], up: [0, 1, 0] },
  front: { position: [0, 0, DISTANCE], up: [0, 1, 0] },
  back: { position: [0, 0, -DISTANCE], up: [0, 1, 0] },
  left: { position: [-DISTANCE, 0, 0], up: [0, 1, 0] },
  right: { position: [DISTANCE, 0, 0], up: [0, 1, 0] },
  top: { position: [0, DISTANCE, 0], up: [0, 0, -1] },
  bottom: { position: [0, -DISTANCE, 0], up: [0, 0, 1] },
}

export const VIEW_NAMES: ViewName[] = ['3d', 'front', 'back', 'left', 'right', 'top', 'bottom']

export function getViewPreset(view: ViewName): ViewPreset {
  return VIEW_PRESETS[view]
}
```

- [ ] **Step 2: Typecheck**

Run: `cd spikes/touch-spike-threejs && npx tsc -b --noEmit`
Expected: no type errors.

- [ ] **Step 3: Commit**

```bash
git add spikes/touch-spike-threejs/src/viewPresets.ts
git commit -m "feat(threejs-spike): add pure view-preset camera positions"
```

---

### Task 4: Frame-bounds math (pure module)

**Files:**
- Create: `spikes/touch-spike-threejs/src/framing.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: `Bounds` interface, `computeBounds(positions: Array<[number, number, number]>): Bounds` — consumed by Task 5.

- [ ] **Step 1: Write the module**

```typescript
// spikes/touch-spike-threejs/src/framing.ts

export interface Bounds {
  center: [number, number, number]
  radius: number
}

export function computeBounds(positions: Array<[number, number, number]>): Bounds {
  if (positions.length === 0) {
    return { center: [0, 0, 0], radius: 10 }
  }
  const n = positions.length
  const cx = positions.reduce((sum, p) => sum + p[0], 0) / n
  const cy = positions.reduce((sum, p) => sum + p[1], 0) / n
  const cz = positions.reduce((sum, p) => sum + p[2], 0) / n
  const center: [number, number, number] = [cx, cy, cz]
  const radius = positions.reduce((max, p) => {
    const d = Math.hypot(p[0] - cx, p[1] - cy, p[2] - cz)
    return Math.max(max, d)
  }, 1)
  return { center, radius }
}
```

- [ ] **Step 2: Typecheck**

Run: `cd spikes/touch-spike-threejs && npx tsc -b --noEmit`
Expected: no type errors.

- [ ] **Step 3: Commit**

```bash
git add spikes/touch-spike-threejs/src/framing.ts
git commit -m "feat(threejs-spike): add pure frame-bounds math for Frame All/Selected"
```

---

### Task 5: Wire camera controls, drag-gating, and the view-control bar

**Files:**
- Create: `spikes/touch-spike-threejs/src/ViewControls.tsx`
- Modify: `spikes/touch-spike-threejs/src/App.tsx`
- Modify: `spikes/touch-spike-threejs/src/Scene.tsx`

**Interfaces:**
- Consumes: `getViewPreset`, `VIEW_NAMES`, `ViewName` from Task 3; `computeBounds` from Task 4; `OrbitControls` from `@react-three/drei`.
- Produces: nothing consumed by later tasks in this plan (this is the top-level wiring).

This task is UI/engine wiring that isn't meaningfully unit-testable (it's React + Three.js DOM/canvas interaction) and, per this session's constraint, has no automated tests anyway — verification is manual.

- [ ] **Step 1: Create the view-control bar component**

```typescript
// spikes/touch-spike-threejs/src/ViewControls.tsx
import { VIEW_NAMES } from './viewPresets'
import type { ViewName } from './viewPresets'

export function ViewControls({
  onSelectView,
  onFrameAll,
  onFrameSelected,
  hasSelection,
}: {
  onSelectView: (view: ViewName) => void
  onFrameAll: () => void
  onFrameSelected: () => void
  hasSelection: boolean
}) {
  return (
    <div
      style={{
        position: 'absolute',
        top: 8,
        left: 8,
        display: 'flex',
        gap: 4,
        flexWrap: 'wrap',
        zIndex: 1,
      }}
    >
      {VIEW_NAMES.map((view) => (
        <button
          key={view}
          onClick={() => onSelectView(view)}
          style={{ minWidth: 44, minHeight: 44 }}
        >
          {view.toUpperCase()}
        </button>
      ))}
      <button onClick={onFrameAll} style={{ minWidth: 44, minHeight: 44 }}>
        FRAME ALL
      </button>
      <button
        onClick={onFrameSelected}
        disabled={!hasSelection}
        style={{ minWidth: 44, minHeight: 44 }}
      >
        FRAME SEL
      </button>
    </div>
  )
}
```

- [ ] **Step 2: Wire OrbitControls, drag-gating, and the view bar into App.tsx**

```typescript
// spikes/touch-spike-threejs/src/App.tsx
import { useRef, useState } from 'react'
import type { ComponentRef } from 'react'
import { Canvas } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import * as THREE from 'three'
import { Scene } from './Scene'
import { ViewControls } from './ViewControls'
import { getViewPreset } from './viewPresets'
import type { ViewName } from './viewPresets'
import { computeBounds } from './framing'
import { INITIAL_BOARD_INSTANCES } from './component'

function App() {
  const [isDraggingPiece, setIsDraggingPiece] = useState(false)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const controlsRef = useRef<ComponentRef<typeof OrbitControls>>(null)

  const applyCameraState = (position: [number, number, number], up: [number, number, number]) => {
    const controls = controlsRef.current
    if (!controls) return
    const camera = controls.object as THREE.PerspectiveCamera
    camera.up.set(...up)
    camera.position.set(...position)
    camera.lookAt(controls.target)
    controls.update()
  }

  const handleSelectView = (view: ViewName) => {
    const preset = getViewPreset(view)
    applyCameraState(preset.position, preset.up)
  }

  const frame = (positions: Array<[number, number, number]>) => {
    const controls = controlsRef.current
    if (!controls) return
    const camera = controls.object as THREE.PerspectiveCamera
    const { center, radius } = computeBounds(positions)
    const distance = Math.max(radius * 2.5, 10)
    const direction = new THREE.Vector3()
      .subVectors(camera.position, controls.target)
      .normalize()
    controls.target.set(...center)
    camera.position.copy(controls.target).addScaledVector(direction, distance)
    camera.lookAt(controls.target)
    controls.update()
  }

  const handleFrameAll = () => frame(INITIAL_BOARD_INSTANCES.map((i) => i.position))
  const handleFrameSelected = () => {
    const selected = INITIAL_BOARD_INSTANCES.find((i) => i.id === selectedId)
    if (selected) frame([selected.position])
  }

  return (
    <div style={{ width: '100vw', height: '100vh', touchAction: 'none' }}>
      <Canvas camera={{ position: [0, 20, 25], fov: 50 }}>
        <Scene onDragStateChange={setIsDraggingPiece} onSelectionChange={setSelectedId} />
        <OrbitControls ref={controlsRef} makeDefault enabled={!isDraggingPiece} />
      </Canvas>
      <ViewControls
        onSelectView={handleSelectView}
        onFrameAll={handleFrameAll}
        onFrameSelected={handleFrameSelected}
        hasSelection={selectedId !== null}
      />
    </div>
  )
}

export default App
```

- [ ] **Step 3: Add the `onSelectionChange` prop to Scene.tsx used above**

```typescript
// spikes/touch-spike-threejs/src/Scene.tsx — full replacement
import { useState } from 'react'
import { Board } from './Board'
import { BOARD_DEFINITION, INITIAL_BOARD_INSTANCES } from './component'
import type { ComponentInstance } from './component'

export function Scene({
  onDragStateChange,
  onSelectionChange,
}: {
  onDragStateChange: (dragging: boolean) => void
  onSelectionChange: (id: string | null) => void
}) {
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [instances] = useState<ComponentInstance[]>(INITIAL_BOARD_INSTANCES)

  const select = (id: string | null) => {
    setSelectedId(id)
    onSelectionChange(id)
  }

  return (
    <>
      <ambientLight intensity={0.6} />
      <directionalLight position={[10, 20, 10]} intensity={0.8} />
      <gridHelper args={[120, 120, '#808080', '#808080']} />
      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        onPointerDown={() => select(null)}
      >
        <planeGeometry args={[120, 120]} />
        <meshStandardMaterial transparent opacity={0} />
      </mesh>
      {instances.map((instance) => (
        <Board
          key={instance.id}
          instance={instance}
          definition={BOARD_DEFINITION}
          selected={selectedId === instance.id}
          onSelect={select}
          onDragStateChange={onDragStateChange}
        />
      ))}
    </>
  )
}
```

- [ ] **Step 4: Typecheck**

Run: `cd spikes/touch-spike-threejs && npx tsc -b --noEmit`
Expected: no type errors.

- [ ] **Step 5: Manual verification (desktop, mouse)**

Run: `cd spikes/touch-spike-threejs && npm run dev -- --host`, open in a desktop browser.
Verify all of:
- Left-drag on empty space orbits the camera; the two boards do not move.
- Left-drag starting on a board moves that board (snapped to the grid) and the camera does not orbit.
- Scroll wheel zooms in/out.
- Each of the 7 view buttons (3D/FRONT/BACK/LEFT/RIGHT/TOP/BOTTOM) snaps the camera to a distinct, correctly-oriented view of the two boards (front/back and left/right should look like mirror-image profiles; top/bottom should look straight down/up without the view flipping upside down).
- Clicking a board then "FRAME SEL" frames just that board; "FRAME ALL" frames both boards; "FRAME SEL" is disabled when nothing is selected.
- Deselecting (click empty space) still works.

- [ ] **Step 6: Manual verification (touch — phone or browser device emulation)**

On a phone on the same network (or Chrome DevTools device emulation with touch simulation), open the dev server's printed `Network:` URL and verify:
- One-finger drag on empty space orbits.
- One-finger drag starting on a board moves it, without the camera also orbiting.
- Two-finger drag pans; pinch zooms.
- View buttons and Frame All/Selected work with taps.

- [ ] **Step 7: Commit**

```bash
git add spikes/touch-spike-threejs/src/ViewControls.tsx spikes/touch-spike-threejs/src/App.tsx spikes/touch-spike-threejs/src/Scene.tsx
git commit -m "feat(threejs-spike): wire OrbitControls, drag-gating, and view-control bar"
```

---

## Self-review notes

- **Spec coverage:** data model (Task 1), camera/view system incl. the hit-target gating risk (Task 5), view-control bar (Task 5), regression/migration (Task 2), manual verification (Task 5). Inventory/inspector/hardware/assembly/exploded-view/structural-check are explicitly out of scope per the spec and have no tasks here.
- **Deliberate scope change from the original plan (2026-08-22, user decision):** all automated-test steps (Vitest specs) were removed for this prototyping session. Every task's verification is now manual/visual or a compiler typecheck. This is a decision, not an oversight — the spec's own "Testing" subsection for Sub-project 1 listed automated unit tests, but the user overrode that in favor of manual testing for the duration of this session.
- **Known limitation (documented, not silently dropped):** orbit-dragging immediately after clicking TOP or BOTTOM may show a brief camera roll snap as `camera.up` resets to `[0,1,0]` on the next `OrbitControls` internal update — acceptable for this phase; revisit only if playtesting flags it as disorienting.
