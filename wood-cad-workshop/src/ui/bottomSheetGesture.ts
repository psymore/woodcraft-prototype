const DISMISS_THRESHOLD_RATIO = 0.3

// Drag-distance-only dismiss decision for BottomSheet — no velocity/fling
// tracking. Pulled out as a pure function so the threshold math is
// unit-testable without mounting a component or simulating pointer events,
// the same isolation principle engine/core/* uses for domain logic.
export function shouldDismiss(dragDeltaY: number, sheetHeightPx: number): boolean {
  if (sheetHeightPx <= 0) return false
  return dragDeltaY / sheetHeightPx > DISMISS_THRESHOLD_RATIO
}
