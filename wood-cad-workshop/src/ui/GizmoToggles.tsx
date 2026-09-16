import { Anchor, Lock, MoveVertical, Rotate3d } from 'lucide-react'
import { useSceneSession } from '../store/sceneSessionStore'
import { panelButtonStyle } from './buttonStyle'

// Bottom-right, opposite the menu button — lets the user hide the rotation
// gizmo and/or the vertical-move handle when they're in the way of the
// piece itself, without losing the selection.
export function GizmoToggles() {
  const hasSelection = useSceneSession((s) => s.selectedId !== null)
  const showRotationGizmo = useSceneSession((s) => s.showRotationGizmo)
  const showMoveHandle = useSceneSession((s) => s.showMoveHandle)
  const showConnectionPoints = useSceneSession((s) => s.showConnectionPoints)
  const gizmoLocked = useSceneSession((s) => s.gizmoLocked)
  const toggleRotationGizmo = useSceneSession((s) => s.toggleRotationGizmo)
  const toggleMoveHandle = useSceneSession((s) => s.toggleMoveHandle)
  const toggleConnectionPoints = useSceneSession((s) => s.toggleConnectionPoints)
  const toggleGizmoLocked = useSceneSession((s) => s.toggleGizmoLocked)

  if (!hasSelection) return null

  // Three plain, separate clicks (no dblclick gesture — that fired the
  // browser's native double-click detection, which is unreliable on touch
  // and also required two clicks close together in time rather than
  // "click, then some other click later") cycle the gizmo button through
  // hidden -> shown -> shown+locked -> back to hidden, rather than a
  // click/double-click split on the same tap.
  const handleGizmoButtonClick = () => {
    if (!showRotationGizmo) {
      toggleRotationGizmo() // hidden -> shown
    } else if (!gizmoLocked) {
      toggleGizmoLocked() // shown -> shown + locked (badge appears)
    } else {
      toggleRotationGizmo() // shown + locked -> hidden, unlocked (reset)
      toggleGizmoLocked()
    }
  }
  const gizmoButtonTitle = !showRotationGizmo
    ? 'Rotation gizmo (click to show)'
    : !gizmoLocked
      ? 'Rotation gizmo shown (click to lock)'
      : 'Rotation gizmo locked (click to hide)'

  return (
    <div
      style={{
        position: 'absolute',
        bottom: 'max(8px, env(safe-area-inset-bottom))',
        right: 'max(8px, env(safe-area-inset-right))',
        display: 'flex',
        gap: 4,
        zIndex: 1,
      }}
    >
      <button onClick={toggleMoveHandle} style={panelButtonStyle(showMoveHandle)} title="Vertical move handle">
        <MoveVertical size={20} />
      </button>
      {/* Rotate3d (a small 3D-axes rotation glyph), not the ↻/RotateCw
          "redo/refresh" look — this toggles the rotation GIZMO's
          visibility, not a one-shot rotate action, and the refresh-style
          arrow read as an action button rather than a visibility switch.
          Locking (see handleGizmoButtonClick above) keeps the current
          selection (and its gizmo) pinned through background taps, e.g.
          the pointerdown that starts an orbit/pan gesture near another
          piece (see Scene.tsx's ground-plane handler) — shown as a small
          badge on this same button rather than its own toggle. */}
      <button
        onClick={handleGizmoButtonClick}
        style={{ ...panelButtonStyle(showRotationGizmo), position: 'relative' }}
        title={gizmoButtonTitle}
      >
        <Rotate3d size={20} />
        {gizmoLocked && (
          <span
            style={{
              position: 'absolute',
              top: -4,
              right: -4,
              width: 16,
              height: 16,
              borderRadius: '50%',
              background: 'var(--wc-accent)',
              border: '1px solid var(--wc-accent-contrast)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Lock size={10} color="var(--wc-accent-contrast)" />
          </span>
        )}
      </button>
      <button onClick={toggleConnectionPoints} style={panelButtonStyle(showConnectionPoints)} title="Show connection points">
        <Anchor size={20} />
      </button>
    </div>
  )
}
