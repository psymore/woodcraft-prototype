# Wood CAD Workshop — Mobile Interaction Polish (Sub-project 7) Design

Status: approved for implementation.

## Relationship to prior stages

[2026-08-22-wood-cad-workshop-design.md](2026-08-22-wood-cad-workshop-design.md)
scoped this as Sub-project 7, the last item on the original roadmap:
"touch-gesture pass across everything built (avoid accidental moves
during orbit, drawer/sheet ergonomics, touch target sizing)." That
document's full-roadmap framing is historical (see its appended
decision note), but the Sub-project 7 description itself still stands
as the scope for this spec.

Per the approval-gate rule in [CLAUDE.md](../../../CLAUDE.md#before-you-start),
this sub-project needed its own spec before implementation — this
document is that spec. Sub-projects 1–6 are complete in
`wood-cad-workshop/`; see `docs/superpowers/plans/ACTIVE-WORK-vscode.md`
for current state.

## Starting point: what a code audit found

Before scoping this spec, the existing touch/gesture code was read in
full (`App.tsx`, `Piece.tsx`, `Inventory.tsx`, `PieceControls.tsx`,
`ViewControls.tsx`, `Inspector.tsx`, `ExplodedView.tsx`,
`PullupKitButton.tsx`). Two of the roadmap's three named concerns are
already substantially solved:

- **Avoid accidental moves during orbit:** already handled.
  `App.tsx`'s `activeTouchesRef`/`multiTouchActiveRef`, tracked via
  capture-phase pointer handlers on the root div, flips
  `isDraggingPiece` to `false` and freezes any in-progress piece-drag
  (`Piece.tsx`'s `handlePointerMove` checks `multiTouchActiveRef` on
  every move) the instant a second finger touches down anywhere.
  One-finger gestures are disambiguated by hit-testing at pointer-down:
  `Piece.tsx`'s `handlePointerDown` calls `e.stopPropagation()`, so a
  press that lands on a piece drags it and never reaches
  `OrbitControls`; a press on empty space orbits. This spec makes no
  code change here — see "Verification only" below.
- **Touch target sizing:** already applied almost everywhere — every
  button in `Inventory.tsx`, `PieceControls.tsx`, `ViewControls.tsx`,
  `ExplodedView.tsx`, and `PullupKitButton.tsx` already carries
  `minWidth: 44, minHeight: 44`. The one gap: `Inspector.tsx`'s number
  inputs (dimensions and, since Sub-project 6, the structural-check
  weight field) are `minHeight: 32` — below the 44px minimum every
  other control in the app already meets.

What's genuinely unaddressed is **drawer/sheet ergonomics**:
`Inventory.tsx` is a plain absolute-positioned `<div>` that appears/
disappears on toggle — no backdrop, no dismiss-by-swipe, no
safe-area-inset awareness for phones with a home indicator. Separately,
`Inspector.tsx` is positioned with a hardcoded `marginTop: 140` to sit
below `ViewControls.tsx`, whose own height is not fixed — it renders
up to 9 buttons (`VIEW_NAMES` plus Frame All/Frame Selected) that wrap
onto multiple rows on a narrow phone viewport, so the magic-number
offset can under-clear it and let the panels overlap.

## Scope

1. A reusable `BottomSheet` component, with `Inventory.tsx` rebuilt on
   top of it.
2. A real layout fix for the Inspector/ViewControls overlap risk
   (replacing the magic-number offset), grouping `PieceControls` and
   `Inspector` into one flex-column container.
3. Touch target sizing for `Inspector.tsx`'s number inputs.
4. A verification-only pass confirming the existing orbit/drag
   disambiguation still holds — no code change expected.

Explicitly out of scope, decided during brainstorming:
- A **theme-switcher** feature (colors modeled on Godot's editor
  defaults) — raised during this same conversation, but it's an
  unrelated subsystem (visual theming, not touch/gesture ergonomics)
  and is deferred to its own future spec, not folded in here.
- Making `Inspector` itself a bottom sheet, or any "both sheets open
  at once" interaction model — considered during brainstorming (a
  visual mockup compared three layouts) and explicitly rejected in
  favor of the smallest change that solves the concrete problems
  found: `Inspector` stays a corner panel; only `Inventory` becomes a
  sheet.
- Sheet open/close motion (slide-in/fade animation). The improvement
  here is structural (backdrop, drag-to-dismiss, safe-area, reuse),
  not visual polish; the sheet still appears/disappears immediately,
  matching today's behavior.
- Fling/velocity-based dismiss. Dismiss is decided by drag distance
  only (see below) — no velocity tracking.
- A third-party bottom-sheet library. This codebase has zero UI
  dependencies beyond React itself, R3F/drei, and Zustand; the drag
  gesture is hand-rolled with pointer events, following the same
  pattern `Piece.tsx` already uses for piece-dragging.
- Any change to `sceneSessionStore.ts`'s `inventoryOpen`/
  `toggleInventory` — they already model exactly the boolean this
  component needs and are reused as-is.

## `BottomSheet` component

New file `src/ui/BottomSheet.tsx`:

```tsx
export function BottomSheet({
  open,
  onClose,
  children,
}: {
  open: boolean
  onClose: () => void
  children: React.ReactNode
}): React.ReactElement | null
```

- Renders `null` when `open` is `false` (matches `Inventory.tsx`'s
  current conditional-render behavior — no mount/unmount transition
  to manage).
- When open, renders two layers: a full-viewport backdrop (`position:
  fixed`, semi-transparent, `onClick={onClose}`) and the sheet itself
  (`position: fixed`, bottom-anchored, `left/right: 0`,
  `border-radius` on the top corners, white background — matching the
  existing panel style already used by `Inventory`/`Inspector`/
  `ExplodedView`).
- A drag handle (`36px × 4px` rounded bar, centered, matching the
  mockup shown during brainstorming) at the top of the sheet, wired to
  `onPointerDown`/`onPointerMove`/`onPointerUp` — the same three-handler
  pointer-capture pattern `Piece.tsx` already uses, adapted to drag a
  `translateY` offset instead of a 3D position. On `pointerdown`,
  capture the pointer and record the starting Y and the sheet's
  rendered height (`getBoundingClientRect().height`, read once via a
  ref). On `pointermove`, compute `dragDeltaY = currentY - startY`
  (clamped to `>= 0` — the sheet only drags downward) and apply it as
  a `translateY(${dragDeltaY}px)` inline style. On `pointerup`, call
  `shouldDismiss(dragDeltaY, sheetHeightPx)` (see below): if true, call
  `onClose()`; either way, reset the drag offset to 0 (snapping back
  is just clearing the inline transform — `open` becoming `false`
  after `onClose()` unmounts the sheet entirely in the dismiss case,
  so no separate "animate back" state is needed).
- Bottom padding on the sheet's content area includes
  `paddingBottom: 'max(10px, env(safe-area-inset-bottom))'` so content
  isn't obscured by a phone's home indicator.
- `zIndex` matches the existing overlay convention (`1`) so it layers
  correctly with the rest of the UI; the backdrop sits at the same
  `zIndex` immediately behind the sheet in DOM order (backdrop element
  first, sheet element second, both children of one fragment).

## `shouldDismiss` — pure gesture-threshold helper

New file `src/ui/bottomSheetGesture.ts`:

```ts
const DISMISS_THRESHOLD_RATIO = 0.3

export function shouldDismiss(dragDeltaY: number, sheetHeightPx: number): boolean {
  if (sheetHeightPx <= 0) return false
  return dragDeltaY / sheetHeightPx > DISMISS_THRESHOLD_RATIO
}
```

Pulled out as a standalone, side-effect-free function — same
isolation principle the codebase already applies to domain logic in
`engine/core/*` (`snap.ts`, `explode.ts`, `structuralCheck.ts`),
applied here to a UI-gesture decision instead of a domain calculation,
so the threshold math is unit-testable without mounting a component or
simulating pointer events. Unit tests in `src/ui/bottomSheetGesture.test.ts`.

## `Inventory.tsx` changes

Rebuilt on `BottomSheet`:

```tsx
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
        {/* existing category/button-grid content, unchanged */}
      </BottomSheet>
    </>
  )
}
```

The toggle button stays exactly as it is today (it's already a
44×44px control positioned correctly). Only the panel markup moves
into `BottomSheet`'s `children`; the category loop and `addComponent`
wiring are unchanged. `onClose={toggleInventory}` is safe without a
dedicated "close" action: the sheet is only interactive while
`open` is `true`, so a dismiss gesture always means "close," and
`toggleInventory` flipping `true → false` is exactly that.

## Inspector/ViewControls layout fix

In `App.tsx`, group `PieceControls` and `Inspector` into one
right-anchored flex column instead of positioning them independently:

```tsx
<div style={{ position: 'absolute', top: 8, right: 8, display: 'flex', flexDirection: 'column', gap: 8, zIndex: 1 }}>
  <PieceControls />
  <Inspector />
</div>
```

`PieceControls.tsx` and `Inspector.tsx` each drop their own
`position: 'absolute', top: 8, right: 8` (and Inspector's
`marginTop: 140`) since the wrapping container now owns positioning;
each component's root `<div>` keeps its visual styling (background,
border, padding) but becomes a normal flow element inside the flex
column. This is a real fix, not a relocated magic number: the column
is on the opposite side of the screen from `ViewControls` (which stays
top-left), so `Inspector`'s vertical position no longer depends on
`ViewControls`'s variable wrapped height at all. `PieceControls` and
`Inspector` are already both selection-gated (each returns `null` when
nothing is selected... `PieceControls` when `!hasSelection`,
`Inspector` when `!selectedId`), so they mount/unmount together and
the flex column's height is always exactly what's needed.

## Touch target sizing

In `Inspector.tsx`, both number inputs currently styled
`{ width: 80, minHeight: 32 }` (the dimensions loop, and the
structural-check weight field) change to `{ width: 80, minHeight: 44 }`.
No other file needs this change — every other interactive control in
`src/ui/` already meets the 44px minimum.

## Verification only: orbit/drag disambiguation

No code change. Manual verification step (see Testing) confirms on a
real touch device or browser touch emulation: single-finger drag on
empty space orbits; single-finger drag starting on a piece moves it;
a second finger touching down mid-drag immediately hands control back
to orbit/pan/zoom without the piece continuing to follow the first
finger.

## Testing

- `bottomSheetGesture.test.ts` (vitest): `shouldDismiss` at, above, and
  below the 0.3 threshold ratio; a `sheetHeightPx <= 0` guard case.
- `tsc -b` and `vitest run` clean.
- Manual verification in the browser (desktop pointer + touch
  emulation) and, if available, on a real phone:
  - Open Inventory: backdrop appears, drag handle visible, dragging
    the handle down past ~30% of the sheet's height dismisses it;
    dragging less than that snaps back; tapping the backdrop dismisses
    it; content padding clears a simulated home indicator.
  - Select a piece: `PieceControls` and `Inspector` stack correctly in
    the top-right column with no overlap, at both a wide and a narrow
    (phone-width) viewport, regardless of how many `ViewControls`
    buttons wrap on the left.
  - Inspector's number inputs (dimensions and, for the pull-up bar,
    the weight field) are visibly larger / easier to tap than before.
  - Orbit/drag disambiguation per "Verification only" above.

## Out of scope (explicit)

- Theme switching (deferred to its own future spec).
- Sheet open/close animation.
- Fling/velocity-based dismiss.
- A third-party bottom-sheet dependency.
- Making `Inspector` a bottom sheet or any simultaneous-sheets model.
- Any change to `sceneSessionStore.ts`.
