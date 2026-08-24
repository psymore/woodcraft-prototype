import { COMPONENT_LIBRARY } from './component'
import type { ComponentCategory, ComponentDefinition } from './component'

const CATEGORY_ORDER: ComponentCategory[] = ['WOOD', 'HARDWARE', 'FASTENER']
const CATEGORY_LABELS: Record<ComponentCategory, string> = {
  WOOD: 'Wood',
  HARDWARE: 'Hardware',
  FASTENER: 'Fasteners',
}

export function Inventory({
  open,
  onToggle,
  onAdd,
}: {
  open: boolean
  onToggle: () => void
  onAdd: (definition: ComponentDefinition) => void
}) {
  return (
    <>
      <button
        onClick={onToggle}
        style={{ position: 'absolute', bottom: 8, right: 8, minWidth: 44, minHeight: 44, zIndex: 1 }}
      >
        {open ? 'CLOSE' : 'INVENTORY'}
      </button>
      {open && (
        <div
          style={{
            position: 'absolute',
            bottom: 60,
            right: 8,
            left: 8,
            maxHeight: '55vh',
            overflowY: 'auto',
            background: 'rgba(255,255,255,0.96)',
            border: '1px solid #ccc',
            borderRadius: 8,
            padding: 10,
            zIndex: 1,
          }}
        >
          {CATEGORY_ORDER.map((category) => (
            <div key={category} style={{ marginBottom: 10 }}>
              <div style={{ fontWeight: 'bold', marginBottom: 4 }}>{CATEGORY_LABELS[category]}</div>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {COMPONENT_LIBRARY.filter((def) => def.category === category).map((def) => (
                  <button
                    key={def.id}
                    onClick={() => onAdd(def)}
                    style={{ minWidth: 44, minHeight: 44 }}
                  >
                    {def.name}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  )
}
