import { getComponents } from '../engine'
import type { ComponentCategory } from '../engine'
import { useSceneSession } from '../store/sceneSessionStore'
import { BottomSheet } from './BottomSheet'

const CATEGORY_ORDER: ComponentCategory[] = ['WOOD', 'HARDWARE', 'FASTENER']
const CATEGORY_LABELS: Record<ComponentCategory, string> = {
  WOOD: 'Wood',
  HARDWARE: 'Hardware',
  FASTENER: 'Fasteners',
}

export function Inventory() {
  const open = useSceneSession((s) => s.inventoryOpen)
  const toggleInventory = useSceneSession((s) => s.toggleInventory)
  const addComponent = useSceneSession((s) => s.addComponent)
  const library = getComponents()

  return (
    <>
      <button
        onClick={toggleInventory}
        style={{ position: 'absolute', bottom: 8, right: 8, minWidth: 44, minHeight: 44, zIndex: 1 }}
      >
        {open ? 'CLOSE' : 'INVENTORY'}
      </button>
      <BottomSheet open={open} onClose={toggleInventory}>
        {CATEGORY_ORDER.map((category) => (
          <div key={category} style={{ marginBottom: 10 }}>
            <div style={{ fontWeight: 'bold', marginBottom: 4 }}>{CATEGORY_LABELS[category]}</div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {library
                .filter((def) => def.category === category)
                .map((def) => (
                  <button
                    key={def.id}
                    onClick={() => addComponent(def)}
                    style={{ minWidth: 44, minHeight: 44 }}
                  >
                    {def.name}
                  </button>
                ))}
            </div>
          </div>
        ))}
      </BottomSheet>
    </>
  )
}
