import type { ThreeEvent } from '@react-three/fiber'
import { findConnectionCandidates, getConnectionPoints, SNAP_DISTANCE, toWorldPoint } from '../engine'
import type { ConnectionCandidate } from '../engine'
import { useSceneSession } from '../store/sceneSessionStore'

// Bigger than the piece geometry it sits on top of, and bigger than the
// old 0.3-radius marker — an easier touch target for both the
// candidate-confirm and connection-detach clicks below.
const MARKER_RADIUS = 0.5
const CANDIDATE_COLOR = '#ff8c00'
const CONNECTED_COLOR = '#d9342b'

// One marker per active Connection, plus one per not-yet-confirmed
// candidate (two unclaimed, compatible points within SNAP_DISTANCE of
// each other) — both hidden during exploded view, same as the rotation
// gizmo and vertical-move handle in Piece.tsx.
export function ConnectionMarkers() {
  const instances = useSceneSession((s) => s.instances)
  const connections = useSceneSession((s) => s.connections)
  const explodeAmount = useSceneSession((s) => s.explodeAmount)
  const confirmConnection = useSceneSession((s) => s.confirmConnection)
  const detachConnection = useSceneSession((s) => s.detachConnection)

  if (explodeAmount > 0) return null

  const midpointOf = (
    pieceAId: string,
    pointAIndex: number,
    pieceBId: string,
    pointBIndex: number,
  ): [number, number, number] | null => {
    const pieceA = instances.find((i) => i.id === pieceAId)
    const pieceB = instances.find((i) => i.id === pieceBId)
    if (!pieceA || !pieceB) return null
    const localA = getConnectionPoints(pieceA)[pointAIndex]
    const localB = getConnectionPoints(pieceB)[pointBIndex]
    if (!localA || !localB) return null
    const worldA = toWorldPoint(pieceA, localA)
    const worldB = toWorldPoint(pieceB, localB)
    return [(worldA[0] + worldB[0]) / 2, (worldA[1] + worldB[1]) / 2, (worldA[2] + worldB[2]) / 2]
  }

  // Stops the click/pointerdown from also reaching Scene.tsx's ground
  // plane behind the marker, which would otherwise deselect the
  // currently-selected piece as a side effect of confirming/detaching.
  const stop = (e: ThreeEvent<PointerEvent> | ThreeEvent<MouseEvent>) => e.stopPropagation()

  const candidates = findConnectionCandidates(instances, connections, SNAP_DISTANCE)

  const candidateKey = (c: ConnectionCandidate) =>
    `candidate-${c.pieceAId}-${c.pointAIndex}-${c.pieceBId}-${c.pointBIndex}`

  return (
    <>
      {candidates.map((candidate) => {
        const midpoint = midpointOf(candidate.pieceAId, candidate.pointAIndex, candidate.pieceBId, candidate.pointBIndex)
        if (!midpoint) return null
        return (
          <mesh
            key={candidateKey(candidate)}
            position={midpoint}
            onPointerDown={stop}
            onClick={(e: ThreeEvent<MouseEvent>) => {
              stop(e)
              confirmConnection(candidate)
            }}
          >
            <sphereGeometry args={[MARKER_RADIUS, 12, 12]} />
            <meshStandardMaterial color={CANDIDATE_COLOR} />
          </mesh>
        )
      })}
      {connections.map((connection) => {
        const midpoint = midpointOf(connection.pieceAId, connection.pointAIndex, connection.pieceBId, connection.pointBIndex)
        if (!midpoint) return null
        return (
          <mesh
            key={connection.id}
            position={midpoint}
            onPointerDown={stop}
            onClick={(e: ThreeEvent<MouseEvent>) => {
              stop(e)
              detachConnection(connection.id)
            }}
          >
            <sphereGeometry args={[MARKER_RADIUS, 12, 12]} />
            <meshStandardMaterial color={CONNECTED_COLOR} />
          </mesh>
        )
      })}
    </>
  )
}
