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
  // Deliberately <=, not <: creation (findClosestConnectionMatch) uses a
  // strict `<` so exact ties don't matter there, but survival should err
  // toward keeping a connection at the exact boundary rather than
  // flickering it in and out — the two thresholds are allowed to differ.
  return Math.sqrt(dx * dx + dy * dy + dz * dz) <= threshold
}

// Drops any connection whose two anchor points are no longer within
// `threshold` of each other — used after any action that can move a
// piece's connection points (dragging, rotating, resizing, standing up).
// Returns the original array reference when nothing was pruned, so
// callers that spread this into a new state object don't force an
// unnecessary re-render when nothing actually changed.
export function pruneStaleConnections(
  instances: ComponentInstance[],
  connections: Connection[],
  threshold: number,
): Connection[] {
  const surviving = connections.filter((c) => isConnectionCoincident(c, instances, threshold))
  return surviving.length === connections.length ? connections : surviving
}
