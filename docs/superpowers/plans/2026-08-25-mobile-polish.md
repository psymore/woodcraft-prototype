# Mobile Interaction Polish (Sub-project 7) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give `wood-cad-workshop/`'s Inventory panel real bottom-sheet ergonomics (backdrop, drag-to-dismiss, safe-area padding), fix the Inspector/ViewControls overlap risk with a real layout instead of a magic-number offset, and bring Inspector's number inputs up to the app's 44px touch-target minimum.

**Architecture:** A new reusable `BottomSheet` component (`src/ui/BottomSheet.tsx`) wraps a hand-rolled pointer-drag-to-dismiss gesture, delegating the dismiss/snap-back decision to a pure, unit-tested helper (`src/ui/bottomSheetGesture.ts`) — the same "pure logic separated from event plumbing" pattern `Piece.tsx` and `engine/core/*` already use. `Inventory.tsx` is rebuilt on top of it. `PieceControls` and `Inspector` move into one flex-column wrapper in `App.tsx` so Inspector's position no longer depends on `ViewControls`'s variable wrapped height.

**Tech Stack:** TypeScript, React, Vitest (existing project setup — no new dependencies).

**Spec:** [docs/superpowers/specs/2026-08-25-wood-cad-workshop-mobile-polish-design.md](../specs/2026-08-25-wood-cad-workshop-mobile-polish-design.md)

## Global Constraints

- No third-party dependency, no new test infrastructure (no React Testing Library) — components are verified manually via `npm run dev`, matching every other file in `src/ui/`/`src/scene/`.
- `BottomSheet` renders `null` when `open` is `false` — no mount/unmount transition, no open/close animation.
- Dismiss decision is drag-distance-only: `shouldDismiss(dragDeltaY, sheetHeightPx)` returns true when `dragDeltaY / sheetHeightPx > 0.3` (strictly greater than — exactly 0.3 does NOT dismiss). No velocity/fling tracking.
- `sheetHeightPx <= 0` must never dismiss (guard against a bad measurement).
- Drag handle is a `36px × 4px` rounded bar, centered, using the same three-handler pointer-capture pattern (`onPointerDown`/`onPointerMove`/`onPointerUp`) `Piece.tsx` already uses for piece-dragging.
- Sheet content bottom padding must include `env(safe-area-inset-bottom)`: `paddingBottom: 'max(10px, env(safe-area-inset-bottom))'`.
- `Inspector` stays a corner panel, not a bottom sheet. `PieceControls` and `Inspector` share one top-right flex-column wrapper in `App.tsx`; neither component positions itself anymore.
- Inspector's two number inputs (`dimensions` loop and the structural-check weight field) change from `minHeight: 32` to `minHeight: 44`.
- No change to `sceneSessionStore.ts` — `inventoryOpen`/`toggleInventory` are reused as-is.
- No code change for orbit/drag disambiguation — verification only.

---

### Task 1: `BottomSheet` component and its gesture helper

**Files:**
- Create: `wood-cad-workshop/src/ui/bottomSheetGesture.ts`
- Create: `wood-cad-workshop/src/ui/bottomSheetGesture.test.ts`
- Create: `wood-cad-workshop/src/ui/BottomSheet.tsx`

**Interfaces:**
- Consumes: nothing (pure helper takes primitives; the component takes only React/DOM APIs).
- Produces:
  ```ts
  export function shouldDismiss(dragDeltaY: number, sheetHeightPx: number): boolean
  ```
  ```tsx
  export function BottomSheet(props: {
    open: boolean
    onClose: () => void
    children: React.ReactNode
  }): React.ReactElement | null
  ```
  Task 2's `Inventory.tsx` imports `{ BottomSheet } from './BottomSheet'`.

- [ ] **Step 1: Write the failing tests for `shouldDismiss`**

Create `wood-cad-workshop/src/ui/bottomSheetGesture.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { shouldDismiss } from './bottomSheetGesture'

describe('shouldDismiss', () => {
  it('does not dismiss with zero drag', () => {
    expect(shouldDismiss(0, 100)).toBe(false)
  })

  it('does not dismiss below the threshold', () => {
    expect(shouldDismiss(29, 100)).toBe(false)
  })

  it('does not dismiss exactly at the threshold', () => {
    expect(shouldDismiss(30, 100)).toBe(false)
  })

  it('dismisses just above the threshold', () => {
    expect(shouldDismiss(31, 100)).toBe(true)
  })

  it('dismisses well above the threshold', () => {
    expect(shouldDismiss(80, 100)).toBe(true)
  })

  it('never dismisses with a non-positive sheet height', () => {
    expect(shouldDismiss(50, 0)).toBe(false)
    expect(shouldDismiss(50, -10)).toBe(false)
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd wood-cad-workshop && npx vitest run src/ui/bottomSheetGesture.test.ts`
Expected: FAIL — `bottomSheetGesture.ts` doesn't exist yet.

- [ ] **Step 3: Implement `shouldDismiss`**

Create `wood-cad-workshop/src/ui/bottomSheetGesture.ts`:

```ts
const DISMISS_THRESHOLD_RATIO = 0.3

// Drag-distance-only dismiss decision for BottomSheet — no velocity/fling
// tracking. Pulled out as a pure function so the threshold math is
// unit-testable without mounting a component or simulating pointer events,
// the same isolation principle engine/core/* uses for domain logic.
export function shouldDismiss(dragDeltaY: number, sheetHeightPx: number): boolean {
  if (sheetHeightPx <= 0) return false
  return dragDeltaY / sheetHeightPx > DISMISS_THRESHOLD_RATIO
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd wood-cad-workshop && npx vitest run src/ui/bottomSheetGesture.test.ts`
Expected: PASS, all 6 tests green.

- [ ] **Step 5: Implement the `BottomSheet` component**

Create `wood-cad-workshop/src/ui/BottomSheet.tsx`:

```tsx
import { useRef, useState } from 'react'
import type { PointerEvent as ReactPointerEvent, ReactNode } from 'react'
import { shouldDismiss } from './bottomSheetGesture'

export function BottomSheet({
  open,
  onClose,
  children,
}: {
  open: boolean
  onClose: () => void
  children: ReactNode
}) {
  const sheetRef = useRef<HTMLDivElement>(null)
  const dragStartY = useRef(0)
  const sheetHeight = useRef(0)
  const dragging = useRef(false)
  const [dragDeltaY, setDragDeltaY] = useState(0)

  if (!open) return null

  const handlePointerDown = (e: ReactPointerEvent) => {
    ;(e.target as Element).setPointerCapture(e.pointerId)
    dragging.current = true
    dragStartY.current = e.clientY
    sheetHeight.current = sheetRef.current?.getBoundingClientRect().height ?? 0
  }

  const handlePointerMove = (e: ReactPointerEvent) => {
    if (!dragging.current) return
    setDragDeltaY(Math.max(0, e.clientY - dragStartY.current))
  }

  const handlePointerUp = (e: ReactPointerEvent) => {
    if (!dragging.current) return
    dragging.current = false
    ;(e.target as Element).releasePointerCapture(e.pointerId)
    if (shouldDismiss(dragDeltaY, sheetHeight.current)) {
      onClose()
    }
    setDragDeltaY(0)
  }

  return (
    <>
      <div
        onClick={onClose}
        style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0,0,0,0.3)',
          zIndex: 1,
        }}
      />
      <div
        ref={sheetRef}
        style={{
          position: 'fixed',
          bottom: 0,
          left: 0,
          right: 0,
          background: 'rgba(255,255,255,0.96)',
          border: '1px solid #ccc',
          borderTopLeftRadius: 12,
          borderTopRightRadius: 12,
          zIndex: 1,
          transform: `translateY(${dragDeltaY}px)`,
          maxHeight: '55vh',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        <div
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
          style={{ display: 'flex', justifyContent: 'center', padding: 8, touchAction: 'none' }}
        >
          <div style={{ width: 36, height: 4, borderRadius: 2, background: '#ccc' }} />
        </div>
        <div
          style={{
            overflowY: 'auto',
            padding: '0 10px 10px',
            paddingBottom: 'max(10px, env(safe-area-inset-bottom))',
          }}
        >
          {children}
        </div>
      </div>
    </>
  )
}
```

- [ ] **Step 6: Type-check and run the full suite**

Run: `cd wood-cad-workshop && npx tsc -b && npx vitest run`
Expected: both exit 0; vitest shows 6 new tests passing plus all prior tests still green.

- [ ] **Step 7: Commit**

```bash
cd wood-cad-workshop
git add src/ui/bottomSheetGesture.ts src/ui/bottomSheetGesture.test.ts src/ui/BottomSheet.tsx
git commit -m "feat(wood-cad-workshop): add reusable BottomSheet component

Backdrop + drag-to-dismiss (pointer-capture pattern matching
Piece.tsx) + safe-area-inset padding. Dismiss/snap-back decision is
a pure, unit-tested helper (bottomSheetGesture.ts), not implemented
yet by any consumer.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 2: Rebuild `Inventory.tsx` on `BottomSheet`

**Files:**
- Modify: `wood-cad-workshop/src/ui/Inventory.tsx`

**Interfaces:**
- Consumes: `BottomSheet` from `./BottomSheet` (Task 1).
- Produces: nothing new consumed by later tasks.

- [ ] **Step 1: Replace the inline panel with `BottomSheet`**

Replace the full contents of `wood-cad-workshop/src/ui/Inventory.tsx` with:

```tsx
import { getComponents } from '../engine'
import type { ComponentCategory } from '../engine'
import { useSceneSession } from '../store/sceneSessionStore'
import { BottomSheet } from './BottomSheet'

const CATEGORY_ORDER: ComponentCategory[] = ['WOOD', 'HARDWARE', 'FASTENER']
const CATEGORY_LABELS: Record<ComponentCategory, string> = {
  WOOD: 'Wood',
  HARDWARE: 'Hardware',
  FASTENER: 'Fasteners',
}

export function Inventory() {
  const open = useSceneSession((s) => s.inventoryOpen)
  const toggleInventory = useSceneSession((s) => s.toggleInventory)
  const addComponent = useSceneSession((s) => s.addComponent)
  const library = getComponents()

  return (
    <>
      <button
        onClick={toggleInventory}
        style={{ position: 'absolute', bottom: 8, right: 8, minWidth: 44, minHeight: 44, zIndex: 1 }}
      >
        {open ? 'CLOSE' : 'INVENTORY'}
      </button>
      <BottomSheet open={open} onClose={toggleInventory}>
        {CATEGORY_ORDER.map((category) => (
          <div key={category} style={{ marginBottom: 10 }}>
            <div style={{ fontWeight: 'bold', marginBottom: 4 }}>{CATEGORY_LABELS[category]}</div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {library
                .filter((def) => def.category === category)
                .map((def) => (
                  <button
                    key={def.id}
                    onClick={() => addComponent(def)}
                    style={{ minWidth: 44, minHeight: 44 }}
                  >
                    {def.name}
                  </button>
                ))}
            </div>
          </div>
        ))}
      </BottomSheet>
    </>
  )
}
```

The toggle button is unchanged — same position, same 44×44px sizing. Only the panel markup moves inside `BottomSheet`'s children; the category loop and `addComponent` wiring are unchanged. `onClose={toggleInventory}` is correct without a dedicated "close" action: the sheet is only mounted/interactive while `open` is `true`, so a dismiss always means "close," which is exactly what `toggleInventory` does when called while open.

- [ ] **Step 2: Type-check and run the full suite**

Run: `cd wood-cad-workshop && npx tsc -b && npx vitest run`
Expected: both exit 0, no test count change (this task adds no new automated tests — UI is verified manually here).

- [ ] **Step 3: Manual verification**

Run: `cd wood-cad-workshop && npm run dev`, open the printed local URL.

1. Click INVENTORY — confirm a backdrop dims the scene and a sheet slides up from the bottom with a drag handle.
2. Click the backdrop (outside the sheet) — confirm it closes and the button label flips back to `INVENTORY`.
3. Reopen it. Press and drag the handle down a small amount, release — confirm the sheet snaps back open (small drags don't dismiss).
4. Reopen if needed. Press and drag the handle down more than about a third of the sheet's height, release — confirm the sheet dismisses.
5. Add a component from the sheet (e.g. click "Board") — confirm it still appears in the 3D scene, same as before this change.

- [ ] **Step 4: Commit**

```bash
cd wood-cad-workshop
git add src/ui/Inventory.tsx
git commit -m "feat(wood-cad-workshop): rebuild Inventory panel on BottomSheet

Gets backdrop, drag-to-dismiss, and safe-area padding for free.
Toggle button and category/button-grid content are unchanged.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 3: Fix the Inspector/ViewControls overlap risk and bump touch targets

**Files:**
- Modify: `wood-cad-workshop/src/App.tsx`
- Modify: `wood-cad-workshop/src/ui/PieceControls.tsx`
- Modify: `wood-cad-workshop/src/ui/Inspector.tsx`

**Interfaces:**
- Consumes: `PieceControls`, `Inspector` (both already exist, imported by `App.tsx` today).
- Produces: nothing consumed by later tasks — this is the last task in the plan.

- [ ] **Step 1: Group `PieceControls` and `Inspector` in `App.tsx`**

In `wood-cad-workshop/src/App.tsx`, find this block near the end of the JSX:

```tsx
      <Inventory />
      <PullupKitButton />
      <PieceControls />
      <Inspector />
      <ExplodedView />
```

Replace it with:

```tsx
      <Inventory />
      <PullupKitButton />
      <div
        style={{
          position: 'absolute',
          top: 8,
          right: 8,
          display: 'flex',
          flexDirection: 'column',
          gap: 8,
          zIndex: 1,
        }}
      >
        <PieceControls />
        <Inspector />
      </div>
      <ExplodedView />
```

- [ ] **Step 2: Drop `PieceControls`'s own positioning**

In `wood-cad-workshop/src/ui/PieceControls.tsx`, change the returned `<div>`'s style from:

```tsx
      style={{
        position: 'absolute',
        top: 8,
        right: 8,
        display: 'flex',
        gap: 4,
        zIndex: 1,
      }}
```

to:

```tsx
      style={{ display: 'flex', gap: 4 }}
```

`PieceControls` is now a normal flow element inside `App.tsx`'s new flex-column wrapper, not independently positioned.

- [ ] **Step 3: Drop `Inspector`'s own positioning and bump its touch targets**

In `wood-cad-workshop/src/ui/Inspector.tsx`, change the root `<div>`'s style from:

```tsx
      style={{
        position: 'absolute',
        top: 8,
        left: 8,
        marginTop: 140,
        width: 200,
        background: 'rgba(255,255,255,0.96)',
        border: '1px solid #ccc',
        borderRadius: 8,
        padding: 10,
        zIndex: 1,
        fontSize: 13,
      }}
```

to:

```tsx
      style={{
        width: 200,
        background: 'rgba(255,255,255,0.96)',
        border: '1px solid #ccc',
        borderRadius: 8,
        padding: 10,
        fontSize: 13,
      }}
```

Then, in the same file, change both number inputs' style from `{ width: 80, minHeight: 32 }` to `{ width: 80, minHeight: 44 }`. There are two occurrences — one in the `Object.entries(instance.dimensions).map(...)` loop, one on the structural-check weight input further down. Change both.

- [ ] **Step 4: Type-check**

Run: `cd wood-cad-workshop && npx tsc -b`
Expected: exits 0, no errors.

- [ ] **Step 5: Run the full test suite**

Run: `cd wood-cad-workshop && npx vitest run`
Expected: exits 0, all tests still passing (this task adds no new automated tests).

- [ ] **Step 6: Manual verification**

Run: `cd wood-cad-workshop && npm run dev`, open the printed local URL. Use the browser's device toolbar (or resize the window) to test at both a wide desktop width and a narrow phone width (e.g. ~375px).

1. At the narrow width, confirm `ViewControls` (top-left) wraps onto 2-3 rows of buttons.
2. Select any piece — confirm `PieceControls` (ROTATE/DUPLICATE/DELETE) and the Inspector panel stack vertically in the top-right corner, with no overlap with each other or with `ViewControls`, regardless of how many rows `ViewControls` wraps to.
3. Confirm the Inspector's dimension number inputs and (for the pull-up bar) the weight input are visibly larger / easier to tap than before this change.
4. Orbit/drag disambiguation (verification only, no code changed here): single-finger drag on empty space orbits the camera; single-finger drag starting on a piece moves it; if your browser/device supports simulating a second touch point, confirm touching down a second finger mid-drag immediately hands control to orbit/pan/zoom instead of continuing to move the piece.

- [ ] **Step 7: Commit**

```bash
cd wood-cad-workshop
git add src/App.tsx src/ui/PieceControls.tsx src/ui/Inspector.tsx
git commit -m "fix(wood-cad-workshop): fix Inspector/ViewControls overlap, bump touch targets

Groups PieceControls and Inspector into one top-right flex column so
Inspector's position no longer depends on ViewControls' variable
wrapped height (was a hardcoded marginTop: 140 magic number). Also
bumps Inspector's two number inputs from 32px to the app's 44px
touch-target minimum.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```
