import * as THREE from 'three'
import { getAnchors, pointAtParam, toWorldAnchor } from '../engine'
import { useSceneSession } from '../store/sceneSessionStore'

// Smaller than the candidate orb (ConnectionMarkers.tsx's 0.25) and a
// neutral color distinct from every other marker color in the scene
// (candidate orange/blue/green, confirmed-pin red) — these are a passive
// discoverability aid, not something to tap.
const ANCHOR_MARKER_RADIUS = 0.12
const ANCHOR_MARKER_COLOR = '#ffffff'
// Glow halo — a larger, additively-blended, low-opacity sphere behind the
// solid dot. Three.js has no built-in per-object glow without a
// postprocessing bloom pass (which would affect the whole scene); this
// fakes it cheaply with a second draw call per marker.
const GLOW_MARKER_RADIUS = 0.28

// Passive markers at every one of the selected piece's own connection
// points — gated behind sceneSessionStore's showConnectionPoints toggle
// (GizmoToggles.tsx), off by default. Deliberately scoped to the
// selected piece only, not the whole scene (see the toggle's own comment
// in sceneSessionStore.ts). Non-interactive: raycast disabled so these
// never intercept clicks meant for the piece or the ground plane behind
// it (see ConnectionMarkers.tsx's own stopPropagation note for why that
// matters here).
export function AnchorMarkers() {
  const instances = useSceneSession((s) => s.instances)
  const selectedId = useSceneSession((s) => s.selectedId)
  const explodeAmount = useSceneSession((s) => s.explodeAmount)
  const showConnectionPoints = useSceneSession((s) => s.showConnectionPoints)

  if (!showConnectionPoints || !selectedId || explodeAmount > 0) return null

  const instance = instances.find((i) => i.id === selectedId)
  if (!instance) return null

  const anchors = getAnchors(instance)

  return (
    <>
      {anchors.map((anchor, index) => {
        const position = pointAtParam(toWorldAnchor(instance, anchor))
        return (
          <group key={index}>
            {/* Glow halo, drawn behind the solid dot below: additive
                blending + no depth write so it softly brightens whatever
                it overlaps (including the dot itself) without occluding
                anything, same non-interactive/X-ray treatment as the dot. */}
            <mesh position={position} raycast={() => null} renderOrder={1}>
              <sphereGeometry args={[GLOW_MARKER_RADIUS, 12, 12]} />
              <meshBasicMaterial
                color={ANCHOR_MARKER_COLOR}
                transparent
                opacity={0.35}
                blending={THREE.AdditiveBlending}
                depthWrite={false}
                depthTest={false}
              />
            </mesh>
            <mesh position={position} raycast={() => null} renderOrder={2}>
              <sphereGeometry args={[ANCHOR_MARKER_RADIUS, 8, 8]} />
              {/* depthTest off: this is an X-ray discoverability overlay, not
                  a scene object — a point/segment/face anchor on the far or
                  inner side of a solid piece (there are several, by
                  construction — see getAnchors' own comment on shared
                  default positions) must stay visible rather than being
                  silently buried like the ordinary opaque markers in
                  ConnectionMarkers.tsx. */}
              <meshBasicMaterial color={ANCHOR_MARKER_COLOR} depthTest={false} />
            </mesh>
          </group>
        )
      })}
    </>
  )
}
