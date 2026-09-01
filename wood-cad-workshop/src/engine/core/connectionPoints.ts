import type { ComponentInstance, Vec3 } from './types'
import { getComponent } from '../registry/registry'
import { applyRotation, closestPointOnSegment, closestPointOnRect, distance } from './geometry'

export const SNAP_DISTANCE = 0.7

export type AnchorPrimitive =
  | { kind: 'point'; point: Vec3 }
  | { kind: 'segment'; a: Vec3; b: Vec3 }
  | { kind: 'face'; center: Vec3; uAxis: Vec3; vAxis: Vec3; halfU: number; halfV: number }

// World-space anchors have the exact same shape as local-space ones —
// only the coordinate values differ (translated/rotated).
export type WorldAnchor = AnchorPrimitive

// Local-space attach primitives for this piece's shape, before its
// position/rotation are applied. See ConnectionRole (core/types.ts) for
// what each role means.
//
// Box 'ends' pieces (board, squareBeam, verticalPost — decided
// structurally by geometry.shape === 'box', not a hardcoded component
// list) get, in order: the 2 existing end points (indices 0/1,
// unchanged); 2 new discrete edge-center points (indices 2/3 — new to
// this branch, not a pre-existing carryover) — needed because
// segment-segment matching isn't supported this increment, so two
// boards' edges can only glue via a point-vs-point or point-vs-segment
// path, and every box piece needs to offer a point at its own edge
// center for that to work symmetrically; 2 segment anchors (indices
// 4/5) — despite the "edge" framing elsewhere, these are NOT true box
// edges (a true edge is where two faces meet, e.g. x=±hx AND y=±hy
// simultaneously); each instead runs down the centerline of its sibling
// face anchor at the same y (x=0, the thickness midpoint), so it's
// geometrically dominated by that face and rarely wins a match — a
// known limitation, deferred to a follow-up plan; 4 face anchors
// (indices 6-9, all four side faces): indices 6/7 are normal to the
// Y/width axis (center: [0, ±hy, 0]) and measure thickness × length —
// the narrow faces; indices 8/9 are normal to the X/thickness axis
// (center: [±hx, 0, 0]) and measure width × length — the wide faces.
export function getAnchors(instance: ComponentInstance): AnchorPrimitive[] {
  const definition = getComponent(instance.componentDefinitionId)
  const { length } = instance.dimensions
  switch (definition.connectionRole) {
    case 'ends': {
      const hz = length / 2
      const anchors: AnchorPrimitive[] = [
        { kind: 'point', point: [0, 0, -hz] },
        { kind: 'point', point: [0, 0, hz] },
      ]
      if (definition.geometry.shape === 'box') {
        const { thickness, width } = instance.dimensions
        const hx = thickness / 2
        const hy = width / 2
        anchors.push(
          { kind: 'point', point: [0, -hy, 0] },
          { kind: 'point', point: [0, hy, 0] },
          { kind: 'segment', a: [0, -hy, -hz], b: [0, -hy, hz] },
          { kind: 'segment', a: [0, hy, -hz], b: [0, hy, hz] },
          { kind: 'face', center: [0, -hy, 0], uAxis: [1, 0, 0], vAxis: [0, 0, 1], halfU: hx, halfV: hz },
          { kind: 'face', center: [0, hy, 0], uAxis: [1, 0, 0], vAxis: [0, 0, 1], halfU: hx, halfV: hz },
          { kind: 'face', center: [-hx, 0, 0], uAxis: [0, 1, 0], vAxis: [0, 0, 1], halfU: hy, halfV: hz },
          { kind: 'face', center: [hx, 0, 0], uAxis: [0, 1, 0], vAxis: [0, 0, 1], halfU: hy, halfV: hz },
        )
      }
      return anchors
    }
    case 'single':
      return [{ kind: 'point', point: [0, 0, 0] }]
    default:
      return []
  }
}

function toWorldPoint(instance: ComponentInstance, local: Vec3): Vec3 {
  const r = applyRotation(instance.rotation, local)
  return [instance.position[0] + r[0], instance.position[1] + r[1], instance.position[2] + r[2]]
}

// Transforms a local-space anchor primitive into world space using the
// piece's current position/rotation. Points and segment/face origins
// translate + rotate; segment/face in-plane axes rotate only (they're
// directions, not positions).
export function toWorldAnchor(instance: ComponentInstance, anchor: AnchorPrimitive): WorldAnchor {
  switch (anchor.kind) {
    case 'point':
      return { kind: 'point', point: toWorldPoint(instance, anchor.point) }
    case 'segment':
      return { kind: 'segment', a: toWorldPoint(instance, anchor.a), b: toWorldPoint(instance, anchor.b) }
    case 'face':
      return {
        kind: 'face',
        center: toWorldPoint(instance, anchor.center),
        uAxis: applyRotation(instance.rotation, anchor.uAxis),
        vAxis: applyRotation(instance.rotation, anchor.vAxis),
        halfU: anchor.halfU,
        halfV: anchor.halfV,
      }
  }
}

// The material (piece-relative), not world, coordinate a Connection
// pins for a segment/face anchor — locked in once at confirm time, never
// re-derived. undefined for a point-kind anchor (which has nothing to
// parameterize).
export type AnchorParam = { t: number } | { u: number; v: number }

// Evaluates a world-space anchor at a stored param (re-clamped against
// the anchor's CURRENT extents — see isConnectionCoincident in
// connections.ts for why this doubles as a staleness detector for face
// params). Defaults to the anchor's own center/midpoint when no param is
// given (point anchors always ignore param; this only matters if a
// segment/face anchor is ever evaluated without one, which callers in
// this codebase never do).
export function pointAtParam(anchor: WorldAnchor, param?: AnchorParam): Vec3 {
  if (anchor.kind === 'point') return anchor.point
  if (anchor.kind === 'segment') {
    const t = Math.max(0, Math.min(1, param && 't' in param ? param.t : 0.5))
    return [anchor.a[0] + (anchor.b[0] - anchor.a[0]) * t, anchor.a[1] + (anchor.b[1] - anchor.a[1]) * t, anchor.a[2] + (anchor.b[2] - anchor.a[2]) * t]
  }
  const rawU = param && 'u' in param ? param.u : 0
  const rawV = param && 'v' in param ? param.v : 0
  const u = Math.max(-anchor.halfU, Math.min(anchor.halfU, rawU))
  const v = Math.max(-anchor.halfV, Math.min(anchor.halfV, rawV))
  return [
    anchor.center[0] + anchor.uAxis[0] * u + anchor.vAxis[0] * v,
    anchor.center[1] + anchor.uAxis[1] * u + anchor.vAxis[1] * v,
    anchor.center[2] + anchor.uAxis[2] * u + anchor.vAxis[2] * v,
  ]
}

export interface AnchorMatch {
  distance: number
  pointA: Vec3 // closest-approach point ON A's anchor, world space
  pointB: Vec3 // closest-approach point ON B's anchor, world space
  paramA?: AnchorParam // set iff A is segment/face
  paramB?: AnchorParam // set iff B is segment/face
}

// Closest-approach distance and points between two world-space anchors.
// point-point, point-segment, point-face (and their mirror images) are
// supported. segment-segment and face-face are NOT implemented this
// increment (see the design doc) — this throws rather than silently
// returning null or a wrong result, so a future anchor kind combination
// can't slip through unhandled. Callers must filter out
// non-point/non-point pairs before calling (see findClosestConnectionMatch
// and connections.ts's findConnectionCandidates for the filter).
export function closestBetweenWorldAnchors(a: WorldAnchor, b: WorldAnchor): AnchorMatch {
  if (a.kind === 'point' && b.kind === 'point') {
    return { distance: distance(a.point, b.point), pointA: a.point, pointB: b.point }
  }
  if (a.kind === 'point' && b.kind === 'segment') {
    const { point, t } = closestPointOnSegment(a.point, b.a, b.b)
    return { distance: distance(a.point, point), pointA: a.point, pointB: point, paramB: { t } }
  }
  if (a.kind === 'segment' && b.kind === 'point') {
    const { point, t } = closestPointOnSegment(b.point, a.a, a.b)
    return { distance: distance(point, b.point), pointA: point, pointB: b.point, paramA: { t } }
  }
  if (a.kind === 'point' && b.kind === 'face') {
    const { point, u, v } = closestPointOnRect(a.point, b.center, b.uAxis, b.vAxis, b.halfU, b.halfV)
    return { distance: distance(a.point, point), pointA: a.point, pointB: point, paramB: { u, v } }
  }
  if (a.kind === 'face' && b.kind === 'point') {
    const { point, u, v } = closestPointOnRect(b.point, a.center, a.uAxis, a.vAxis, a.halfU, a.halfV)
    return { distance: distance(point, b.point), pointA: point, pointB: b.point, paramA: { u, v } }
  }
  throw new Error(`closestBetweenWorldAnchors: unsupported anchor kind pair (${a.kind}, ${b.kind})`)
}

export interface ConnectionMatch {
  otherId: string
  movingAnchorIndex: number
  otherAnchorIndex: number
  delta: Vec3
  movingParam?: AnchorParam
  otherParam?: AnchorParam
}

// Given a piece mid-drag at `proposedPosition`, checks whether any of its
// anchors land close to another piece's anchor, and reports exactly which
// anchors matched (not just the resulting delta) so a caller can turn a
// match into a persisted Connection (see engine/core/connections.ts).
// `excludeAnchors` skips anchors already claimed by an existing
// connection (callers are expected to only ever pass point-kind anchor
// refs here — segment/face anchors are never claimed, see the design
// doc). Pairs where neither anchor is point-kind are skipped, since
// segment-segment/face-face matching isn't supported this increment.
export function findClosestConnectionMatch(
  movingInstance: ComponentInstance,
  proposedPosition: Vec3,
  allInstances: ComponentInstance[],
  excludeAnchors: { pieceId: string; anchorIndex: number }[] = [],
): ConnectionMatch | null {
  const isExcluded = (pieceId: string, anchorIndex: number) =>
    excludeAnchors.some((p) => p.pieceId === pieceId && p.anchorIndex === anchorIndex)

  const proposedInstance: ComponentInstance = { ...movingInstance, position: proposedPosition }
  const movingAnchors = getAnchors(proposedInstance)
  if (movingAnchors.length === 0) return null

  let best: (ConnectionMatch & { distance: number }) | null = null

  for (const other of allInstances) {
    if (other.id === movingInstance.id) continue
    const otherAnchors = getAnchors(other)
    if (otherAnchors.length === 0) continue

    for (let movingAnchorIndex = 0; movingAnchorIndex < movingAnchors.length; movingAnchorIndex++) {
      if (isExcluded(movingInstance.id, movingAnchorIndex)) continue
      const movingAnchor = movingAnchors[movingAnchorIndex]
      const worldMoving = toWorldAnchor(proposedInstance, movingAnchor)
      for (let otherAnchorIndex = 0; otherAnchorIndex < otherAnchors.length; otherAnchorIndex++) {
        if (isExcluded(other.id, otherAnchorIndex)) continue
        const otherAnchor = otherAnchors[otherAnchorIndex]
        if (movingAnchor.kind !== 'point' && otherAnchor.kind !== 'point') continue
        const worldOther = toWorldAnchor(other, otherAnchor)
        const match = closestBetweenWorldAnchors(worldMoving, worldOther)
        if (match.distance < SNAP_DISTANCE && (!best || match.distance < best.distance)) {
          best = {
            distance: match.distance,
            otherId: other.id,
            movingAnchorIndex,
            otherAnchorIndex,
            delta: [
              match.pointB[0] - match.pointA[0],
              match.pointB[1] - match.pointA[1],
              match.pointB[2] - match.pointA[2],
            ],
            movingParam: match.paramA,
            otherParam: match.paramB,
          }
        }
      }
    }
  }

  if (!best) return null
  return {
    otherId: best.otherId,
    movingAnchorIndex: best.movingAnchorIndex,
    otherAnchorIndex: best.otherAnchorIndex,
    delta: best.delta,
    movingParam: best.movingParam,
    otherParam: best.otherParam,
  }
}
