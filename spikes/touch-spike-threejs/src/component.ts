export type ComponentCategory = 'WOOD' | 'HARDWARE' | 'FASTENER'

export type GeometryDescriptor = { shape: 'box' } | { shape: 'cylinder' }

export type Dimensions = Record<string, number>

// 'ends': two attach points at the piece's local Z extremes (rods, beams,
// boards — everything lies flat, so "ends" means the two lengthwise tips).
// 'single': one attach point at the piece's own center (small parts that
// dock onto another piece's end, e.g. a foot or bracket).
export type ConnectionRole = 'ends' | 'single' | 'none'

export interface ComponentDefinition {
  id: string
  name: string
  category: ComponentCategory
  geometry: GeometryDescriptor
  defaultDimensions: Dimensions
  material: string
  connectionRole: ConnectionRole
  structuralProperties: Record<string, never>
  explodeDirection: null
}

export interface ComponentInstance {
  id: string
  componentDefinitionId: string
  position: [number, number, number]
  rotation: [number, number, number]
  dimensions: Dimensions
  material: string
}

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
}

export const ROUND_ROD_DEFINITION: ComponentDefinition = {
  id: 'round_rod',
  name: 'Round Rod',
  category: 'WOOD',
  geometry: { shape: 'cylinder' },
  defaultDimensions: { diameter: 1, length: 36 },
  material: '#c9a273',
  connectionRole: 'ends',
  structuralProperties: {},
  explodeDirection: null,
}

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
}

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

export const WOOD_SCREW_DEFINITION: ComponentDefinition = {
  id: 'wood_screw',
  name: 'Wood Screw',
  category: 'FASTENER',
  geometry: { shape: 'cylinder' },
  defaultDimensions: { diameter: 0.15, length: 1.5 },
  material: '#555555',
  connectionRole: 'none',
  structuralProperties: {},
  explodeDirection: null,
}

export const PULLUP_BAR_DEFINITION: ComponentDefinition = {
  id: 'pullup_bar',
  name: 'Pull-up Bar',
  category: 'WOOD',
  geometry: { shape: 'cylinder' },
  defaultDimensions: { diameter: 1.25, length: 48 },
  material: '#a6693f',
  connectionRole: 'ends',
  structuralProperties: {},
  explodeDirection: null,
}

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
}

export const COMPONENT_LIBRARY: ComponentDefinition[] = [
  BOARD_DEFINITION,
  ROUND_ROD_DEFINITION,
  SQUARE_BEAM_DEFINITION,
  L_BRACKET_DEFINITION,
  WOOD_SCREW_DEFINITION,
  PULLUP_BAR_DEFINITION,
  VERTICAL_POST_DEFINITION,
  FOOT_DEFINITION,
]

export const PULLUP_KIT_DEFINITIONS: ComponentDefinition[] = [
  PULLUP_BAR_DEFINITION,
  VERTICAL_POST_DEFINITION,
  VERTICAL_POST_DEFINITION,
  FOOT_DEFINITION,
  FOOT_DEFINITION,
]

export function getDefinition(componentDefinitionId: string): ComponentDefinition {
  const found = COMPONENT_LIBRARY.find((def) => def.id === componentDefinitionId)
  if (!found) throw new Error(`Unknown component definition: ${componentDefinitionId}`)
  return found
}

export const INITIAL_BOARD_INSTANCES: ComponentInstance[] = [
  {
    id: 'board-a',
    componentDefinitionId: 'board',
    position: [-6, 1.75, 0],
    rotation: [0, 0, 0],
    dimensions: { thickness: 1.5, width: 3.5, length: 48 },
    material: '#a6693f',
  },
  {
    id: 'board-b',
    componentDefinitionId: 'board',
    position: [6, 1.75, 0],
    rotation: [0, 0, 0],
    dimensions: { thickness: 1.5, width: 3.5, length: 36 },
    material: '#8c5730',
  },
]

export function getBoxSize(instance: ComponentInstance): [number, number, number] {
  const { thickness, width, length } = instance.dimensions
  return [thickness, width, length]
}

export function getCylinderSize(instance: ComponentInstance): { radius: number; height: number } {
  const { diameter, length } = instance.dimensions
  return { radius: diameter / 2, height: length }
}

// Half-height for a component resting on the ground grid (y=0), so its
// bottom face sits at y=0 regardless of geometry shape.
export function getRestingHeight(definition: ComponentDefinition): number {
  const { width, diameter } = definition.defaultDimensions
  return definition.geometry.shape === 'cylinder' ? diameter / 2 : width / 2
}

let spawnCounter = 0

// Local-space attach points for this piece's shape, before its position/
// rotation are applied. See ConnectionRole above for what each role means.
export function getConnectionPoints(instance: ComponentInstance): [number, number, number][] {
  const definition = getDefinition(instance.componentDefinitionId)
  const { length } = instance.dimensions
  switch (definition.connectionRole) {
    case 'ends':
      return [
        [0, 0, -length / 2],
        [0, 0, length / 2],
      ]
    case 'single':
      return [[0, 0, 0]]
    default:
      return []
  }
}

export function toWorldPoint(
  instance: ComponentInstance,
  local: [number, number, number],
): [number, number, number] {
  const [lx, ly, lz] = local
  const yaw = instance.rotation[1]
  const cos = Math.cos(yaw)
  const sin = Math.sin(yaw)
  return [
    instance.position[0] + lx * cos + lz * sin,
    instance.position[1] + ly,
    instance.position[2] - lx * sin + lz * cos,
  ]
}

export function createInstance(definition: ComponentDefinition): ComponentInstance {
  spawnCounter += 1
  const spawnX = ((spawnCounter % 5) - 2) * 4
  const spawnZ = Math.floor(spawnCounter / 5) * 4
  return {
    id: `${definition.id}-${Date.now()}-${spawnCounter}`,
    componentDefinitionId: definition.id,
    position: [spawnX, getRestingHeight(definition), spawnZ],
    rotation: [0, 0, 0],
    dimensions: { ...definition.defaultDimensions },
    material: definition.material,
  }
}
