import { registerComponent } from '../../registry/registry'
import type { ComponentDefinition } from '../../core/types'

export const ROUND_ROD_DEFINITION: ComponentDefinition = {
  id: 'round_rod',
  name: 'Round Rod',
  category: 'WOOD',
  geometry: { shape: 'cylinder' },
  defaultDimensions: { diameter: 1, length: 36 },
  material: '#c9a273',
  connectionRole: 'ends',
  structuralProperties: {},
  explodeDirection: null,
  defaultSpeciesId: 'red_oak',
}

registerComponent(ROUND_ROD_DEFINITION)
