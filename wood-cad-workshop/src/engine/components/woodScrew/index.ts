import { registerComponent } from '../../registry/registry'
import type { ComponentDefinition } from '../../core/types'

export const WOOD_SCREW_DEFINITION: ComponentDefinition = {
  id: 'wood_screw',
  name: 'Wood Screw',
  category: 'FASTENER',
  geometry: { shape: 'cylinder' },
  defaultDimensions: { diameter: 0.15, length: 1.5 },
  material: '#555555',
  connectionRole: 'none',
  structuralProperties: {},
  explodeDirection: null,
}

registerComponent(WOOD_SCREW_DEFINITION)
