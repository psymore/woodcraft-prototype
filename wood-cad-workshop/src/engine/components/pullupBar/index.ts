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
  structuralProperties: {
    // ≈600N (135 lbf) — average breaking load of a doweled SPRUCE joint
    // (deliberately a different, weaker species than the bar's own
    // bendingStrength, now sourced from the instance's selected
    // speciesId — see species.ts — rather than a fixed per-definition
    // constant; see the structural-check spec's 2026-09-05 amendment
    // for why the connection check uses a different species anyway),
    // the weakest clean-break joint type tested. woodgears.ca
    // joint-strength tests: https://woodgears.ca/joint_strength/
    connectionCapacity: 600,
  },
  explodeDirection: null,
  defaultSpeciesId: 'red_oak',
}

registerComponent(PULLUP_BAR_DEFINITION)
