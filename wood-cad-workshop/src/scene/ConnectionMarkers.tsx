import { useRef } from 'react'
import type { ThreeEvent } from '@react-three/fiber'
import { closestBetweenWorldAnchors, findConnectionCandidates, getAnchors, SNAP_DISTANCE, toWorldAnchor } from '../engine'
import type { ConnectionCandidate } from '../engine'
import { useSceneSession } from '../store/sceneSessionStore'

// Bigger than the piece geometry it sits on top of, and bigger than the
// old 0.3-radius marker — an easier touch target for both the
// candidate-confirm and connection-detach clicks below.
const MARKER_RADIUS = 0.5
const CANDIDATE_COLOR = '#ff8c00'
const CONNECTED_COLOR = '#d9342b'
// A fast double-tap confirms then instantly detaches, since the two
// markers sit at the identical screen position and React flushes both
// synchronous clicks before either marker's position updates. This
// cooldown makes a detach click on a connection ignored if it lands within
// this many ms of that same connection's own confirm click.
const DETACH_COOLDOWN_MS = 400

// One marker per active Connection, plus one per not-yet-confirmed
// candidate (two available, compatible anchors within SNAP_DISTANCE of
// each other) — both hidden during exploded view, same as the rotation
// gizmo and vertical-move handle in Piece.tsx.
export function ConnectionMarkers() {
  const instances = useSceneSession((s) => s.instances)
  const connections = useSceneSession((s) => s.connections)
  const explodeAmount = useSceneSession((s) => s.explodeAmount)
  const confirmConnection = useSceneSession((s) => s.confirmConnection)
  const detachConnection = useSceneSession((s) => s.detachConnection)
  const justConfirmedAt = useRef<Map<string, number>>(new Map())

  if (explodeAmount > 0) return null

  // Midpoint of the two anchors' closest-approach points — degenerates
  // to the exact midpoint of two fixed points for a point-point pair
  // (unchanged from before this change), and lands on the true
  // closest-approach location for a segment/face pair.
  const midpointOf = (
    pieceAId: string,
    aAnchorIndex: number,
    pieceBId: string,
    bAnchorIndex: number,
  ): [number, number, number] | null => {
    const pieceA = instances.find((i) => i.id === pieceAId)
    const pieceB = instances.find((i) => i.id === pieceBId)
    if (!pieceA || !pieceB) return null
    const anchorA = getAnchors(pieceA)[aAnchorIndex]
    const anchorB = getAnchors(pieceB)[bAnchorIndex]
    if (!anchorA || !anchorB) return null
    const worldA = toWorldAnchor(pieceA, anchorA)
    const worldB = toWorldAnchor(pieceB, anchorB)
    const match = closestBetweenWorldAnchors(worldA, worldB)
    return [
      (match.pointA[0] + match.pointB[0]) / 2,
      (match.pointA[1] + match.pointB[1]) / 2,
      (match.pointA[2] + match.pointB[2]) / 2,
    ]
  }

  // Stops the click/pointerdown from also reaching Scene.tsx's ground
  // plane behind the marker, which would otherwise deselect the
  // currently-selected piece as a side effect of confirming/detaching.
  const stop = (e: ThreeEvent<PointerEvent> | ThreeEvent<MouseEvent>) => e.stopPropagation()

  const candidates = findConnectionCandidates(instances, connections, SNAP_DISTANCE)

  const candidateKey = (c: ConnectionCandidate) =>
    `candidate-${c.pieceAId}-${c.a.anchorIndex}-${c.pieceBId}-${c.b.anchorIndex}`

  return (
    <>
      {candidates.map((candidate) => {
        const midpoint = midpointOf(candidate.pieceAId, candidate.a.anchorIndex, candidate.pieceBId, candidate.b.anchorIndex)
        if (!midpoint) return null
        return (
          <mesh
            key={candidateKey(candidate)}
            position={midpoint}
            onPointerDown={stop}
            onClick={(e: ThreeEvent<MouseEvent>) => {
              stop(e)
              const connectionId = `conn-${candidate.pieceAId}-${candidate.pieceBId}-${candidate.a.anchorIndex}-${candidate.b.anchorIndex}`
              justConfirmedAt.current.set(connectionId, Date.now())
              confirmConnection(candidate)
            }}
          >
            <sphereGeometry args={[MARKER_RADIUS, 12, 12]} />
            <meshStandardMaterial color={CANDIDATE_COLOR} />
          </mesh>
        )
      })}
      {connections.map((connection) => {
        const midpoint = midpointOf(connection.pieceAId, connection.a.anchorIndex, connection.pieceBId, connection.b.anchorIndex)
        if (!midpoint) return null
        return (
          <mesh
            key={connection.id}
            position={midpoint}
            onPointerDown={stop}
            onClick={(e: ThreeEvent<MouseEvent>) => {
              stop(e)
              const confirmedAt = justConfirmedAt.current.get(connection.id)
              if (confirmedAt !== undefined && Date.now() - confirmedAt < DETACH_COOLDOWN_MS) return
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
