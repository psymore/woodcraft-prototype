import { getComponent } from '../engine'
import { useSceneSession } from '../store/sceneSessionStore'

export function PieceControls() {
  const selected = useSceneSession((s) => s.instances.find((i) => i.id === s.selectedId) ?? null)
  const rotateSelected = useSceneSession((s) => s.rotateSelected)
  const standSelectedUp = useSceneSession((s) => s.standSelectedUp)
  const duplicateSelected = useSceneSession((s) => s.duplicateSelected)
  const deleteSelected = useSceneSession((s) => s.deleteSelected)

  if (!selected) return null
  const canStandUp = getComponent(selected.componentDefinitionId).connectionRole === 'ends'

  return (
    <div
      style={{ display: 'flex', gap: 4 }}
    >
      <button onClick={rotateSelected} style={{ minWidth: 44, minHeight: 44 }}>
        ROTATE
      </button>
      {canStandUp && (
        <button onClick={standSelectedUp} style={{ minWidth: 44, minHeight: 44 }}>
          STAND UP
        </button>
      )}
      <button onClick={duplicateSelected} style={{ minWidth: 44, minHeight: 44 }}>
        DUPLICATE
      </button>
      <button onClick={deleteSelected} style={{ minWidth: 44, minHeight: 44 }}>
        DELETE
      </button>
    </div>
  )
}
