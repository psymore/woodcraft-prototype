// There's no collision detection on piece placement (movePiece snaps to a
// grid but never checks for overlap), so two pieces can end up occupying
// the same or overlapping volume — most commonly by dragging one directly
// onto another. When their faces end up coincident (or merely very close),
// two independently-transformed meshes rarely compute the exact same
// depth-buffer value at every pixel, so the GPU flickers between which
// one wins the depth test each frame — classic z-fighting, most visible
// when the two pieces have different colors (a matching color hides it).
//
// This doesn't stop pieces from overlapping (a modeling/UX question, not
// a rendering one) — it fixes the FLICKER itself: mapping each piece's
// stable id to a small, deterministic polygonOffsetFactor/Units value
// gives the renderer a way to consistently resolve an otherwise-ambiguous
// tie, so two overlapping pieces render as one stably in front of the
// other instead of dithering between colors frame to frame.
const RANGE = 16

export function depthBiasFor(id: string): number {
  let hash = 0
  for (let i = 0; i < id.length; i += 1) {
    hash = (hash * 31 + id.charCodeAt(i)) | 0
  }
  return (Math.abs(hash) % RANGE) - Math.floor(RANGE / 2)
}
