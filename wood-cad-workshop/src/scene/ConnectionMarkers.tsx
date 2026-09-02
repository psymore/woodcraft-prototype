import { useRef } from 'react'
import type { ThreeEvent } from '@react-three/fiber'
import * as THREE from 'three'
import { closestBetweenWorldAnchors, findConnectionCandidates, getAnchors, pinDirection, SNAP_DISTANCE, toWorldAnchor } from '../engine'
import type { AnchorMatch, ComponentInstance, ConnectionCandidate } from '../engine'
import { useSceneSession } from '../store/sceneSessionStore'

// Candidate orb — bigger than the piece geometry it sits on top of, an
// easier touch target than the raw joint. Unchanged from before this
// change.
const MARKER_RADIUS = 0.5
// Candidate preview line — thinner than the orb, a secondary visual cue
// showing the two anchors about to snap together.
const LINE_RADIUS = 0.08
// Confirmed-connection pin — same diameter as the old marker sphere it
// replaces, for a comparably easy tap target.
const PIN_RADIUS = 0.25
const PIN_LENGTH = 1.5
const CANDIDATE_COLOR = '#ff8c00'
const CONNECTED_COLOR = '#d9342b'
// A fast double-tap confirms then instantly detaches, since the confirm
// and detach markers can land at the same screen position and React
// flushes both synchronous clicks before either marker's position
// updates. This cooldown makes a detach click on a connection ignored if
// it lands within this many ms of that same connection's own confirm
// click.
const DETACH_COOLDOWN_MS = 400

const WORLD_UP = new THREE.Vector3(0, 1, 0)

// Position, orientation, and length for a unit cylinder (default local
// +Y axis, height 1) so it spans from `from` to `to` — shared by the
// candidate preview line (between two distinct anchor points) and the
// confirmed pin (between the joint and a point offset along
// pinDirection). Returns length 0 (caller's responsibility to skip
// rendering) if `from`/`to` are coincident, since a cylinder can't be
// meaningfully oriented over a zero-length span.
function segmentTransform(from: [number, number, number], to: [number, number, number]) {
  const start = new THREE.Vector3(...from)
  const end = new THREE.Vector3(...to)
  const mid = start.clone().add(end).multiplyScalar(0.5)
  const delta = end.clone().sub(start)
  const length = delta.length()
  const quaternion =
    length > 1e-6 ? new THREE.Quaternion().setFromUnitVectors(WORLD_UP, delta.clone().normalize()) : new THREE.Quaternion()
  return { position: mid.toArray() as [number, number, number], quaternion, length }
}

// One visual per active Connection (a pin) and per not-yet-confirmed
// candidate (an orb + preview line) — both hidden during exploded view,
// same as the rotation gizmo and vertical-move handle in Piece.tsx.
export function ConnectionMarkers() {
  const instances = useSceneSession((s) => s.instances)
  const connections = useSceneSession((s) => s.connections)
  const explodeAmount = useSceneSession((s) => s.explodeAmount)
  const confirmConnection = useSceneSession((s) => s.confirmConnection)
  const detachConnection = useSceneSession((s) => s.detachConnection)
  const justConfirmedAt = useRef<Map<string, number>>(new Map())

  if (explodeAmount > 0) return null

  // Full closest-approach match between two anchors, plus the piece
  // instances themselves (pinDirection needs their positions). Returns
  // null if either piece or anchor no longer exists (e.g. deleted
  // mid-render).
  const matchOf = (
    pieceAId: string,
    aAnchorIndex: number,
    pieceBId: string,
    bAnchorIndex: number,
  ): { pieceA: ComponentInstance; pieceB: ComponentInstance; match: AnchorMatch } | null => {
    const pieceA = instances.find((i) => i.id === pieceAId)
    const pieceB = instances.find((i) => i.id === pieceBId)
    if (!pieceA || !pieceB) return null
    const anchorA = getAnchors(pieceA)[aAnchorIndex]
    const anchorB = getAnchors(pieceB)[bAnchorIndex]
    if (!anchorA || !anchorB) return null
    const worldA = toWorldAnchor(pieceA, anchorA)
    const worldB = toWorldAnchor(pieceB, anchorB)
    return { pieceA, pieceB, match: closestBetweenWorldAnchors(worldA, worldB) }
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
        const found = matchOf(candidate.pieceAId, candidate.a.anchorIndex, candidate.pieceBId, candidate.b.anchorIndex)
        if (!found) return null
        const { match } = found
        const midpoint: [number, number, number] = [
          (match.pointA[0] + match.pointB[0]) / 2,
          (match.pointA[1] + match.pointB[1]) / 2,
          (match.pointA[2] + match.pointB[2]) / 2,
        ]
        const line = segmentTransform(match.pointA, match.pointB)
        const onConfirm = (e: ThreeEvent<MouseEvent>) => {
          stop(e)
          const connectionId = `conn-${candidate.pieceAId}-${candidate.pieceBId}-${candidate.a.anchorIndex}-${candidate.b.anchorIndex}`
          justConfirmedAt.current.set(connectionId, Date.now())
          confirmConnection(candidate)
        }
        return (
          <group key={candidateKey(candidate)}>
            {line.length > 1e-6 && (
              <mesh position={line.position} quaternion={line.quaternion} onPointerDown={stop} onClick={onConfirm}>
                <cylinderGeometry args={[LINE_RADIUS, LINE_RADIUS, line.length, 8]} />
                <meshStandardMaterial color={CANDIDATE_COLOR} />
              </mesh>
            )}
            <mesh position={midpoint} onPointerDown={stop} onClick={onConfirm}>
              <sphereGeometry args={[MARKER_RADIUS, 12, 12]} />
              <meshStandardMaterial color={CANDIDATE_COLOR} />
            </mesh>
          </group>
        )
      })}
      {connections.map((connection) => {
        const found = matchOf(connection.pieceAId, connection.a.anchorIndex, connection.pieceBId, connection.b.anchorIndex)
        if (!found) return null
        const { pieceA, pieceB, match } = found
        // Coincident by construction (confirmConnection closes the gap
        // exactly) — either point is the joint.
        const joint = match.pointA
        const direction = pinDirection(joint, pieceA, pieceB)
        const tip: [number, number, number] = [
          joint[0] + direction[0] * PIN_LENGTH,
          joint[1] + direction[1] * PIN_LENGTH,
          joint[2] + direction[2] * PIN_LENGTH,
        ]
        const pin = segmentTransform(joint, tip)
        const onDetach = (e: ThreeEvent<MouseEvent>) => {
          stop(e)
          const confirmedAt = justConfirmedAt.current.get(connection.id)
          if (confirmedAt !== undefined && Date.now() - confirmedAt < DETACH_COOLDOWN_MS) return
          detachConnection(connection.id)
        }
        return (
          <mesh key={connection.id} position={pin.position} quaternion={pin.quaternion} onPointerDown={stop} onClick={onDetach}>
            <cylinderGeometry args={[PIN_RADIUS, PIN_RADIUS, PIN_LENGTH, 12]} />
            <meshStandardMaterial color={CONNECTED_COLOR} />
          </mesh>
        )
      })}
    </>
  )
}
