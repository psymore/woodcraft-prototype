import { registerComponent } from '../../registry/registry'
import type { ComponentDefinition } from '../../core/types'

export const VERTICAL_POST_DEFINITION: ComponentDefinition = {
  id: 'vertical_post',
  name: 'Vertical Post',
  category: 'WOOD',
  geometry: { shape: 'box' },
  defaultDimensions: { thickness: 3.5, width: 3.5, length: 84 },
  material: '#8c5730',
  connectionRole: 'ends',
  structuralProperties: {},
  explodeDirection: null,
}

registerComponent(VERTICAL_POST_DEFINITION)
