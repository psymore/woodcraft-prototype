import { ArrowUpFromLine, Copy, RotateCw, Trash2 } from 'lucide-react'
import { getComponent } from '../engine'
import { useSceneSession } from '../store/sceneSessionStore'
import { MenuButton } from './MenuButton'

export function PieceControls({ showLabels }: { showLabels: boolean }) {
  const selected = useSceneSession((s) => s.instances.find((i) => i.id === s.selectedId) ?? null)
  const rotateSelected = useSceneSession((s) => s.rotateSelected)
  const standSelectedUp = useSceneSession((s) => s.standSelectedUp)
  const duplicateSelected = useSceneSession((s) => s.duplicateSelected)
  const deleteSelected = useSceneSession((s) => s.deleteSelected)

  if (!selected) return null
  const canStandUp = getComponent(selected.componentDefinitionId).connectionRole === 'ends'

  return (
    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
      <MenuButton icon={<RotateCw size={18} />} label="Rotate" showLabels={showLabels} onClick={rotateSelected} />
      {canStandUp && (
        <MenuButton
          icon={<ArrowUpFromLine size={18} />}
          label="Stand Up"
          showLabels={showLabels}
          onClick={standSelectedUp}
        />
      )}
      <MenuButton icon={<Copy size={18} />} label="Duplicate" showLabels={showLabels} onClick={duplicateSelected} />
      <MenuButton icon={<Trash2 size={18} />} label="Delete" showLabels={showLabels} onClick={deleteSelected} />
    </div>
  )
}
