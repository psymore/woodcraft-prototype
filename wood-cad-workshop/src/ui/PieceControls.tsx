import { useSceneSession } from '../store/sceneSessionStore'

export function PieceControls() {
  const hasSelection = useSceneSession((s) => s.selectedId !== null)
  const rotateSelected = useSceneSession((s) => s.rotateSelected)
  const duplicateSelected = useSceneSession((s) => s.duplicateSelected)
  const deleteSelected = useSceneSession((s) => s.deleteSelected)

  if (!hasSelection) return null

  return (
    <div
      style={{
        position: 'absolute',
        top: 8,
        right: 8,
        display: 'flex',
        gap: 4,
        zIndex: 1,
      }}
    >
      <button onClick={rotateSelected} style={{ minWidth: 44, minHeight: 44 }}>
        ROTATE
      </button>
      <button onClick={duplicateSelected} style={{ minWidth: 44, minHeight: 44 }}>
        DUPLICATE
      </button>
      <button onClick={deleteSelected} style={{ minWidth: 44, minHeight: 44 }}>
        DELETE
      </button>
    </div>
  )
}
