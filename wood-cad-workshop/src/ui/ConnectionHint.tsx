import { useSceneSession } from '../store/sceneSessionStore'

// Live "why didn't this connect" feedback — renders only while
// sceneSessionStore's blockedConnectionHint is set (a drag currently
// sitting on an anchor that's already claimed by another connection).
// Not a timed toast: it tracks the live drag in real time, same as the
// candidate markers it complements, and disappears the moment the hint
// clears (moved away, or the drag ended).
export function ConnectionHint() {
  const hint = useSceneSession((s) => s.blockedConnectionHint)

  if (!hint) return null

  return (
    <div
      style={{
        position: 'absolute',
        bottom: 72,
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 1,
        background: 'var(--wc-panel)',
        color: 'var(--wc-text)',
        border: '1px solid var(--wc-accent)',
        padding: '8px 14px',
        borderRadius: 8,
        fontSize: 14,
        whiteSpace: 'nowrap',
        pointerEvents: 'none',
      }}
    >
      {hint}
    </div>
  )
}
