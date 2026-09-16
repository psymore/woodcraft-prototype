import { ArrowDown, ArrowLeft, ArrowRight, ArrowUp, Box, Circle, CircleDot, Focus, Maximize } from 'lucide-react'
import type { ViewName } from '../engine'
import { useSceneSession } from '../store/sceneSessionStore'
import { MenuButton } from './MenuButton'

// One icon per camera preset — directional arrows for the four side views,
// Box for the free-orbit iso view, and a facing/away dot pair for
// front/back (there's no natural lucide icon for "camera pointed at the
// board's front face", so CircleDot/Circle reads as "toward you" / "away
// from you" instead). Imperfect on their own, which is exactly what
// MainMenu's label toggle is for — the tooltip (see MenuButton) always has
// the real name regardless.
const VIEW_ICONS: Record<ViewName, JSX.Element> = {
  '3d': <Box size={18} />,
  front: <CircleDot size={18} />,
  back: <Circle size={18} />,
  left: <ArrowLeft size={18} />,
  right: <ArrowRight size={18} />,
  top: <ArrowUp size={18} />,
  bottom: <ArrowDown size={18} />,
}

const VIEW_LABELS: Record<ViewName, string> = {
  '3d': '3D',
  front: 'Front',
  back: 'Back',
  left: 'Left',
  right: 'Right',
  top: 'Top',
  bottom: 'Bottom',
}

export function ViewControls({
  onSelectView,
  onFrameAll,
  onFrameSelected,
  showLabels,
}: {
  onSelectView: (view: ViewName) => void
  onFrameAll: () => void
  onFrameSelected: () => void
  showLabels: boolean
}) {
  const hasSelection = useSceneSession((s) => s.selectedId !== null)

  // Fixed 3-2-2 grouping (iso+front/back, then the left/right pair, then
  // the top/bottom pair) rather than one flex-wrapped row — explicit rows
  // so the grouping stays exactly 3/2/2 regardless of menu width, instead
  // of however many happen to fit per line.
  const rows: ViewName[][] = [
    ['3d', 'front', 'back'],
    ['left', 'right'],
    ['top', 'bottom'],
  ]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {rows.map((row) => (
        <div key={row.join('-')} style={{ display: 'flex', gap: 8 }}>
          {row.map((view) => (
            <MenuButton
              key={view}
              icon={VIEW_ICONS[view]}
              label={VIEW_LABELS[view]}
              showLabels={showLabels}
              onClick={() => onSelectView(view)}
            />
          ))}
        </div>
      ))}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <MenuButton icon={<Maximize size={18} />} label="Frame All" showLabels={showLabels} onClick={onFrameAll} />
        <MenuButton
          icon={<Focus size={18} />}
          label="Frame Selected"
          showLabels={showLabels}
          onClick={onFrameSelected}
          disabled={!hasSelection}
        />
      </div>
    </div>
  )
}
