import type { ComponentInstance, Connection } from './types'
import { getConnectionPoints, toWorldPoint } from './connectionPoints'

// The 4 fields both a persisted Connection and an unconfirmed
// ConnectionCandidate share — lets this function (and Task 2's
// confirmConnection) accept either without requiring a Connection's `id`.
type ConnectionLike = Pick<Connection, 'pieceAId' | 'pieceBId' | 'pointAIndex' | 'pointBIndex'>

// Whether a persisted Connection's two anchor points are still within
// `threshold` of each other in world space — used to decide whether a
// connection survives after either of its pieces moves.
export function isConnectionCoincident(
  connection: ConnectionLike,
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

// Breadth-first traversal of the connection graph (each Connection is an
// undirected edge between pieceAId and pieceBId), starting from pieceId.
// Returns the full connected component, including pieceId itself —
// visited-set-guarded so a cycle in the graph terminates normally.
export function getConnectedPieceIds(pieceId: string, connections: Connection[]): Set<string> {
  const visited = new Set<string>([pieceId])
  const queue = [pieceId]

  for (let head = 0; head < queue.length; head++) {
    const current = queue[head]
    for (const c of connections) {
      let neighbor: string | null = null
      if (c.pieceAId === current) neighbor = c.pieceBId
      else if (c.pieceBId === current) neighbor = c.pieceAId
      if (neighbor !== null && !visited.has(neighbor)) {
        visited.add(neighbor)
        queue.push(neighbor)
      }
    }
  }

  return visited
}

export interface ConnectionCandidate {
  pieceAId: string
  pieceBId: string
  pointAIndex: number
  pointBIndex: number
}

// Scene-wide version of connectionPoints.ts's findClosestConnectionMatch
// (which is anchored to one "moving" piece): finds every pair of
// currently-unclaimed, compatible connection points within `threshold`
// of each other, anywhere in the scene. Same "closest pairing wins, no
// point claimed by more than one candidate" rule — if a free point is in
// range of two others, only the closer pairing becomes a candidate,
// leaving the point on the losing side free to pair with something else.
export function findConnectionCandidates(
  instances: ComponentInstance[],
  connections: Connection[],
  threshold: number,
): ConnectionCandidate[] {
  const claimed = new Set(
    connections.flatMap((c) => [`${c.pieceAId}:${c.pointAIndex}`, `${c.pieceBId}:${c.pointBIndex}`]),
  )
  const isClaimed = (pieceId: string, pointIndex: number) => claimed.has(`${pieceId}:${pointIndex}`)

  const allPairs: (ConnectionCandidate & { distance: number })[] = []

  for (let a = 0; a < instances.length; a++) {
    const pieceA = instances[a]
    const pointsA = getConnectionPoints(pieceA)
    for (let b = a + 1; b < instances.length; b++) {
      const pieceB = instances[b]
      const pointsB = getConnectionPoints(pieceB)
      for (let pointAIndex = 0; pointAIndex < pointsA.length; pointAIndex++) {
        if (isClaimed(pieceA.id, pointAIndex)) continue
        const worldA = toWorldPoint(pieceA, pointsA[pointAIndex])
        for (let pointBIndex = 0; pointBIndex < pointsB.length; pointBIndex++) {
          if (isClaimed(pieceB.id, pointBIndex)) continue
          const worldB = toWorldPoint(pieceB, pointsB[pointBIndex])
          const dx = worldB[0] - worldA[0]
          const dy = worldB[1] - worldA[1]
          const dz = worldB[2] - worldA[2]
          const distance = Math.sqrt(dx * dx + dy * dy + dz * dz)
          if (distance < threshold) {
            allPairs.push({ pieceAId: pieceA.id, pieceBId: pieceB.id, pointAIndex, pointBIndex, distance })
          }
        }
      }
    }
  }

  allPairs.sort((x, y) => x.distance - y.distance)
  const used = new Set<string>()
  const candidates: ConnectionCandidate[] = []
  for (const pair of allPairs) {
    const keyA = `${pair.pieceAId}:${pair.pointAIndex}`
    const keyB = `${pair.pieceBId}:${pair.pointBIndex}`
    if (used.has(keyA) || used.has(keyB)) continue
    used.add(keyA)
    used.add(keyB)
    candidates.push({
      pieceAId: pair.pieceAId,
      pieceBId: pair.pieceBId,
      pointAIndex: pair.pointAIndex,
      pointBIndex: pair.pointBIndex,
    })
  }

  return candidates
}
