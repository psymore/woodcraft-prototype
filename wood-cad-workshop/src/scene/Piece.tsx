import { useCallback, useRef, useState } from 'react'
import type { RefObject } from 'react'
import type { ThreeEvent } from '@react-three/fiber'
import { useThree } from '@react-three/fiber'
import { TransformControls } from '@react-three/drei'
import * as THREE from 'three'
import { Line2, LineGeometry, LineMaterial } from 'three-stdlib'
import type { ComponentDefinition, ComponentInstance } from '../engine'
import { depthBiasFor, getBoxSize, getCylinderSize, getExplodedPosition, snapValue } from '../engine'
import { useSceneSession } from '../store/sceneSessionStore'
import { MIN_TAP_TARGET_RADIUS_PX, minWorldRadiusForPixels, worldRadiusToPixels } from './screenSpace'

const GRID_INCREMENT = 1
const GROUND_PLANE = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0)
const HANDLE_GAP = 1
const GIZMO_CLEARANCE_FACTOR = 1.4
const ROTATION_SNAP = THREE.MathUtils.degToRad(15)
const MOVE_HANDLE_RADIUS = 0.6
const MOVE_HANDLE_HEIGHT = 1.2
const MOVE_HANDLE_GLOW_SCALE = 1.35
const ROTATE_PICKER_TUBE_RADIUS = 0.9
const ROTATE_RING_LINE_WIDTH_PX = 6
// Extra headroom on top of the 44px-minimum sizing math below, so the whole
// gizmo (both the visible rings and their click area, which scale together
// via TransformControls' own `size` prop) reads as bigger and bolder overall.
const GIZMO_SIZE_BOOST = 1.4

// Called via TransformControls' ref when the rotate gizmo mounts (and again
// on canvas resize, since line width in pixels needs a fresh resolution).
// Removes the free-rotate ("E", yellow) ring — a fourth ring outside the
// piece's actual X/Y/Z axes that mostly just gets in the way — enlarges the
// invisible hit-test torus for the X/Y/Z rings so they're easier to grab,
// and swaps their thin (effectively 1px on most platforms, since
// LineBasicMaterial's linewidth is ignored by WebGL) visual ring lines for
// fat Line2/LineMaterial ones with a real pixel width. (A real shaded 3D
// torus was tried for the visible rings too, but the axis-orientation math
// needed to keep it aligned with three-stdlib's per-frame handle transform
// got fiddly for uncertain payoff — reverted in favor of this proven
// approach plus just making everything bigger via GIZMO_SIZE_BOOST.)
function tuneRotationGizmo(controls: THREE.Object3D | null, canvasWidth: number, canvasHeight: number) {
  if (!controls) return
  const eRings: THREE.Object3D[] = []
  controls.traverse((child) => {
    if (child.name === 'E') eRings.push(child)
  })
  eRings.forEach((child) => child.parent?.remove(child))

  // A per-mesh `.scale` doesn't stick here: three-stdlib's own
  // updateMatrixWorld unconditionally resets every handle's scale every
  // frame (`handle.scale.set(1,1,1).multiplyScalar(factor * size / 7)`,
  // the same screen-constant-sizing math as elsewhere in this file) to keep
  // the whole gizmo's apparent size correct — so a one-time scale-up here
  // gets silently wiped the very next frame. Enlarging the picker's own
  // geometry (its tube radius, not its scale) survives that reset, since
  // the per-frame code scales whatever shape is there uniformly along with
  // every other handle, not just this one.
  controls.traverse((child) => {
    if (
      (child.name === 'X' || child.name === 'Y' || child.name === 'Z') &&
      child instanceof THREE.Mesh &&
      child.geometry instanceof THREE.TorusGeometry &&
      !child.userData.isEnlargedPicker
    ) {
      const { radius, radialSegments, tubularSegments } = child.geometry.parameters
      const enlarged = new THREE.TorusGeometry(radius, ROTATE_PICKER_TUBE_RADIUS, radialSegments, tubularSegments)
      // A full torus is rotationally symmetric about its own hole axis, so
      // only which plane it lies in matters (not the roll baked into the
      // original geometry) — default TorusGeometry lies in the XY plane
      // (hole along Z), so X needs a Y-rotation and Y an X-rotation to
      // reach their planes; Z already matches.
      if (child.name === 'X') enlarged.rotateY(Math.PI / 2)
      if (child.name === 'Y') enlarged.rotateX(Math.PI / 2)
      child.geometry.dispose()
      child.geometry = enlarged
      // The library's own "invisible" picker material is ~15% opacity —
      // thin enough at its original tube radius to read as invisible, but
      // this much fatter tube stacks many overlapping torus layers per
      // screen pixel, compounding that 15% into a visibly solid blob.
      // Raycasting only needs `visible: true` and doesn't care about
      // opacity, so drop it to fully transparent instead.
      const material = child.material as THREE.Material
      material.opacity = 0
      child.userData.isEnlargedPicker = true
    }
  })

  // Already built on a previous mount/resize — just refresh the pixel
  // width's resolution uniform (it depends on canvas size) rather than
  // rebuilding (which would pile up duplicate thick rings).
  let hasThickRings = false
  controls.traverse((child) => {
    if (child.userData.isThickRotateRing) {
      hasThickRings = true
      ;(child as InstanceType<typeof Line2>).material.resolution.set(canvasWidth, canvasHeight)
    }
  })
  if (hasThickRings) return

  const originals: THREE.Line[] = []
  controls.traverse((child) => {
    if (
      (child.name === 'X' || child.name === 'Y' || child.name === 'Z') &&
      child instanceof THREE.Line &&
      !(child instanceof THREE.LineSegments)
    ) {
      originals.push(child)
    }
  })
  originals.forEach((line) => {
    const positions = Array.from((line.geometry.getAttribute('position') as THREE.BufferAttribute).array)
    const geometry = new LineGeometry()
    geometry.setPositions(positions)
    const baseMaterial = line.material as THREE.LineBasicMaterial
    const material = new LineMaterial({
      color: baseMaterial.color.getHex(),
      linewidth: ROTATE_RING_LINE_WIDTH_PX,
      transparent: true,
      opacity: baseMaterial.opacity,
      depthTest: false,
      depthWrite: false,
    })
    material.resolution.set(canvasWidth, canvasHeight)
    const thickLine = new Line2(geometry, material)
    // Same name as the original so it inherits three-stdlib's per-frame
    // camera-facing quaternion update (matched by exact handle.name).
    thickLine.name = line.name
    thickLine.renderOrder = line.renderOrder
    thickLine.userData.isThickRotateRing = true
    line.visible = false
    line.parent?.add(thickLine)
  })
}

export function Piece({
  instance,
  definition,
  centroid,
  multiTouchActiveRef,
}: {
  instance: ComponentInstance
  definition: ComponentDefinition
  centroid: [number, number, number]
  multiTouchActiveRef: RefObject<boolean>
}) {
  const selected = useSceneSession((s) => s.selectedId === instance.id)
  const explodeAmount = useSceneSession((s) => s.explodeAmount)
  const selectPiece = useSceneSession((s) => s.selectPiece)
  const movePiece = useSceneSession((s) => s.movePiece)
  const setDraggingPiece = useSceneSession((s) => s.setDraggingPiece)
  const setRotation = useSceneSession((s) => s.setRotation)
  const showRotationGizmo = useSceneSession((s) => s.showRotationGizmo)
  const showMoveHandle = useSceneSession((s) => s.showMoveHandle)
  const camera = useThree((s) => s.camera)
  const canvasSize = useThree((s) => s.size)

  const tuneRotationGizmoRef = useCallback(
    (controls: THREE.Object3D | null) => tuneRotationGizmo(controls, canvasSize.width, canvasSize.height),
    [canvasSize.width, canvasSize.height],
  )

  // State-backed callback ref, not useRef: TransformControls needs the real
  // group object at render time. A useRef is null on the first render and
  // mutating it never re-renders, so a piece that mounts already-selected
  // (e.g. right after DUPLICATE) would leave the gizmo attached to drei's
  // own empty wrapper at the origin.
  const [group, setGroup] = useState<THREE.Group | null>(null)

  const dragging = useRef(false)
  const dragOffset = useRef<[number, number]>([0, 0])

  const verticalDragging = useRef(false)
  const verticalDragOffset = useRef(0)
  const verticalPlane = useRef(new THREE.Plane())

  // TransformControls listens for pointer events directly on the canvas,
  // entirely separately from R3F's synthetic onPointerDown/onPointerMove
  // below — so grabbing a rotate ring (which usually also intersects the
  // piece's own box mesh underneath it) starts BOTH a rotation and this
  // piece's own translate-drag from the same gesture. Since TransformControls'
  // native listener fires after R3F's (it attaches later, once mounted), by
  // the time its 'mouseDown' event reaches us the piece has already started
  // dragging — this ref lets the move handlers below bail out on the next
  // pointermove instead, so rotating never also drags the piece.
  const gizmoActive = useRef(false)

  const groundHit = (ray: THREE.Ray): THREE.Vector3 | null => {
    const target = new THREE.Vector3()
    return ray.intersectPlane(GROUND_PLANE, target)
  }

  const verticalHit = (ray: THREE.Ray): THREE.Vector3 | null => {
    const target = new THREE.Vector3()
    return ray.intersectPlane(verticalPlane.current, target)
  }

  const handleVerticalPointerDown = (e: ThreeEvent<PointerEvent>) => {
    if (multiTouchActiveRef.current || explodeAmount > 0) return
    e.stopPropagation()
    ;(e.target as Element).setPointerCapture(e.pointerId)
    verticalDragging.current = true
    setDraggingPiece(true)
    // Vertical plane through the piece's X/Z, facing the camera horizontally
    // so a straight up/down drag on screen tracks a straight up/down move.
    const facing = new THREE.Vector3()
    camera.getWorldDirection(facing)
    facing.y = 0
    if (facing.lengthSq() < 1e-6) facing.set(0, 0, 1)
    facing.normalize()
    verticalPlane.current.setFromNormalAndCoplanarPoint(
      facing,
      new THREE.Vector3(instance.position[0], instance.position[1], instance.position[2]),
    )
    const hit = verticalHit(e.ray)
    verticalDragOffset.current = hit ? instance.position[1] - hit.y : 0
  }

  const handleVerticalPointerMove = (e: ThreeEvent<PointerEvent>) => {
    if (!verticalDragging.current || multiTouchActiveRef.current || gizmoActive.current) return
    const hit = verticalHit(e.ray)
    if (!hit) return
    const snappedY = Math.max(0, snapValue(hit.y + verticalDragOffset.current, GRID_INCREMENT))
    movePiece(instance.id, [instance.position[0], snappedY, instance.position[2]])
  }

  const handleVerticalPointerUp = (e: ThreeEvent<PointerEvent>) => {
    verticalDragging.current = false
    setDraggingPiece(false)
    ;(e.target as Element).releasePointerCapture(e.pointerId)
  }

  const handlePointerDown = (e: ThreeEvent<PointerEvent>) => {
    if (multiTouchActiveRef.current || explodeAmount > 0) return
    e.stopPropagation()
    ;(e.target as Element).setPointerCapture(e.pointerId)
    selectPiece(instance.id)
    dragging.current = true
    setDraggingPiece(true)
    const hit = groundHit(e.ray)
    dragOffset.current = hit ? [instance.position[0] - hit.x, instance.position[2] - hit.z] : [0, 0]
  }

  const handlePointerMove = (e: ThreeEvent<PointerEvent>) => {
    if (!dragging.current || multiTouchActiveRef.current || gizmoActive.current) return
    // Deliberately e.ray, not e.point: once the pointer is captured,
    // e.point/e.object replay a stale intersection from pick time if the
    // live raycast no longer hits this mesh. e.ray is always live.
    const hit = groundHit(e.ray)
    if (!hit) return
    const [offsetX, offsetZ] = dragOffset.current
    const snappedX = snapValue(hit.x + offsetX, GRID_INCREMENT)
    const snappedZ = snapValue(hit.z + offsetZ, GRID_INCREMENT)
    movePiece(instance.id, [snappedX, instance.position[1], snappedZ])
  }

  const handlePointerUp = (e: ThreeEvent<PointerEvent>) => {
    dragging.current = false
    setDraggingPiece(false)
    ;(e.target as Element).releasePointerCapture(e.pointerId)
  }

  const handleGizmoChange = () => {
    if (!group) return
    setRotation(instance.id, [group.rotation.x, group.rotation.y, group.rotation.z])
  }

  // Cyan-blue, not orange: orange is already spoken for by the active-toggle
  // accent (GizmoToggles/panelButtonStyle) and the point-point candidate
  // color (ConnectionMarkers.tsx) — selection is a different concept from
  // either and shouldn't share their hue family.
  const color = selected ? '#4fd1ff' : instance.material
  const displayPosition = getExplodedPosition(instance.position, centroid, explodeAmount)

  const showVerticalHandle = selected && explodeAmount === 0 && showMoveHandle
  const showGizmo = selected && explodeAmount === 0 && showRotationGizmo

  // The handle is a SIBLING of the rotating group, so it stays in world space:
  // pieces can now pitch/roll, and a child at local +Y would swing off to the
  // side while its drag logic still moves along world Y. To sit right at the
  // piece's actual top (not a generic over-estimate), rotate each local
  // half-extent by the piece's current orientation and take the axis-aligned
  // bounding box's Y half-extent — the standard "abs(rotated basis) · extent"
  // formula, using the same Euler order ('XYZ') the group itself renders with.
  const getVerticalExtent = (halfExtents: [number, number, number]) => {
    const [hx, hy, hz] = halfExtents
    const euler = new THREE.Euler(instance.rotation[0], instance.rotation[1], instance.rotation[2], 'XYZ')
    return (
      Math.abs(new THREE.Vector3(hx, 0, 0).applyEuler(euler).y) +
      Math.abs(new THREE.Vector3(0, hy, 0).applyEuler(euler).y) +
      Math.abs(new THREE.Vector3(0, 0, hz).applyEuler(euler).y)
    )
  }

  // The rotation gizmo keeps a constant SCREEN size regardless of camera
  // distance/zoom, so its world-space radius isn't a fixed number — it has
  // to be computed the same way drei's bundled TransformControls computes
  // its own handle scale (three-stdlib/controls/TransformControls.cjs,
  // `updateMatrixWorld`: factor = distance * min(1.9*tan(fov/2)/zoom, 7),
  // handle.scale = factor * size/7), so the handle can clear it at any zoom
  // level instead of just a fixed margin that only works at some distances.
  // 1 is the local radius of the X/Y/Z rotate rings — the largest ones
  // still rendered now that tuneRotationGizmo (below) removes the free-
  // rotate ("E") ring, which used to be the outermost at 1.25. Keeping this
  // in sync with what's actually still on screen matters for both the
  // handle-clearance use below and the tap-target sizing further down —
  // otherwise both undershoot, sizing against a ring that no longer exists.
  const getGizmoOuterRadius = () => {
    if (!showGizmo) return 0
    const cam = camera as THREE.PerspectiveCamera
    const worldPosition = new THREE.Vector3(...displayPosition)
    const distance = worldPosition.distanceTo(cam.position)
    const factor = distance * Math.min((1.9 * Math.tan((Math.PI * cam.fov) / 360)) / (cam.zoom || 1), 7)
    const gizmoSize = 1
    const outerRingLocalRadius = 1
    return ((factor * gizmoSize) / 7) * outerRingLocalRadius
  }

  // Even though the gizmo's angular size is already zoom-constant (above),
  // its actual on-screen pixel size still depends on canvas height/fov, so
  // at a narrow enough viewport it can still render under the 44px tap
  // target minimum. `size` is a linear multiplier drei's TransformControls
  // applies to that same formula, so this converts the current radius to
  // pixels and scales it up (never down) to clear the minimum — then
  // GIZMO_SIZE_BOOST makes the whole gizmo (rings and their click area
  // together, both driven by this same `size` prop) bigger across the
  // board, not just at the bare minimum.
  const getGizmoSizeMultiplier = () => {
    if (!showGizmo) return 1
    const cam = camera as THREE.PerspectiveCamera
    const worldPosition = new THREE.Vector3(...displayPosition)
    const currentPixels = worldRadiusToPixels(getGizmoOuterRadius(), worldPosition, cam, canvasSize.height)
    if (currentPixels <= 0) return GIZMO_SIZE_BOOST
    return Math.max(GIZMO_SIZE_BOOST, (MIN_TAP_TARGET_RADIUS_PX / currentPixels) * GIZMO_SIZE_BOOST)
  }

  const verticalHandle = (halfExtents: [number, number, number]) => {
    if (!showVerticalHandle) return null
    // When the rotation gizmo is also showing, clear its rings with real
    // headroom (not just their bare radius) so the cone reads as a clearly
    // separate control instead of nearly touching the topmost ring. Scaled
    // by the same size multiplier the gizmo itself renders at (including
    // GIZMO_SIZE_BOOST), since getGizmoOuterRadius() alone is the
    // pre-boost radius — otherwise a bigger gizmo would outgrow this
    // clearance and the cone would sit too close again.
    const gizmoRenderedRadius = getGizmoOuterRadius() * getGizmoSizeMultiplier()
    const gizmoClearance = showGizmo ? gizmoRenderedRadius * GIZMO_CLEARANCE_FACTOR : gizmoRenderedRadius
    const position: [number, number, number] = [
      displayPosition[0],
      displayPosition[1] + Math.max(getVerticalExtent(halfExtents), gizmoClearance) + HANDLE_GAP,
      displayPosition[2],
    ]
    // Fixed world-unit geometry shrinks below a comfortable tap target when
    // zoomed out — scale the whole cone up (never down) so its rendered
    // radius never falls under the app's 44px minimum.
    const minRadius = minWorldRadiusForPixels(MIN_TAP_TARGET_RADIUS_PX, new THREE.Vector3(...position), camera as THREE.PerspectiveCamera, canvasSize.height)
    const scale = Math.max(1, minRadius / MOVE_HANDLE_RADIUS)
    return (
      <group position={position} scale={scale}>
        {/* Every child below is shifted up by its own half-height (scaled by
            its own local `scale`, since that's applied before the position
            offset) so its BASE — not its center — sits at this group's
            local origin. That keeps the base pinned exactly at `position`
            (the piece's surface + gap) regardless of how big `scale` grows
            when zoomed out — a centered cone would grow downward into the
            piece as it scaled up. */}
        {/* Glow halo — additive, non-interactive, drawn just behind the
            outlined cone below. Same technique as the connection markers'
            glow halos (ConnectionMarkers.tsx/AnchorMarkers.tsx): a larger,
            faint, no-depth-write duplicate for a cheap neon feel. */}
        <mesh position={[0, (MOVE_HANDLE_HEIGHT / 2) * MOVE_HANDLE_GLOW_SCALE, 0]} scale={MOVE_HANDLE_GLOW_SCALE} raycast={() => null}>
          <coneGeometry args={[MOVE_HANDLE_RADIUS, MOVE_HANDLE_HEIGHT, 12]} />
          <meshBasicMaterial color="#4a90d9" transparent opacity={0.35} blending={THREE.AdditiveBlending} depthWrite={false} depthTest={false} />
        </mesh>
        {/* Transparent fill with a crisp edge outline — the neon-border
            look, reusable for other pin-like handles if it reads well. */}
        <mesh
          position={[0, MOVE_HANDLE_HEIGHT / 2, 0]}
          onPointerDown={handleVerticalPointerDown}
          onPointerMove={handleVerticalPointerMove}
          onPointerUp={handleVerticalPointerUp}
        >
          <coneGeometry args={[MOVE_HANDLE_RADIUS, MOVE_HANDLE_HEIGHT, 12]} />
          <meshBasicMaterial color="#4a90d9" transparent opacity={0.12} depthWrite={false} />
        </mesh>
        <lineSegments position={[0, MOVE_HANDLE_HEIGHT / 2, 0]} raycast={() => null}>
          <edgesGeometry args={[new THREE.ConeGeometry(MOVE_HANDLE_RADIUS, MOVE_HANDLE_HEIGHT, 12)]} />
          <lineBasicMaterial color="#7ec8ff" />
        </lineSegments>
      </group>
    )
  }

  if (definition.geometry.shape === 'cylinder') {
    const { radius, height } = getCylinderSize(instance)
    return (
      <>
        <group ref={setGroup} position={displayPosition} rotation={instance.rotation}>
          <mesh
            rotation={[Math.PI / 2, 0, 0]}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
          >
            <cylinderGeometry args={[radius, radius, height, 16]} />
            <meshStandardMaterial
              color={color}
              polygonOffset
              polygonOffsetFactor={depthBiasFor(instance.id)}
              polygonOffsetUnits={depthBiasFor(instance.id)}
            />
          </mesh>
        </group>
        {verticalHandle([radius, radius, height / 2])}
        {showGizmo && group && (
          <TransformControls
            ref={tuneRotationGizmoRef}
            object={group}
            mode="rotate"
            space="world"
            size={getGizmoSizeMultiplier()}
            rotationSnap={ROTATION_SNAP}
            showX
            showY
            showZ
            onMouseDown={() => {
              gizmoActive.current = true
            }}
            onMouseUp={() => {
              gizmoActive.current = false
            }}
            onObjectChange={handleGizmoChange}
          />
        )}
      </>
    )
  }

  const size = getBoxSize(instance)
  return (
    <>
      <group ref={setGroup} position={displayPosition} rotation={instance.rotation}>
        <mesh
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
        >
          <boxGeometry args={size} />
          <meshStandardMaterial
            color={color}
            polygonOffset
            polygonOffsetFactor={depthBiasFor(instance.id)}
            polygonOffsetUnits={depthBiasFor(instance.id)}
          />
        </mesh>
      </group>
      {verticalHandle([size[0] / 2, size[1] / 2, size[2] / 2])}
      {showGizmo && group && (
        <TransformControls
          ref={tuneRotationGizmoRef}
          object={group}
          mode="rotate"
          space="world"
          size={getGizmoSizeMultiplier()}
          rotationSnap={ROTATION_SNAP}
          showX
          showY
          showZ
          onMouseDown={() => {
            gizmoActive.current = true
          }}
          onMouseUp={() => {
            gizmoActive.current = false
          }}
          onObjectChange={handleGizmoChange}
        />
      )}
    </>
  )
}
