import type { AnchorRef, ComponentInstance, Connection } from './types'
import { getAnchors, toWorldAnchor, closestBetweenWorldAnchors, pointAtParam } from './connectionPoints'

// The 4 fields both a persisted Connection and an unconfirmed
// ConnectionCandidate share — lets this function (and sceneSessionStore's
// confirmConnection) accept either without requiring a Connection's `id`.
type ConnectionLike = Pick<Connection, 'pieceAId' | 'pieceBId' | 'a' | 'b'>

// Whether a persisted Connection's two anchors are still within
// `threshold` of each other in world space — used to decide whether a
// connection survives after either of its pieces moves. Evaluated at
// each side's stored `param` (re-clamped against that anchor's CURRENT
// extents) — so if changeDimensions shrinks a piece's face out from
// under a stored contact point, this naturally returns false with no
// special-case staleness code.
export function isConnectionCoincident(
  connection: ConnectionLike,
  instances: ComponentInstance[],
  threshold: number,
): boolean {
  const pieceA = instances.find((i) => i.id === connection.pieceAId)
  const pieceB = instances.find((i) => i.id === connection.pieceBId)
  if (!pieceA || !pieceB) return false

  const anchorA = getAnchors(pieceA)[connection.a.anchorIndex]
  const anchorB = getAnchors(pieceB)[connection.b.anchorIndex]
  if (!anchorA || !anchorB) return false

  const worldA = toWorldAnchor(pieceA, anchorA)
  const worldB = toWorldAnchor(pieceB, anchorB)
  const pointA = pointAtParam(worldA, connection.a.param)
  const pointB = pointAtParam(worldB, connection.b.param)
  const dx = pointB[0] - pointA[0]
  const dy = pointB[1] - pointA[1]
  const dz = pointB[2] - pointA[2]
  // Deliberately <=, not <: creation uses a strict `<` so exact ties
  // don't matter there, but survival should err toward keeping a
  // connection at the exact boundary rather than flickering it in and
  // out — the two thresholds are allowed to differ.
  return Math.sqrt(dx * dx + dy * dy + dz * dz) <= threshold
}

// Drops any connection whose two anchors are no longer within `threshold`
// of each other — used after any action that can move a piece's anchors
// (dragging, rotating, resizing, standing up). Returns the original array
// reference when nothing was pruned, so callers that spread this into a
// new state object don't force an unnecessary re-render when nothing
// actually changed.
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
// Unaffected by the anchor-primitive generalization: this only ever
// reads pieceAId/pieceBId, never anchor geometry.
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

// Whether a given anchor on a piece is "claimable" — i.e. should ever be
// added to a claimed/exclude set. Only point-kind anchors are: a board's
// own end can only ever touch one thing, but a segment/face anchor is an
// inherently multi-occupancy surface (e.g. several joists resting on one
// beam) and is never marked claimed. Shared by findConnectionCandidates
// below and sceneSessionStore.ts's movePiece/confirmConnection, so the
// two never drift apart on this rule.
export function isAnchorClaimable(instances: ComponentInstance[], pieceId: string, anchorIndex: number): boolean {
  const piece = instances.find((i) => i.id === pieceId)
  if (!piece) return false
  return getAnchors(piece)[anchorIndex]?.kind === 'point'
}

export type ConnectionCandidate = Omit<Connection, 'id'>

// Scene-wide version of connectionPoints.ts's findClosestConnectionMatch
// (which is anchored to one "moving" piece): finds every pair of
// currently-available, compatible anchors within `threshold` of each
// other, anywhere in the scene. "Available" means not claimed by an
// existing connection (point-kind anchors only — see isAnchorClaimable);
// segment/face anchors are always available, so a face can host several
// simultaneous candidates. Among point-kind anchors, "closest pairing
// wins" still applies within a single call: if a free point is in range
// of two others, only the closer pairing becomes a candidate, leaving
// the point on the losing side free to pair with something else.
export function findConnectionCandidates(
  instances: ComponentInstance[],
  connections: Connection[],
  threshold: number,
): ConnectionCandidate[] {
  const claimed = new Set<string>()
  for (const c of connections) {
    if (isAnchorClaimable(instances, c.pieceAId, c.a.anchorIndex)) claimed.add(`${c.pieceAId}:${c.a.anchorIndex}`)
    if (isAnchorClaimable(instances, c.pieceBId, c.b.anchorIndex)) claimed.add(`${c.pieceBId}:${c.b.anchorIndex}`)
  }
  const isClaimed = (pieceId: string, anchorIndex: number) => claimed.has(`${pieceId}:${anchorIndex}`)

  interface Pair {
    pieceAId: string
    pieceBId: string
    a: AnchorRef
    b: AnchorRef
    distance: number
  }
  const allPairs: Pair[] = []

  for (let a = 0; a < instances.length; a++) {
    const pieceA = instances[a]
    const anchorsA = getAnchors(pieceA)
    for (let b = a + 1; b < instances.length; b++) {
      const pieceB = instances[b]
      const anchorsB = getAnchors(pieceB)
      for (let aIndex = 0; aIndex < anchorsA.length; aIndex++) {
        if (isClaimed(pieceA.id, aIndex)) continue
        const worldA = toWorldAnchor(pieceA, anchorsA[aIndex])
        for (let bIndex = 0; bIndex < anchorsB.length; bIndex++) {
          if (isClaimed(pieceB.id, bIndex)) continue
          const anchorB = anchorsB[bIndex]
          if (worldA.kind !== 'point' && anchorB.kind !== 'point') continue
          const worldB = toWorldAnchor(pieceB, anchorB)
          const match = closestBetweenWorldAnchors(worldA, worldB)
          if (match.distance < threshold) {
            allPairs.push({
              pieceAId: pieceA.id,
              pieceBId: pieceB.id,
              a: { anchorIndex: aIndex, param: match.paramA },
              b: { anchorIndex: bIndex, param: match.paramB },
              distance: match.distance,
            })
          }
        }
      }
    }
  }

  allPairs.sort((x, y) => x.distance - y.distance)
  const used = new Set<string>()
  const candidates: ConnectionCandidate[] = []
  for (const pair of allPairs) {
    const aClaimable = isAnchorClaimable(instances, pair.pieceAId, pair.a.anchorIndex)
    const bClaimable = isAnchorClaimable(instances, pair.pieceBId, pair.b.anchorIndex)
    const keyA = `${pair.pieceAId}:${pair.a.anchorIndex}`
    const keyB = `${pair.pieceBId}:${pair.b.anchorIndex}`
    if ((aClaimable && used.has(keyA)) || (bClaimable && used.has(keyB))) continue
    if (aClaimable) used.add(keyA)
    if (bClaimable) used.add(keyB)
    candidates.push({ pieceAId: pair.pieceAId, pieceBId: pair.pieceBId, a: pair.a, b: pair.b })
  }

  return candidates
}
