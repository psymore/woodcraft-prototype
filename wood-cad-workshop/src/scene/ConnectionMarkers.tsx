import type { ThreeEvent } from '@react-three/fiber'
import { useThree } from '@react-three/fiber'
import * as THREE from 'three'
import {
  classifyAnchorPairKind,
  closestBetweenWorldAnchors,
  findConnectionCandidates,
  getAnchors,
  pinDirection,
  SNAP_DISTANCE,
  toWorldAnchor,
} from '../engine'
import type { AnchorMatch, AnchorPairKind, ComponentInstance, ConnectionCandidate } from '../engine'
import { useSceneSession } from '../store/sceneSessionStore'
import { minWorldRadiusForPixels } from './screenSpace'

// Candidate orb — sized just to stay noticeable when peeking out from
// inside overlapping/nested geometry (the whole point of its depthTest:
// false X-ray rendering below), not as a big standalone shape. Still
// bigger than the preview line so the line visibly protrudes past it at
// the maximum candidate gap (SNAP_DISTANCE/2 = 0.35 > this radius). Shrunk
// twice now (was 0.32, then 0.22) — still floored by tapTargetRadius below
// when zoomed out, so it never drops under a tappable size.
const CANDIDATE_MARKER_RADIUS = 0.15
// Candidate preview line — thinner than the orb, a secondary visual cue
// showing the two anchors about to snap together.
const LINE_RADIUS = 0.06
// Confirmed-connection pin — same "just visible through overlaps" sizing
// as the candidate orb above. Capped with a sphere at each end (see
// PIN_CAP_SEGMENTS below) so it reads as a rounded pin rather than a
// flat-ended cylinder. Shrunk twice now (was 0.25, then 0.17).
const PIN_RADIUS = 0.12
const PIN_LENGTH = 0.9
const PIN_CAP_SEGMENTS = 12
const CONNECTED_COLOR = '#d9342b'
const SELECTED_CONNECTED_COLOR = '#ff7a1a'
// Glow halo multiplier/opacity shared by the candidate orb and the
// confirmed pin — same cheap additive-blended, no-depth-write technique as
// AnchorMarkers.tsx's connection-point dots, color-matched per marker
// rather than a single fixed glow color. Tighter/dimmer than the first
// pass (was 1.6/0.3) — at the old scale the halo visibly outgrew the
// marker it was supposed to be glowing, reading as a separate blob rather
// than a glow on the shape itself.
const GLOW_RADIUS_SCALE = 1.3
const GLOW_OPACITY = 0.22

// Candidate color by anchor-pair kind — SketchUp-inference-style semantic
// coding so a candidate's color hints at what kind of joint it would make
// (two ends meeting exactly vs. one end docking onto a face/edge), instead
// of every candidate looking identical regardless of geometry.
const CANDIDATE_COLOR_BY_KIND: Record<AnchorPairKind, string> = {
  'point-point': '#ff8c00', // orange — original color, most common case (e.g. two board ends)
  'point-segment': '#3fa7d6', // blue — one end docking onto another piece's edge
  'point-face': '#2ecc71', // green — one end resting on another piece's face
}

function candidateColor(pieceA: ComponentInstance, aAnchorIndex: number, pieceB: ComponentInstance, bAnchorIndex: number): string {
  const kindA = getAnchors(pieceA)[aAnchorIndex].kind
  const kindB = getAnchors(pieceB)[bAnchorIndex].kind
  return CANDIDATE_COLOR_BY_KIND[classifyAnchorPairKind(kindA, kindB)]
}

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
  const showConnectionMarkers = useSceneSession((s) => s.showConnectionMarkers)
  const confirmConnection = useSceneSession((s) => s.confirmConnection)
  const selectedConnectionId = useSceneSession((s) => s.selectedConnectionId)
  const selectConnection = useSceneSession((s) => s.selectConnection)
  const camera = useThree((s) => s.camera) as THREE.PerspectiveCamera
  const canvasHeight = useThree((s) => s.size.height)

  if (explodeAmount > 0 || !showConnectionMarkers) return null

  // Fixed world-unit radii shrink below a comfortable tap target when
  // zoomed out — never shrinks an already-larger marker, only boosts ones
  // that would render too small at the current distance/zoom. Uses a
  // smaller floor than the app's standard MIN_TAP_TARGET_RADIUS_PX (22px
  // radius / 44px diameter, from screenSpace.ts): at any normal viewing
  // distance that floor was the actual on-screen size, since it's larger
  // than CANDIDATE_MARKER_RADIUS/PIN_RADIUS above — so shrinking those two
  // constants alone had no visible effect until this floor also came down.
  // These markers are a secondary, glance-and-tap affordance (not a
  // primary manipulation handle like the move/rotate gizmos), so a smaller
  // floor is an acceptable trade for actually reading as small.
  const MARKER_MIN_TAP_RADIUS_PX = 12
  const tapTargetRadius = (baseRadius: number, worldPosition: [number, number, number]) =>
    Math.max(baseRadius, minWorldRadiusForPixels(MARKER_MIN_TAP_RADIUS_PX, new THREE.Vector3(...worldPosition), camera, canvasHeight))

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
        const { pieceA, pieceB, match } = found
        const midpoint: [number, number, number] = [
          (match.pointA[0] + match.pointB[0]) / 2,
          (match.pointA[1] + match.pointB[1]) / 2,
          (match.pointA[2] + match.pointB[2]) / 2,
        ]
        const line = segmentTransform(match.pointA, match.pointB)
        const color = candidateColor(pieceA, candidate.a.anchorIndex, pieceB, candidate.b.anchorIndex)
        const orbRadius = tapTargetRadius(CANDIDATE_MARKER_RADIUS, midpoint)
        const onConfirm = (e: ThreeEvent<MouseEvent>) => {
          stop(e)
          confirmConnection(candidate)
        }
        return (
          <group key={candidateKey(candidate)}>
            {line.length > 1e-6 && (
              <mesh position={line.position} quaternion={line.quaternion} onPointerDown={stop} onClick={onConfirm}>
                <cylinderGeometry args={[LINE_RADIUS, LINE_RADIUS, line.length, 8]} />
                <meshStandardMaterial color={color} />
              </mesh>
            )}
            {/* Glow halo — additive, non-interactive, drawn just behind the
                solid orb below. */}
            <mesh position={midpoint} raycast={() => null} renderOrder={1}>
              <sphereGeometry args={[orbRadius * GLOW_RADIUS_SCALE, 12, 12]} />
              <meshBasicMaterial color={color} transparent opacity={GLOW_OPACITY} blending={THREE.AdditiveBlending} depthWrite={false} depthTest={false} />
            </mesh>
            <mesh position={midpoint} renderOrder={2} onPointerDown={stop} onClick={onConfirm}>
              <sphereGeometry args={[orbRadius, 12, 12]} />
              {/* depthTest off, same X-ray technique as AnchorMarkers.tsx:
                  on overlapping/nested pieces this orb can end up buried
                  inside another piece's geometry, making it hard to spot
                  or tap — this keeps it visible (and still clickable,
                  since raycast is unaffected by depthTest) regardless of
                  what's in front of it. */}
              <meshStandardMaterial color={color} depthTest={false} />
            </mesh>
          </group>
        )
      })}
      {connections.map((connection) => {
        const found = matchOf(connection.pieceAId, connection.a.anchorIndex, connection.pieceBId, connection.b.anchorIndex)
        if (!found) return null
        const { pieceA, pieceB, match } = found
        // Coincident at confirm time (confirmConnection closes the gap
        // exactly), but a live connection can drift apart by up to
        // SNAP_DISTANCE before pruneStaleConnections drops it — using the
        // midpoint (not just one side's point) keeps the pin correctly
        // centered even after some drift.
        const joint: [number, number, number] = [
          (match.pointA[0] + match.pointB[0]) / 2,
          (match.pointA[1] + match.pointB[1]) / 2,
          (match.pointA[2] + match.pointB[2]) / 2,
        ]
        const direction = pinDirection(joint, pieceA, pieceB)
        const tip: [number, number, number] = [
          joint[0] + direction[0] * PIN_LENGTH,
          joint[1] + direction[1] * PIN_LENGTH,
          joint[2] + direction[2] * PIN_LENGTH,
        ]
        const pin = segmentTransform(joint, tip)
        const isSelected = connection.id === selectedConnectionId
        const pinRadius = tapTargetRadius(isSelected ? PIN_RADIUS * 1.25 : PIN_RADIUS, pin.position)
        const pinColor = isSelected ? SELECTED_CONNECTED_COLOR : CONNECTED_COLOR
        const onSelect = (e: ThreeEvent<MouseEvent>) => {
          stop(e)
          selectConnection(connection.id)
        }
        return (
          <group key={connection.id}>
            {/* Glow halo — additive, non-interactive, drawn just behind the
                solid pin below. */}
            <mesh position={pin.position} quaternion={pin.quaternion} raycast={() => null}>
              <cylinderGeometry args={[pinRadius * GLOW_RADIUS_SCALE, pinRadius * GLOW_RADIUS_SCALE, PIN_LENGTH, 12]} />
              <meshBasicMaterial color={pinColor} transparent opacity={GLOW_OPACITY} blending={THREE.AdditiveBlending} depthWrite={false} depthTest={false} />
            </mesh>
            <mesh position={pin.position} quaternion={pin.quaternion} onPointerDown={stop} onClick={onSelect}>
              <cylinderGeometry args={[pinRadius, pinRadius, PIN_LENGTH, 12]} />
              <meshStandardMaterial color={pinColor} />
            </mesh>
            {/* Round caps at each end — without these the pin is a bare
                flat-cut cylinder, which reads as a stick rather than a
                rounded marker. Same radius as the cylinder body so the two
                blend into one continuous capsule shape. */}
            {[joint, tip].map((end, i) => (
              <mesh key={i} position={end} onPointerDown={stop} onClick={onSelect}>
                <sphereGeometry args={[pinRadius, PIN_CAP_SEGMENTS, PIN_CAP_SEGMENTS]} />
                <meshStandardMaterial color={pinColor} />
              </mesh>
            ))}
          </group>
        )
      })}
    </>
  )
}
