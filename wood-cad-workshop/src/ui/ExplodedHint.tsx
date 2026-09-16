import { Combine } from 'lucide-react'
import { useSceneSession } from '../store/sceneSessionStore'

// A top-center status pill, visible only while exploded view is active —
// otherwise there's no on-screen indication of that mode once the menu
// (where it was turned on) is closed. Reuses ExplodedView.tsx's own
// active-state icon/label pair (Combine + "Assemble") for recognizability,
// though tapping it opens the menu rather than assembling directly —
// MainMenu passes its own setOpen(true) as `onClick`, since that's where
// the actual assemble control (and its slider) lives.
export function ExplodedHint({ onClick }: { onClick: () => void }) {
  const active = useSceneSession((s) => s.explodeAmount > 0)

  if (!active) return null

  return (
    <button
      onClick={onClick}
      title="Exploded view is on — tap to open the menu"
      style={{
        position: 'absolute',
        top: 'max(8px, env(safe-area-inset-top))',
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 1,
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        background: 'var(--wc-panel)',
        color: 'var(--wc-text)',
        border: '1px solid var(--wc-accent)',
        boxShadow: '0 0 8px rgba(255, 122, 26, 0.45)',
        padding: '0 14px',
        minHeight: 44,
        borderRadius: 8,
        fontSize: 13,
        whiteSpace: 'nowrap',
        cursor: 'pointer',
      }}
    >
      <Combine size={16} />
      Assemble
    </button>
  )
}
