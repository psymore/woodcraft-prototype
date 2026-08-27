import type { ComponentInstance, Connection } from './types'
import { getConnectionPoints, toWorldPoint } from './connectionPoints'

// Whether a persisted Connection's two anchor points are still within
// `threshold` of each other in world space — used to decide whether a
// connection survives after either of its pieces moves.
export function isConnectionCoincident(
  connection: Connection,
  instances: ComponentInstance[],
  threshold: number,
): boolean {
  const pieceA = instances.find((i) => i.id === connection.pieceAId)
  const pieceB = instances.find((i) => i.id === connection.pieceBId)
  if (!pieceA || !pieceB) return false

  const localA = getConnectionPoints(pieceA)[connection.pointAIndex]
  const localB = getConnectionPoints(pieceB)[connection.pointBIndex]
  if (!localA || !localB) return false

  const worldA = toWorldPoint(pieceA, localA)
  const worldB = toWorldPoint(pieceB, localB)
  const dx = worldB[0] - worldA[0]
  const dy = worldB[1] - worldA[1]
  const dz = worldB[2] - worldA[2]
  return Math.sqrt(dx * dx + dy * dy + dz * dz) <= threshold
}
