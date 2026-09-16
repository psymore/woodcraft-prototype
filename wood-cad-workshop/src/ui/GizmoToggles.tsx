import { useSceneSession } from '../store/sceneSessionStore'

// Orange-tinted border and glow, unlike the app's default (unadorned,
// glow-free) button styling — these float directly over the 3D canvas
// and need to read as a distinct floating control cluster.
const switchStyle = (active: boolean) => ({
  minWidth: 44,
  minHeight: 44,
  background: active ? '#ff7a1a' : '#141210',
  color: active ? '#100c08' : '#eae6df',
  border: active ? '1px solid #ff7a1a' : '1px solid rgba(255, 122, 26, 0.5)',
  boxShadow: '0 0 8px rgba(255, 122, 26, 0.45)',
})

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
      <button onClick={toggleMoveHandle} style={switchStyle(showMoveHandle)} title="Vertical move handle">
        ↕
      </button>
      <button onClick={toggleRotationGizmo} style={switchStyle(showRotationGizmo)} title="Rotation gizmo">
        ↻
      </button>
      <button onClick={toggleConnectionPoints} style={switchStyle(showConnectionPoints)} title="Show connection points">
        ⚓
      </button>
    </div>
  )
}
