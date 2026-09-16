import { useState } from 'react'
import { CaseSensitive, Menu } from 'lucide-react'
import type { ViewName } from '../engine'
import { useSceneSession } from '../store/sceneSessionStore'
import { ViewControls } from './ViewControls'
import { PieceControls } from './PieceControls'
import { InventoryButton } from './Inventory'
import { PullupKitButton } from './PullupKitButton'
import { ExplodedView } from './ExplodedView'
import { ExplodedHint } from './ExplodedHint'
import { panelButtonStyle } from './buttonStyle'

// A per-viewer UI convenience (like a remembered tab), not app/session
// data — read straight from localStorage rather than the Zustand store.
// Defaults to icon-only (false): every control below already carries its
// full name as a `title` tooltip, so labels are an opt-in for anyone who
// wants them rather than the default.
const SHOW_LABELS_STORAGE_KEY = 'wc-menu-show-labels'

function readShowLabels(): boolean {
  try {
    return localStorage.getItem(SHOW_LABELS_STORAGE_KEY) === 'true'
  } catch {
    return false
  }
}

// Every floating button in the app, collapsed behind one top-left menu
// button so the viewport stays clear on mobile — only this button shows
// when the menu is closed. Grouped under section headers rather than
// merged into one flat list, since these are still separate concerns that
// may move back out to their own floating spots later.
export function MainMenu({
  onSelectView,
  onFrameAll,
  onFrameSelected,
}: {
  onSelectView: (view: ViewName) => void
  onFrameAll: () => void
  onFrameSelected: () => void
}) {
  const [open, setOpen] = useState(false)
  const [showLabels, setShowLabels] = useState(readShowLabels)
  const hasSelection = useSceneSession((s) => s.selectedId !== null)

  const toggleShowLabels = () => {
    setShowLabels((prev) => {
      const next = !prev
      try {
        localStorage.setItem(SHOW_LABELS_STORAGE_KEY, String(next))
      } catch {
        // Best-effort — a private window or blocked storage just means the
        // toggle doesn't persist across reloads, not that it stops working.
      }
      return next
    })
  }

  return (
    <>
      <button
        onClick={() => setOpen((o) => !o)}
        style={{
          position: 'absolute',
          top: 'max(8px, env(safe-area-inset-top))',
          left: 'max(8px, env(safe-area-inset-left))',
          zIndex: 3,
          ...panelButtonStyle(),
        }}
      >
        <Menu size={20} />
      </button>
      <ExplodedHint onClick={() => setOpen(true)} />
      {open && (
        <>
          <div
            onClick={() => setOpen(false)}
            style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.2)', zIndex: 2 }}
          />
          <div
            style={{
              position: 'absolute',
              top: 'calc(48px + max(8px, env(safe-area-inset-top)))',
              left: 'max(8px, env(safe-area-inset-left))',
              zIndex: 3,
              // Wide enough for the 7 view-preset buttons (ViewControls) to
              // sit on one row at icon-only size — 7 × 44px min tap target
              // + 6 × 8px gaps + this panel's own 12px×2 padding.
              width: 'min(400px, 92vw)',
              maxHeight: '75vh',
              overflowY: 'auto',
              background: 'var(--wc-panel)',
              color: 'var(--wc-text)',
              border: '1px solid var(--wc-border)',
              borderRadius: 12,
              padding: 12,
              display: 'flex',
              flexDirection: 'column',
              gap: 12,
              fontSize: 13,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ fontWeight: 'bold' }}>Menu</div>
              {/* Every control below already carries its name as a title
                  tooltip — this just switches the text on next to each
                  icon too, for anyone who'd rather not rely on tooltips. */}
              <button
                onClick={toggleShowLabels}
                style={{ ...panelButtonStyle(showLabels), minWidth: 32, minHeight: 32, padding: '0 6px' }}
                title={showLabels ? 'Hide button labels' : 'Show button labels'}
              >
                <CaseSensitive size={16} />
              </button>
            </div>

            <section>
              <div style={{ fontWeight: 'bold', marginBottom: 8 }}>View</div>
              <ViewControls
                onSelectView={onSelectView}
                onFrameAll={onFrameAll}
                onFrameSelected={onFrameSelected}
                showLabels={showLabels}
              />
            </section>

            {hasSelection && (
              <section>
                <div style={{ fontWeight: 'bold', marginBottom: 8 }}>Piece</div>
                <PieceControls showLabels={showLabels} />
              </section>
            )}

            <section>
              <div style={{ fontWeight: 'bold', marginBottom: 8 }}>Inventory</div>
              <InventoryButton showLabels={showLabels} onOpened={() => setOpen(false)} />
            </section>

            <section>
              <div style={{ fontWeight: 'bold', marginBottom: 8 }}>Kit</div>
              <PullupKitButton showLabels={showLabels} />
            </section>

            <section>
              <div style={{ fontWeight: 'bold', marginBottom: 8 }}>Exploded View</div>
              <ExplodedView showLabels={showLabels} />
            </section>
          </div>
        </>
      )}
    </>
  )
}
