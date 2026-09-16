import { getComponents } from '../engine'
import type { ComponentCategory } from '../engine'
import { useSceneSession } from '../store/sceneSessionStore'
import { BottomSheet } from './BottomSheet'
import { panelButtonStyle } from './buttonStyle'

const CATEGORY_ORDER: ComponentCategory[] = ['WOOD', 'HARDWARE', 'FASTENER']
const CATEGORY_LABELS: Record<ComponentCategory, string> = {
  WOOD: 'Wood',
  HARDWARE: 'Hardware',
  FASTENER: 'Fasteners',
}

// Split in two so the trigger button can live in the main menu while the
// sheet itself (driven purely by store state) stays mounted at the app
// root, independent of wherever the button that opens it lives.
export function InventoryButton() {
  const toggleInventory = useSceneSession((s) => s.toggleInventory)
  return (
    <button onClick={toggleInventory} style={panelButtonStyle()}>
      INVENTORY
    </button>
  )
}

export function InventorySheet() {
  const open = useSceneSession((s) => s.inventoryOpen)
  const toggleInventory = useSceneSession((s) => s.toggleInventory)
  const addComponent = useSceneSession((s) => s.addComponent)
  const library = getComponents()

  return (
    <BottomSheet open={open} onClose={toggleInventory}>
        {CATEGORY_ORDER.map((category) => (
          <div key={category} style={{ marginBottom: 12 }}>
            <div style={{ fontWeight: 'bold', marginBottom: 8 }}>{CATEGORY_LABELS[category]}</div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {library
                .filter((def) => def.category === category)
                .map((def) => (
                  <button
                    key={def.id}
                    onClick={() => addComponent(def)}
                    style={panelButtonStyle()}
                  >
                    {def.name}
                  </button>
                ))}
            </div>
          </div>
        ))}
    </BottomSheet>
  )
}
