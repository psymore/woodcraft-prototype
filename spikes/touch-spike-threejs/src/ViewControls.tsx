import { VIEW_NAMES } from './viewPresets'
import type { ViewName } from './viewPresets'

export function ViewControls({
  onSelectView,
  onFrameAll,
  onFrameSelected,
  hasSelection,
}: {
  onSelectView: (view: ViewName) => void
  onFrameAll: () => void
  onFrameSelected: () => void
  hasSelection: boolean
}) {
  return (
    <div
      style={{
        position: 'absolute',
        top: 8,
        left: 8,
        display: 'flex',
        gap: 4,
        flexWrap: 'wrap',
        zIndex: 1,
      }}
    >
      {VIEW_NAMES.map((view) => (
        <button
          key={view}
          onClick={() => onSelectView(view)}
          style={{ minWidth: 44, minHeight: 44 }}
        >
          {view.toUpperCase()}
        </button>
      ))}
      <button onClick={onFrameAll} style={{ minWidth: 44, minHeight: 44 }}>
        FRAME ALL
      </button>
      <button
        onClick={onFrameSelected}
        disabled={!hasSelection}
        style={{ minWidth: 44, minHeight: 44 }}
      >
        FRAME SEL
      </button>
    </div>
  )
}
