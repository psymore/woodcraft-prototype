import { registerComponent } from '../../registry/registry'
import type { ComponentDefinition } from '../../core/types'

export const BOARD_DEFINITION: ComponentDefinition = {
  id: 'board',
  name: 'Board',
  category: 'WOOD',
  geometry: { shape: 'box' },
  defaultDimensions: { thickness: 1.5, width: 3.5, length: 48 },
  material: '#a6693f',
  connectionRole: 'ends',
  structuralProperties: {},
  explodeDirection: null,
  defaultSpeciesId: 'douglas_fir',
}

registerComponent(BOARD_DEFINITION)
