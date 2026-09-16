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
  const toggleRotationGizmo = useSceneSession((s) => s.toggleRotationGizmo)
  const toggleMoveHandle = useSceneSession((s) => s.toggleMoveHandle)
  const toggleConnectionPoints = useSceneSession((s) => s.toggleConnectionPoints)

  if (!hasSelection) return null

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
        ↕
      </button>
      <button onClick={toggleRotationGizmo} style={panelButtonStyle(showRotationGizmo)} title="Rotation gizmo">
        ↻
      </button>
      <button onClick={toggleConnectionPoints} style={panelButtonStyle(showConnectionPoints)} title="Show connection points">
        ⚓
      </button>
    </div>
  )
}
