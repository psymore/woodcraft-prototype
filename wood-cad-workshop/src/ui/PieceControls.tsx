import { getComponent } from '../engine'
import { useSceneSession } from '../store/sceneSessionStore'
import { panelButtonStyle } from './buttonStyle'

export function PieceControls() {
  const selected = useSceneSession((s) => s.instances.find((i) => i.id === s.selectedId) ?? null)
  const rotateSelected = useSceneSession((s) => s.rotateSelected)
  const standSelectedUp = useSceneSession((s) => s.standSelectedUp)
  const duplicateSelected = useSceneSession((s) => s.duplicateSelected)
  const deleteSelected = useSceneSession((s) => s.deleteSelected)

  if (!selected) return null
  const canStandUp = getComponent(selected.componentDefinitionId).connectionRole === 'ends'

  return (
    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
      <button onClick={rotateSelected} style={panelButtonStyle()}>
        ROTATE
      </button>
      {canStandUp && (
        <button onClick={standSelectedUp} style={panelButtonStyle()}>
          STAND UP
        </button>
      )}
      <button onClick={duplicateSelected} style={panelButtonStyle()}>
        DUPLICATE
      </button>
      <button onClick={deleteSelected} style={panelButtonStyle()}>
        DELETE
      </button>
    </div>
  )
}
