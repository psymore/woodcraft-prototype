import { useState } from 'react'
import type { ViewName } from '../engine'
import { useSceneSession } from '../store/sceneSessionStore'
import { ViewControls } from './ViewControls'
import { PieceControls } from './PieceControls'
import { InventoryButton } from './Inventory'
import { PullupKitButton } from './PullupKitButton'
import { ExplodedView } from './ExplodedView'

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
  const hasSelection = useSceneSession((s) => s.selectedId !== null)

  return (
    <>
      <button
        onClick={() => setOpen((o) => !o)}
        style={{ position: 'absolute', top: 8, left: 8, minWidth: 44, minHeight: 44, zIndex: 3 }}
      >
        ☰
      </button>
      {open && (
        <>
          <div
            onClick={() => setOpen(false)}
            style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.2)', zIndex: 2 }}
          />
          <div
            style={{
              position: 'absolute',
              top: 56,
              left: 8,
              zIndex: 3,
              width: 'min(240px, 70vw)',
              maxHeight: '75vh',
              overflowY: 'auto',
              background: 'rgba(255,255,255,0.96)',
              border: '1px solid #ccc',
              borderRadius: 8,
              padding: 10,
              display: 'flex',
              flexDirection: 'column',
              gap: 10,
              fontSize: 13,
            }}
          >
            <section>
              <div style={{ fontWeight: 'bold', marginBottom: 4 }}>View</div>
              <ViewControls onSelectView={onSelectView} onFrameAll={onFrameAll} onFrameSelected={onFrameSelected} />
            </section>

            {hasSelection && (
              <section>
                <div style={{ fontWeight: 'bold', marginBottom: 4 }}>Piece</div>
                <PieceControls />
              </section>
            )}

            <section>
              <div style={{ fontWeight: 'bold', marginBottom: 4 }}>Inventory</div>
              <InventoryButton />
            </section>

            <section>
              <div style={{ fontWeight: 'bold', marginBottom: 4 }}>Kit</div>
              <PullupKitButton />
            </section>

            <section>
              <div style={{ fontWeight: 'bold', marginBottom: 4 }}>Exploded View</div>
              <ExplodedView />
            </section>
          </div>
        </>
      )}
    </>
  )
}
