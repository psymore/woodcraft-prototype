import { useSceneSession } from '../store/sceneSessionStore'

export function ExplodedView() {
  const amount = useSceneSession((s) => s.explodeAmount)
  const setExplodeAmount = useSceneSession((s) => s.setExplodeAmount)
  const active = amount > 0

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <button onClick={() => setExplodeAmount(active ? 0 : 0.5)} style={{ minWidth: 44, minHeight: 44 }}>
        {active ? 'ASSEMBLE' : 'EXPLODE'}
      </button>
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
