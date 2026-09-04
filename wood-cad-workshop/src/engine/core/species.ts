export interface SpeciesDefinition {
  id: string
  name: string
  color: string // hex — drives ComponentInstance.material when selected
  bendingStrength: number // MOR, in Pa
  sourceLabel: string // used verbatim as the Inspector citation text
  sourceUrl: string
}

// USDA Forest Products Laboratory, Wood Handbook, Chapter 5, Table
// 5-3a — static bending MOR, dry (12% MC) condition. All 6 species
// below cite this same table.
const WOOD_HANDBOOK_URL = 'https://www.fpl.fs.usda.gov/documnts/fplgtr/fplgtr190/chapter_05.pdf'

export const SPECIES_LIST: SpeciesDefinition[] = [
  {
    id: 'red_oak',
    name: 'Red Oak',
    color: '#a6693f',
    bendingStrength: 98_600_000, // 98.6 MPa / 14,300 psi
    sourceLabel: 'red oak, USDA Wood Handbook',
    sourceUrl: WOOD_HANDBOOK_URL,
  },
  {
    id: 'white_oak',
    name: 'White Oak',
    color: '#b58a5c',
    bendingStrength: 105_000_000, // 105 MPa
    sourceLabel: 'white oak, USDA Wood Handbook',
    sourceUrl: WOOD_HANDBOOK_URL,
  },
  {
    id: 'sugar_maple',
    name: 'Sugar Maple',
    color: '#d8c39a',
    bendingStrength: 109_000_000, // 109 MPa
    sourceLabel: 'sugar maple, USDA Wood Handbook',
    sourceUrl: WOOD_HANDBOOK_URL,
  },
  {
    id: 'yellow_birch',
    name: 'Yellow Birch',
    color: '#c9a273',
    bendingStrength: 114_000_000, // 114 MPa
    sourceLabel: 'yellow birch, USDA Wood Handbook',
    sourceUrl: WOOD_HANDBOOK_URL,
  },
  {
    id: 'douglas_fir',
    name: 'Douglas Fir',
    color: '#c19a6b',
    bendingStrength: 85_000_000, // 85 MPa
    sourceLabel: 'Douglas fir, USDA Wood Handbook',
    sourceUrl: WOOD_HANDBOOK_URL,
  },
  {
    id: 'longleaf_pine',
    name: 'Longleaf Pine',
    color: '#e0b98d',
    bendingStrength: 100_000_000, // 100 MPa
    sourceLabel: 'longleaf pine, USDA Wood Handbook',
    sourceUrl: WOOD_HANDBOOK_URL,
  },
]

export function getSpecies(id: string | undefined): SpeciesDefinition | undefined {
  if (id === undefined) return undefined
  return SPECIES_LIST.find((s) => s.id === id)
}
