export type ComponentCategory = 'WOOD' | 'HARDWARE' | 'FASTENER'

export type GeometryDescriptor = { shape: 'box' } | { shape: 'cylinder' }

export type Dimensions = Record<string, number>

export interface ComponentDefinition {
  id: string
  name: string
  category: ComponentCategory
  geometry: GeometryDescriptor
  defaultDimensions: Dimensions
  material: string
  connectionPoints: unknown[]
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
  connectionPoints: [],
  structuralProperties: {},
  explodeDirection: null,
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
