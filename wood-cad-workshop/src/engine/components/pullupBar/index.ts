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
    // 98.6 MPa (14,300 psi) — red oak, static bending MOR, dry (12% MC).
    // USDA Forest Products Laboratory, Wood Handbook, Ch. 5, Table 5-3a:
    // https://www.fpl.fs.usda.gov/documnts/fplgtr/fplgtr190/chapter_05.pdf
    bendingStrength: 98_600_000,
    // ≈600N (135 lbf) — average breaking load of a doweled SPRUCE joint
    // (deliberately a different, weaker species than the bar's own
    // bendingStrength above — see the structural-check spec's
    // 2026-09-05 amendment for why), the weakest clean-break joint type
    // tested. woodgears.ca joint-strength tests:
    // https://woodgears.ca/joint_strength/
    connectionCapacity: 600,
  },
  explodeDirection: null,
}

registerComponent(PULLUP_BAR_DEFINITION)
