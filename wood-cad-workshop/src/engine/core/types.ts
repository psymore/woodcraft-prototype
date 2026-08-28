export type ComponentCategory = 'WOOD' | 'HARDWARE' | 'FASTENER'

export type GeometryDescriptor = { shape: 'box' } | { shape: 'cylinder' }

export type Vec3 = [number, number, number]

export type Dimensions = Record<string, number>

// 'ends': two attach points at the piece's local Z extremes (rods, beams,
// boards — everything lies flat, so "ends" means the two lengthwise tips).
// 'single': one attach point at the piece's own center (small parts that
// dock onto another piece's end, e.g. a foot or bracket).
export type ConnectionRole = 'ends' | 'single' | 'none'

export interface StructuralProperties {
  bendingStrength?: number // MOR (modulus of rupture), in Pa — nominal bending strength used by the structural check
}

export interface ComponentDefinition {
  id: string
  name: string
  category: ComponentCategory
  geometry: GeometryDescriptor
  defaultDimensions: Dimensions
  material: string
  connectionRole: ConnectionRole
  structuralProperties: StructuralProperties
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

export interface Connection {
  id: string
  pieceAId: string
  pieceBId: string
  pointAIndex: number // index into getConnectionPoints(pieceA)
  pointBIndex: number // index into getConnectionPoints(pieceB)
}
