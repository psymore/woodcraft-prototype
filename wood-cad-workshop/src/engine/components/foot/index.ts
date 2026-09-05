import { registerComponent } from '../../registry/registry'
import type { ComponentDefinition } from '../../core/types'

export const FOOT_DEFINITION: ComponentDefinition = {
  id: 'foot',
  name: 'Foot',
  category: 'WOOD',
  geometry: { shape: 'box' },
  defaultDimensions: { thickness: 3.5, width: 1.5, length: 24 },
  material: '#a6693f',
  connectionRole: 'single',
  structuralProperties: {},
  explodeDirection: null,
  defaultSpeciesId: 'red_oak',
}

registerComponent(FOOT_DEFINITION)
