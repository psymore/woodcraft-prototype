import { registerComponent } from '../../registry/registry'
import type { ComponentDefinition } from '../../core/types'

export const SQUARE_BEAM_DEFINITION: ComponentDefinition = {
  id: 'square_beam',
  name: 'Square Beam',
  category: 'WOOD',
  geometry: { shape: 'box' },
  defaultDimensions: { thickness: 3.5, width: 3.5, length: 96 },
  material: '#8c5730',
  connectionRole: 'ends',
  structuralProperties: {},
  explodeDirection: null,
  defaultSpeciesId: 'douglas_fir',
}

registerComponent(SQUARE_BEAM_DEFINITION)
