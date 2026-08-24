import { registerComponent } from '../../registry/registry'
import type { ComponentDefinition } from '../../core/types'

export const L_BRACKET_DEFINITION: ComponentDefinition = {
  id: 'l_bracket',
  name: 'L-Bracket',
  category: 'HARDWARE',
  geometry: { shape: 'box' },
  defaultDimensions: { thickness: 0.125, width: 1.5, length: 1.5 },
  material: '#8a8a8a',
  connectionRole: 'single',
  structuralProperties: {},
  explodeDirection: null,
}

registerComponent(L_BRACKET_DEFINITION)
