import { registerComponent } from '../../registry/registry'
import type { ComponentDefinition } from '../../core/types'

export const PULLUP_BAR_DEFINITION: ComponentDefinition = {
  id: 'pullup_bar',
  name: 'Pull-up Bar',
  category: 'WOOD',
  geometry: { shape: 'cylinder' },
  defaultDimensions: { diameter: 1.25, length: 48 },
  material: '#a6693f',
  connectionRole: 'ends',
  structuralProperties: { bendingStrength: 98_000_000 }, // ≈98 MPa, representative hardwood dowel MOR — estimate only
  explodeDirection: null,
}

registerComponent(PULLUP_BAR_DEFINITION)
