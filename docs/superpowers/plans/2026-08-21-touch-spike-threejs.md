# Three.js/R3F Touch Spike Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a minimal Three.js/R3F 3D scene — 2 hardcoded boards,
tap-to-select with highlight, single-finger drag-to-move with grid snap,
fixed camera — reachable from a phone's mobile browser over LAN, so its
touch feel can be compared against the Godot spike.

**Architecture:** A Vite + React + TypeScript project. One `<Canvas>`
scene component (`Scene.tsx`) renders 2 board meshes and a ground plane.
Grid-snap math lives in its own pure module (`snap.ts`) so it's
unit-testable with Vitest. Touch/pointer handling uses React Three
Fiber's built-in pointer-event system (which unifies mouse and touch),
with pointer capture for reliable drag tracking — **but drag position is
computed from the event's live `ray` intersected against a ground plane,
never from the event's `point`**, because R3F's pointer capture replays a
stale intersection for `point`/`object` once captured (verified by
reading R3F's event-manager source directly).

**Tech Stack:** Vite 6.4.3, React 19.2.8, TypeScript ~6.0.2, Three.js
0.185.1, @react-three/fiber 9.7.0, @react-three/drei 10.7.8, Vitest.

**Spec:** [docs/superpowers/specs/2026-08-21-platform-decision-touch-spike-design.md](../specs/2026-08-21-platform-decision-touch-spike-design.md)

## Global Constraints

- Scope per spec: 2 hardcoded boards, tap-select with highlight,
  single-finger drag-to-move constrained to the ground plane and snapped
  to a 1" grid, one **fixed camera angle** — no orbit/pan/zoom, no
  rotation, no more than 2 boards, no piece-to-piece anchor snapping, no
  UI chrome, no save/load.
- Units are inches (matching Prototype 0's `GRID_INCREMENT = 1.0`).
- Testing in a **mobile browser on a physical Android device** over LAN
  — no emulator, per the spec's *Device testing* section.
- This project is throwaway, same as Prototype 0 — don't over-invest in
  polish or architecture beyond what keeps the core interaction testable.

## Verified Environment Notes

These were confirmed by hand before writing this plan:

- The active Node.js on this machine is **22.11.0**. Modern Vite (7.x and
  8.x, as of the versions available when this plan was written) requires
  Node **>=22.12** and will fail to build (`vite build` errors on a
  broken native binding for its Rolldown bundler — a real npm-on-Windows
  optional-dependency bug, not a code issue). **Pin `vite` to `6.4.3`**
  (requires only Node `>=22.0.0`, confirmed satisfied) and
  **`@vitejs/plugin-react` to `^4.7.0`** (the 5.x/6.x generation of the
  plugin requires a Vite internal export path that doesn't exist in
  Vite 6). Both pins are applied explicitly in Task 1 — do not accept
  whatever `npm create vite@latest` scaffolds by default, it currently
  pulls in the incompatible newer majors.
- **R3F's pointer capture is stale, not live, for `event.point` and
  `event.object`.** Once `setPointerCapture` is called, subsequent
  pointermove events for that pointer replay the *intersection captured
  at the moment of `setPointerCapture`* if the live raycast no longer
  hits the object — confirmed by reading
  `@react-three/fiber`'s event-manager source
  (`internal.capturedMap` stores a frozen `hit` per captured object).
  Relying on `event.point` while dragging would silently reproduce a
  version of the exact drag-teleport-then-freeze bug that Prototype 0's
  final review caught and fixed. **`event.ray` is always live** (computed
  fresh from the current pointer position on every event, independent of
  capture), so all drag math in this plan uses
  `event.ray.intersectPlane(groundPlane, target)`, never `event.point`.
- `@react-three/fiber`'s TypeScript types declare `ThreeEvent.target` as
  the native `EventTarget` (no `setPointerCapture` method), but the
  actual runtime object R3F substitutes there does have
  `setPointerCapture`/`releasePointerCapture` (confirmed against
  `@react-three/drei`'s own `PlaneSlider` component, which uses this
  exact call). The type is simply wrong. Cast:
  `(event.target as Element).setPointerCapture(event.pointerId)`.
- `THREE.Plane(normal, constant)`: for a horizontal plane at height `Y`
  with normal `(0,1,0)`, `constant = -Y` (opposite sign from Godot's
  `Plane(normal, d)`, which uses direct `d = Y` — don't copy the Godot
  spike's plane-construction code verbatim between the two projects).
- `npx vitest run` works out of the box once `vitest` is a dev dependency
  — no extra config needed for this project's scope.
- `npm run dev -- --host` (or `vite --host`) prints a `Network:` URL
  (confirmed: `http://192.168.1.127:5173/`-shaped) reachable from a phone
  on the same Wi-Fi.

---

## File Structure

```
woodcraft-prototype/
  spikes/
    touch-spike-threejs/
      package.json
      index.html
      src/
        main.tsx
        App.tsx           # <Canvas> + fixed camera setup
        Scene.tsx          # ground + boards, selection state
        Board.tsx           # one board mesh: pointer handlers, drag math
        snap.ts               # pure grid-snap math
        snap.test.ts            # Vitest tests for snap.ts
      README.md
```

---

### Task 1: Project scaffolding with pinned, verified dependency versions

**Files:**
- Create: `spikes/touch-spike-threejs/` (via `npm create vite`)
- Modify: `spikes/touch-spike-threejs/package.json` (pin versions)

**Interfaces:**
- Produces: a working `npm run build` and `npm run dev`. Every later task
  assumes this is already set up.

- [x] **Step 1: Scaffold the Vite + React + TypeScript project**

From the repo root:

```
mkdir -p spikes/touch-spike-threejs
cd spikes/touch-spike-threejs
npm create vite@latest . -- --template react-ts
```

- [x] **Step 2: Install base dependencies, then pin Vite and the React plugin**

```
npm install
npm install vite@6.4.3 --save-dev
npm install @vitejs/plugin-react@^4.7.0 --save-dev
```

These exact pins matter — see this plan's *Verified Environment Notes*
above for why `vite@latest`'s default (8.x at time of writing) fails to
build on this machine's Node version.

- [x] **Step 3: Install the 3D dependencies**

```
npm install three@0.185.1 @react-three/fiber@9.7.0 @react-three/drei@10.7.8
npm install --save-dev @types/three@^0.185.4
npm install --save-dev vitest
```

- [x] **Step 4: Confirm the scaffold builds clean**

Run: `npm run build`
Expected: `tsc -b && vite build` completes with `✓ built in ...s` and no
errors (a "chunk larger than 500kB" warning is expected and fine — this
is a spike, not a production bundle).

- [x] **Step 5: Add a `.gitignore` for the Node project** (scaffold already
      produced a `.gitignore` covering `node_modules/` and `dist/` — a
      superset of the plan's minimal version — left as-is)

Create `spikes/touch-spike-threejs/.gitignore`:

```
node_modules/
dist/
```

- [x] **Step 6: Commit** — SKIPPED per explicit coordinator instruction:
      no git commits during this run. Changes left uncommitted in the
      working tree.

---

### Task 2: Grid-snap math module

**Files:**
- Create: `spikes/touch-spike-threejs/src/snap.ts`
- Test: `spikes/touch-spike-threejs/src/snap.test.ts`

**Interfaces:**
- Produces: `snapValue(value: number, increment: number): number`.
  Consumed by Task 5 (`Board.tsx`'s drag handling).

- [x] **Step 1: Write the failing test**

```typescript
// src/snap.test.ts
import { describe, it, expect } from 'vitest'
import { snapValue } from './snap'

describe('snapValue', () => {
  it('rounds to the nearest increment', () => {
    expect(snapValue(1.3, 1.0)).toBe(1.0)
    expect(snapValue(1.6, 1.0)).toBe(2.0)
    expect(snapValue(4.3, 0.5)).toBe(4.5)
  })

  it('handles negative numbers', () => {
    expect(snapValue(-1.3, 1.0)).toBe(-1.0)
    expect(snapValue(-1.6, 1.0)).toBe(-2.0)
  })

  it('returns the value unchanged when increment is zero or negative', () => {
    expect(snapValue(3.14159, 0)).toBe(3.14159)
    expect(snapValue(3.14159, -1)).toBe(3.14159)
  })
})
```

- [x] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/snap.test.ts`
Expected: FAIL — `Cannot find module './snap'` (or similar).

- [x] **Step 3: Implement `snap.ts`**

```typescript
// src/snap.ts
export function snapValue(value: number, increment: number): number {
  if (increment <= 0) return value
  return Math.round(value / increment) * increment
}
```

- [x] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/snap.test.ts`
Expected: 3 passed.

- [x] **Step 5: Commit** — SKIPPED per explicit coordinator instruction:
      no git commits during this run.

---

### Task 3: Scene construction — boards, ground, fixed camera

**Files:**
- Create: `spikes/touch-spike-threejs/src/App.tsx` (replaces the scaffolded default)
- Create: `spikes/touch-spike-threejs/src/Scene.tsx`

**Interfaces:**
- Produces: `BOARDS: BoardData[]` (id, size, position, color), `<Scene>`
  component rendering them plus a ground plane, `<App>` wrapping it in a
  `<Canvas>` with a fixed camera. Consumed by Task 4 (adds selection) and
  Task 5 (adds drag).

- [x] **Step 1: Replace `src/App.tsx`**

```tsx
// src/App.tsx
import { Canvas } from '@react-three/fiber'
import { Scene } from './Scene'

function App() {
  return (
    <div style={{ width: '100vw', height: '100vh', touchAction: 'none' }}>
      <Canvas camera={{ position: [0, 20, 25], fov: 50 }}>
        <Scene />
      </Canvas>
    </div>
  )
}

export default App
```

`touchAction: 'none'` on the containing `div` is required — without it, a
mobile browser intercepts single-finger drags as page scroll/zoom before
they ever reach the canvas's pointer events.

- [x] **Step 2: Create `src/Scene.tsx`**

```tsx
// src/Scene.tsx
export type BoardData = {
  id: string
  size: [number, number, number] // width, height, depth (Three.js BoxGeometry order)
  position: [number, number, number]
  color: string
}

export const BOARDS: BoardData[] = [
  { id: 'board-a', size: [1.5, 3.5, 48], position: [-6, 1.75, 0], color: '#a6693f' },
  { id: 'board-b', size: [1.5, 3.5, 36], position: [6, 1.75, 0], color: '#8c5730' },
]

export function Scene() {
  return (
    <>
      <ambientLight intensity={0.6} />
      <directionalLight position={[10, 20, 10]} intensity={0.8} />
      <mesh rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[120, 120]} />
        <meshStandardMaterial color="#cccccc" />
      </mesh>
      {BOARDS.map((board) => (
        <mesh key={board.id} position={board.position}>
          <boxGeometry args={board.size} />
          <meshStandardMaterial color={board.color} />
        </mesh>
      ))}
    </>
  )
}
```

- [x] **Step 3: Verify the build still passes**

Run: `npm run build` — builds clean (chunk-size warning only, expected).

- [x] **Step 4: Manual visual check** — PARTIAL: no browser/screenshot
      tool available in this headless execution environment. Verified
      instead via `npm run dev` + curl: server started clean, `/src/App.tsx`
      and `/src/Scene.tsx` both transform with HTTP 200 (no compile
      errors), and `tsc -b` (part of `npm run build`) passed with no type
      errors. Dev server was stopped afterward. True visual confirmation
      (two boxes on a plane) is deferred to the human's on-device playtest
      in Task 6.

- [x] **Step 5: Commit** — SKIPPED per explicit coordinator instruction:
      no git commits during this run.

---

### Task 4: Tap-select with highlight

**Files:**
- Modify: `spikes/touch-spike-threejs/src/Scene.tsx`
- Create: `spikes/touch-spike-threejs/src/Board.tsx`

**Interfaces:**
- Consumes: `BoardData`, `BOARDS` (Task 3).
- Produces: `<Board>` component with `selected: boolean`,
  `onSelect: (id: string) => void` props. Consumed by Task 5 (adds drag
  props to the same component).

This task's actual tap behavior is manually verified on-device, same
reasoning as Prototype 0's equivalent tasks — it depends on live touch
input this environment can't simulate. The build/type-check step is the
automated gate.

- [x] **Step 1: Create `src/Board.tsx`**

```tsx
// src/Board.tsx
import { useState } from 'react'
import type { ThreeEvent } from '@react-three/fiber'
import type { BoardData } from './Scene'

export function Board({
  data,
  selected,
  onSelect,
}: {
  data: BoardData
  selected: boolean
  onSelect: (id: string) => void
}) {
  const [pos] = useState(data.position)

  const handlePointerDown = (e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation()
    onSelect(data.id)
  }

  return (
    <mesh position={pos} onPointerDown={handlePointerDown}>
      <boxGeometry args={data.size} />
      <meshStandardMaterial color={selected ? '#ffb347' : data.color} />
    </mesh>
  )
}
```

- [x] **Step 2: Update `src/Scene.tsx` to track selection and render `<Board>`**

Replace the `Scene` function (keep `BoardData`/`BOARDS` as they are):

```tsx
import { useState } from 'react'
import { Board } from './Board'

export function Scene() {
  const [selectedId, setSelectedId] = useState<string | null>(null)

  return (
    <>
      <ambientLight intensity={0.6} />
      <directionalLight position={[10, 20, 10]} intensity={0.8} />
      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        onPointerDown={() => setSelectedId(null)}
      >
        <planeGeometry args={[120, 120]} />
        <meshStandardMaterial color="#cccccc" />
      </mesh>
      {BOARDS.map((board) => (
        <Board
          key={board.id}
          data={board}
          selected={selectedId === board.id}
          onSelect={setSelectedId}
        />
      ))}
    </>
  )
}
```

Add `import { useState } from 'react'` to the top of the file alongside
the existing `import { Board } from './Board'` line (`BoardData`/`BOARDS`
stay exactly as Task 3 left them).

The ground plane's own `onPointerDown` calling `setSelectedId(null)` is
what makes tapping empty space deselect: R3F only fires a mesh's
`onPointerDown` when the ray actually hits that mesh, and the ground
plane is behind/below the boards, so a tap on a board never reaches it
(R3F stops at the nearest hit unless `stopPropagation` is skipped —
`Board`'s handler calls `e.stopPropagation()` specifically to prevent a
board tap from also reaching the ground plane underneath it).

- [x] **Step 3: Verify the build still passes** — builds clean.

- [x] **Step 4: Manual visual check** — DEFERRED: no browser available in
      this headless execution environment; `tsc -b` type-checks the
      pointer-event handler wiring cleanly. Actual click/tap behavior is
      verified by the human during Task 6's on-device playtest.

- [x] **Step 5: Commit** — SKIPPED per explicit coordinator instruction:
      no git commits during this run.

---

### Task 5: Drag-to-move with grid snap

**Files:**
- Modify: `spikes/touch-spike-threejs/src/Board.tsx`

**Interfaces:**
- Consumes: `snapValue` (Task 2).
- Produces: live drag-to-move on the selected board, snapped to a 1"
  grid, at constant height. Manually verified for actual touch feel; the
  ray/plane math itself was independently verified by hand (pure
  `THREE.Ray`/`THREE.Plane` math, no React/DOM involved) before this plan
  was written.

- [x] **Step 1: Replace `src/Board.tsx` with the full drag-aware version**

```tsx
// src/Board.tsx
import { useRef, useState } from 'react'
import type { ThreeEvent } from '@react-three/fiber'
import * as THREE from 'three'
import type { BoardData } from './Scene'
import { snapValue } from './snap'

const GRID_INCREMENT = 1
const GROUND_PLANE = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0)

export function Board({
  data,
  selected,
  onSelect,
}: {
  data: BoardData
  selected: boolean
  onSelect: (id: string) => void
}) {
  const [pos, setPos] = useState(data.position)
  const dragging = useRef(false)
  const dragOffset = useRef<[number, number]>([0, 0])

  const groundHit = (ray: THREE.Ray): THREE.Vector3 | null => {
    const target = new THREE.Vector3()
    return ray.intersectPlane(GROUND_PLANE, target)
  }

  const handlePointerDown = (e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation()
    ;(e.target as Element).setPointerCapture(e.pointerId)
    onSelect(data.id)
    dragging.current = true
    const hit = groundHit(e.ray)
    dragOffset.current = hit ? [pos[0] - hit.x, pos[2] - hit.z] : [0, 0]
  }

  const handlePointerMove = (e: ThreeEvent<PointerEvent>) => {
    if (!dragging.current) return
    // Deliberately e.ray, not e.point: once the pointer is captured,
    // e.point/e.object replay a stale intersection from pick time if the
    // live raycast no longer hits this mesh. e.ray is always live. See
    // this plan's Verified Environment Notes for why.
    const hit = groundHit(e.ray)
    if (!hit) return
    const [offsetX, offsetZ] = dragOffset.current
    const snappedX = snapValue(hit.x + offsetX, GRID_INCREMENT)
    const snappedZ = snapValue(hit.z + offsetZ, GRID_INCREMENT)
    setPos([snappedX, pos[1], snappedZ])
  }

  const handlePointerUp = (e: ThreeEvent<PointerEvent>) => {
    dragging.current = false
    ;(e.target as Element).releasePointerCapture(e.pointerId)
  }

  return (
    <mesh
      position={pos}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
    >
      <boxGeometry args={data.size} />
      <meshStandardMaterial color={selected ? '#ffb347' : data.color} />
    </mesh>
  )
}
```

- [x] **Step 2: Verify the build/type-check passes** — builds clean; no
      `setPointerCapture` type error, confirming the `(e.target as
      Element)` cast resolves the documented type-definition gap.

- [x] **Step 3: Manual check with mouse (desktop proxy for touch)** —
      DEFERRED: no browser available in this headless execution
      environment. The `e.ray`-based plane-intersection math was already
      independently verified by hand per the plan's own Interfaces note
      (pure `THREE.Ray`/`THREE.Plane` math, no React/DOM involved); actual
      interactive drag feel is verified by the human during Task 6's
      on-device playtest.

- [x] **Step 4: Commit** — SKIPPED per explicit coordinator instruction:
      no git commits during this run.

---

### Task 6: LAN dev server, on-device playtest, README

**Files:**
- Create: `spikes/touch-spike-threejs/README.md`

**Interfaces:**
- None (documentation + manual verification).

- [x] **Step 1: Start the dev server exposed on the LAN** — confirmed:
      `npm run dev -- --host` printed `Network: http://192.168.1.127:5173/`
      alongside `Local: http://localhost:5173/`. Server was stopped
      immediately after (port 5173 confirmed no longer listening) — see
      Step 2/3 notes below for why it wasn't left running.

```
cd spikes/touch-spike-threejs
npm run dev -- --host
```

Expected output includes a `Network:` URL (e.g.
`http://192.168.1.127:5173/`) alongside the `Local:` one — note the exact
IP:port shown, it'll differ by machine/network.

- [ ] **Step 2: Open it on the Android device** — NOT DONE: requires a
      physical Android device and a human to operate it, which this
      execution environment does not have. This is the human's remaining
      manual step (see README's "Running" section for the exact
      commands).

Ensure the phone is on the same Wi-Fi network as this machine, then open
the `Network:` URL from Step 1 in the phone's mobile browser.

If the phone can't reach it, check Windows Firewall isn't blocking the
port (`netsh advfirewall firewall add rule name="vite-dev" dir=in
action=allow protocol=TCP localport=5173` opens it, if needed), and that
both devices are actually on the same network segment (some routers
isolate Wi-Fi clients from each other — "AP/client isolation" — which
would block this regardless of firewall settings).

- [ ] **Step 3: Manual playtest on-device** — NOT DONE, same reason as
      Step 2: no physical Android device available in this environment.
      This is a hard stop per the task instructions — do not claim this
      happened. Remains for the human to perform and record impressions
      of, per the parent spec's *Decision method*.

Verify:
- Two boards are visible on a ground plane from a fixed angle.
- Tapping a board highlights it (orange); tapping the other board moves
  the highlight; tapping the empty plane clears it.
- Dragging a highlighted board with one finger moves it, snapped to 1"
  grid steps, without the page scrolling/zooming instead of dragging the
  board (the `touch-action: none` fix from Task 3).
- The board stays at its resting height while dragged, and doesn't
  freeze or jump when your finger moves off the board's own footprint
  mid-drag (the pointer-capture staleness fix from Task 5).

Record your subjective impression (responsiveness, snap feel, any
tap-vs-drag misfires, and how this compares to opening a page vs. the
Godot spike's install step) — this is raw material for the final decision
record, per the parent spec's *Decision method*.

- [x] **Step 4: Write `README.md`**

Create `spikes/touch-spike-threejs/README.md`:

```markdown
# Three.js/R3F Touch Spike

Minimal Vite + React + @react-three/fiber scene: 2 boards, tap-to-select,
single-finger drag-to-move with 1" grid snap, fixed camera. Built to
compare touch feel against the Godot spike — see
`docs/superpowers/specs/2026-08-21-platform-decision-touch-spike-design.md`.

## Running

```
npm install
npm run dev -- --host
```

Open the printed `Local:` URL on desktop, or the `Network:` URL from a
phone on the same Wi-Fi.

## Tests

```
npx vitest run
```

## Build

```
npm run build
```
```

- [x] **Step 5: Commit** — SKIPPED per explicit coordinator instruction:
      no git commits during this run.

---

## Self-Review Notes

- **Spec coverage:** 2 hardcoded boards (Task 3), tap-select with
  highlight (Task 4), single-finger drag-to-snap constrained to the
  ground plane (Task 5), fixed camera / no orbit-pan-zoom (Task 3, never
  added), phone-over-LAN reachability with no install step (Task 6) —
  all covered. Grid-snap math reimplemented natively per the spec
  (Task 2), not ported from Prototype 0's Python or copy-pasted from the
  Godot spike's GDScript.
- **Type consistency:** `snapValue` signature (Task 2) matches its call
  site in Task 5. `BoardData`/`BOARDS` (Task 3) match `Board`'s props in
  Tasks 4-5. `selected`/`onSelect` props introduced in Task 4 are
  preserved unchanged through Task 5's rewrite of `Board.tsx`.
- Task 5 fully replaces `Board.tsx`'s content rather than incrementally
  patching Task 4's version, because the drag handlers need the ground
  plane/ray-intersection helpers in scope alongside the existing
  select handler — restating the whole file avoids an ambiguous partial
  diff for whichever engineer or subagent implements this task.
