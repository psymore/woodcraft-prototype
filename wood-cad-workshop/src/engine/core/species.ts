export interface SpeciesTextureSet {
  color: string
  normal: string
  roughness: string
}

export interface SpeciesDefinition {
  id: string
  name: string
  color: string // hex — drives ComponentInstance.material when selected
  bendingStrength: number // MOR, in Pa
  sourceLabel: string // used verbatim as the Inspector citation text
  sourceUrl: string
  // PBR photo texture set (CC0, ambientCG — see textureSourceUrl below) for
  // Piece.tsx's meshStandardMaterial. `color` above stays the fallback for
  // any species that doesn't get one, and is what tints the map on
  // selection (see Piece.tsx's `hasWoodTexture` color logic).
  textures: SpeciesTextureSet
}

// Photo texture sets in public/textures/wood/<speciesId>/, sourced from
// ambientcg.com (CC0, no attribution required) and picked by visual/color
// match to the species — not a claim that, say, red_oak's set was
// photographed from an actual red oak board. See that folder's source
// asset ids (Wood049 etc.) if a closer match turns up later.
function textureSet(speciesId: string): SpeciesTextureSet {
  return {
    color: `/textures/wood/${speciesId}/color.jpg`,
    normal: `/textures/wood/${speciesId}/normal.jpg`,
    roughness: `/textures/wood/${speciesId}/roughness.jpg`,
  }
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
    textures: textureSet('red_oak'),
  },
  {
    id: 'white_oak',
    name: 'White Oak',
    color: '#b58a5c',
    bendingStrength: 105_000_000, // 105 MPa
    sourceLabel: 'white oak, USDA Wood Handbook',
    sourceUrl: WOOD_HANDBOOK_URL,
    textures: textureSet('white_oak'),
  },
  {
    id: 'sugar_maple',
    name: 'Sugar Maple',
    color: '#d8c39a',
    bendingStrength: 109_000_000, // 109 MPa
    sourceLabel: 'sugar maple, USDA Wood Handbook',
    sourceUrl: WOOD_HANDBOOK_URL,
    textures: textureSet('sugar_maple'),
  },
  {
    id: 'yellow_birch',
    name: 'Yellow Birch',
    color: '#c9a273',
    bendingStrength: 114_000_000, // 114 MPa
    sourceLabel: 'yellow birch, USDA Wood Handbook',
    sourceUrl: WOOD_HANDBOOK_URL,
    textures: textureSet('yellow_birch'),
  },
  {
    id: 'douglas_fir',
    name: 'Douglas Fir',
    color: '#c19a6b',
    bendingStrength: 85_000_000, // 85 MPa
    sourceLabel: 'Douglas fir, USDA Wood Handbook',
    sourceUrl: WOOD_HANDBOOK_URL,
    textures: textureSet('douglas_fir'),
  },
  {
    id: 'longleaf_pine',
    name: 'Longleaf Pine',
    color: '#e0b98d',
    bendingStrength: 100_000_000, // 100 MPa
    sourceLabel: 'longleaf pine, USDA Wood Handbook',
    sourceUrl: WOOD_HANDBOOK_URL,
    textures: textureSet('longleaf_pine'),
  },
]

export function getSpecies(id: string | undefined): SpeciesDefinition | undefined {
  if (id === undefined) return undefined
  return SPECIES_LIST.find((s) => s.id === id)
}
