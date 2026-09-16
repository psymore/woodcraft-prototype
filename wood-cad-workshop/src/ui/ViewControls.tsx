import { VIEW_NAMES } from '../engine'
import type { ViewName } from '../engine'
import { useSceneSession } from '../store/sceneSessionStore'
import { panelButtonStyle } from './buttonStyle'

export function ViewControls({
  onSelectView,
  onFrameAll,
  onFrameSelected,
}: {
  onSelectView: (view: ViewName) => void
  onFrameAll: () => void
  onFrameSelected: () => void
}) {
  const hasSelection = useSceneSession((s) => s.selectedId !== null)

  return (
    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
      {VIEW_NAMES.map((view) => (
        <button key={view} onClick={() => onSelectView(view)} style={panelButtonStyle()}>
          {view.toUpperCase()}
        </button>
      ))}
      <button onClick={onFrameAll} style={panelButtonStyle()}>
        FRAME ALL
      </button>
      <button onClick={onFrameSelected} disabled={!hasSelection} style={panelButtonStyle()}>
        FRAME SEL
      </button>
    </div>
  )
}
