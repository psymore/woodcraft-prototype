import { Combine, Expand } from 'lucide-react'
import { useSceneSession } from '../store/sceneSessionStore'
import { MenuButton } from './MenuButton'

export function ExplodedView({ showLabels }: { showLabels: boolean }) {
  const amount = useSceneSession((s) => s.explodeAmount)
  const setExplodeAmount = useSceneSession((s) => s.setExplodeAmount)
  const active = amount > 0

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
      <MenuButton
        icon={active ? <Combine size={18} /> : <Expand size={18} />}
        label={active ? 'Assemble' : 'Explode'}
        showLabels={showLabels}
        onClick={() => setExplodeAmount(active ? 0 : 0.5)}
        active={active}
      />
      {active && (
        <>
          <input
            type="range"
            min={0}
            max={100}
            value={Math.round(amount * 100)}
            onChange={(e) => setExplodeAmount(Number(e.target.value) / 100)}
            style={{ width: 140, height: 44 }}
          />
          <span style={{ minWidth: 36 }}>{Math.round(amount * 100)}%</span>
        </>
      )}
    </div>
  )
}
