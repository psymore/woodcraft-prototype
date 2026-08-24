import type { ComponentInstance } from './types'

const EXPLODE_DISTANCE = 10

export function computeCentroid(instances: ComponentInstance[]): [number, number, number] {
  if (instances.length === 0) return [0, 0, 0]
  const sum = instances.reduce(
    (acc, i): [number, number, number] => [
      acc[0] + i.position[0],
      acc[1] + i.position[1],
      acc[2] + i.position[2],
    ],
    [0, 0, 0],
  )
  return [sum[0] / instances.length, sum[1] / instances.length, sum[2] / instances.length]
}

// Radial offset from the assembly centroid, scaled by `amount` (0-1). Used
// as a display-only transform — the piece's real, stored position never
// changes, so returning to amount=0 restores the layout exactly.
export function getExplodedPosition(
  position: [number, number, number],
  centroid: [number, number, number],
  amount: number,
): [number, number, number] {
  if (amount <= 0) return position
  const dx = position[0] - centroid[0]
  const dy = position[1] - centroid[1]
  const dz = position[2] - centroid[2]
  const len = Math.sqrt(dx * dx + dy * dy + dz * dz) || 1
  return [
    position[0] + (dx / len) * amount * EXPLODE_DISTANCE,
    position[1] + (dy / len) * amount * EXPLODE_DISTANCE,
    position[2] + (dz / len) * amount * EXPLODE_DISTANCE,
  ]
}
