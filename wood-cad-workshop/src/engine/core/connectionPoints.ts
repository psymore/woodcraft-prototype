import type { ComponentInstance } from './types'
import { getComponent } from '../registry/registry'

export const SNAP_DISTANCE = 0.7

// Local-space attach points for this piece's shape, before its position/
// rotation are applied. See ConnectionRole (core/types.ts) for what each
// role means.
export function getConnectionPoints(instance: ComponentInstance): [number, number, number][] {
  const definition = getComponent(instance.componentDefinitionId)
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
  const [rx, ry, rz] = instance.rotation

  // Full 3-axis rotation matrix for three.js's default Euler order 'XYZ'
  // (matches THREE.Matrix4.makeRotationFromEuler exactly, so this stays in
  // sync with how Piece.tsx renders `instance.rotation`). Reduces to the
  // previous yaw-only formula when rx = rz = 0.
  const c1 = Math.cos(rx)
  const s1 = Math.sin(rx)
  const c2 = Math.cos(ry)
  const s2 = Math.sin(ry)
  const c3 = Math.cos(rz)
  const s3 = Math.sin(rz)

  const m11 = c2 * c3
  const m12 = -c2 * s3
  const m13 = s2
  const m21 = c1 * s3 + s1 * s2 * c3
  const m22 = c1 * c3 - s1 * s2 * s3
  const m23 = -s1 * c2
  const m31 = s1 * s3 - c1 * s2 * c3
  const m32 = s1 * c3 + c1 * s2 * s3
  const m33 = c1 * c2

  return [
    instance.position[0] + m11 * lx + m12 * ly + m13 * lz,
    instance.position[1] + m21 * lx + m22 * ly + m23 * lz,
    instance.position[2] + m31 * lx + m32 * ly + m33 * lz,
  ]
}

export interface ConnectionMatch {
  otherId: string
  movingPointIndex: number
  otherPointIndex: number
  delta: [number, number, number]
}

// Given a piece mid-drag at `proposedPosition`, checks whether any of its
// connection points land close to another piece's connection point, and
// reports exactly which points matched (not just the resulting delta) so a
// caller can turn a match into a persisted Connection (see
// engine/core/connections.ts). `excludePoints` skips points already
// claimed by an existing connection — one physical end can only be joined
// to one other piece at a time.
export function findClosestConnectionMatch(
  movingInstance: ComponentInstance,
  proposedPosition: [number, number, number],
  allInstances: ComponentInstance[],
  excludePoints: { pieceId: string; pointIndex: number }[] = [],
): ConnectionMatch | null {
  const isExcluded = (pieceId: string, pointIndex: number) =>
    excludePoints.some((p) => p.pieceId === pieceId && p.pointIndex === pointIndex)

  const proposedInstance: ComponentInstance = { ...movingInstance, position: proposedPosition }
  const movingPointsLocal = getConnectionPoints(proposedInstance)
  if (movingPointsLocal.length === 0) return null

  let best: (ConnectionMatch & { distance: number }) | null = null

  for (const other of allInstances) {
    if (other.id === movingInstance.id) continue
    const otherPointsLocal = getConnectionPoints(other)
    if (otherPointsLocal.length === 0) continue

    for (let movingPointIndex = 0; movingPointIndex < movingPointsLocal.length; movingPointIndex++) {
      if (isExcluded(movingInstance.id, movingPointIndex)) continue
      const localA = movingPointsLocal[movingPointIndex]
      const worldA = toWorldPoint(proposedInstance, localA)
      for (let otherPointIndex = 0; otherPointIndex < otherPointsLocal.length; otherPointIndex++) {
        if (isExcluded(other.id, otherPointIndex)) continue
        const localB = otherPointsLocal[otherPointIndex]
        const worldB = toWorldPoint(other, localB)
        const dx = worldB[0] - worldA[0]
        const dy = worldB[1] - worldA[1]
        const dz = worldB[2] - worldA[2]
        const distance = Math.sqrt(dx * dx + dy * dy + dz * dz)
        if (distance < SNAP_DISTANCE && (!best || distance < best.distance)) {
          best = { distance, otherId: other.id, movingPointIndex, otherPointIndex, delta: [dx, dy, dz] }
        }
      }
    }
  }

  if (!best) return null
  return { otherId: best.otherId, movingPointIndex: best.movingPointIndex, otherPointIndex: best.otherPointIndex, delta: best.delta }
}

// Given a piece mid-drag at `proposedPosition`, returns the (dx,dy,dz)
// nudge that makes its closest connection point pair coincide exactly, or
// null if nothing is within snap distance — basic proximity snapping.
export function findConnectionSnapDelta(
  movingInstance: ComponentInstance,
  proposedPosition: [number, number, number],
  allInstances: ComponentInstance[],
): [number, number, number] | null {
  return findClosestConnectionMatch(movingInstance, proposedPosition, allInstances)?.delta ?? null
}
