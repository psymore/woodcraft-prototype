import { useSceneSession } from '../store/sceneSessionStore'

const switchStyle = (active: boolean) => ({
  minWidth: 44,
  minHeight: 44,
  background: active ? '#4a90d9' : '#eee',
  color: active ? '#fff' : '#333',
})

// Bottom-right, opposite the menu button — lets the user hide the rotation
// gizmo and/or the vertical-move handle when they're in the way of the
// piece itself, without losing the selection.
export function GizmoToggles() {
  const hasSelection = useSceneSession((s) => s.selectedId !== null)
  const showRotationGizmo = useSceneSession((s) => s.showRotationGizmo)
  const showMoveHandle = useSceneSession((s) => s.showMoveHandle)
  const toggleRotationGizmo = useSceneSession((s) => s.toggleRotationGizmo)
  const toggleMoveHandle = useSceneSession((s) => s.toggleMoveHandle)

  if (!hasSelection) return null

  return (
    <div style={{ position: 'absolute', bottom: 8, right: 8, display: 'flex', gap: 4, zIndex: 1 }}>
      <button onClick={toggleMoveHandle} style={switchStyle(showMoveHandle)} title="Vertical move handle">
        ↕
      </button>
      <button onClick={toggleRotationGizmo} style={switchStyle(showRotationGizmo)} title="Rotation gizmo">
        ↻
      </button>
    </div>
  )
}
