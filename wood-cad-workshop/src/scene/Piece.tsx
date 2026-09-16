import { useRef, useState } from 'react'
import type { RefObject } from 'react'
import type { ThreeEvent } from '@react-three/fiber'
import { useThree } from '@react-three/fiber'
import { TransformControls } from '@react-three/drei'
import * as THREE from 'three'
import type { ComponentDefinition, ComponentInstance } from '../engine'
import { depthBiasFor, getBoxSize, getCylinderSize, getExplodedPosition, snapValue } from '../engine'
import { useSceneSession } from '../store/sceneSessionStore'
import { MIN_TAP_TARGET_RADIUS_PX, minWorldRadiusForPixels, worldRadiusToPixels } from './screenSpace'

const GRID_INCREMENT = 1
const GROUND_PLANE = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0)
const HANDLE_GAP = 0.5
const ROTATION_SNAP = THREE.MathUtils.degToRad(15)
const MOVE_HANDLE_RADIUS = 0.6
const ROTATE_PICKER_SCALE = 2

// Called via TransformControls' ref when the rotate gizmo mounts. Removes
// the free-rotate ("E", yellow) ring — a fourth ring outside the piece's
// actual X/Y/Z axes that mostly just gets in the way — and enlarges the
// invisible hit-test torus for the X/Y/Z rings (a separate mesh from the
// thin visible ring line, and not otherwise adjustable via TransformControls
// props) so they're easier to grab.
function tuneRotationGizmo(controls: THREE.Object3D | null) {
  if (!controls) return
  const eRings: THREE.Object3D[] = []
  controls.traverse((child) => {
    if (child.name === 'E') eRings.push(child)
  })
  eRings.forEach((child) => child.parent?.remove(child))

  controls.traverse((child) => {
    if (
      (child.name === 'X' || child.name === 'Y' || child.name === 'Z') &&
      child instanceof THREE.Mesh &&
      child.geometry instanceof THREE.TorusGeometry
    ) {
      child.scale.setScalar(ROTATE_PICKER_SCALE)
    }
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

  const color = selected ? '#ffb347' : instance.material
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
  // pixels and scales it up (never down) to clear the minimum.
  const getGizmoSizeMultiplier = () => {
    if (!showGizmo) return 1
    const cam = camera as THREE.PerspectiveCamera
    const worldPosition = new THREE.Vector3(...displayPosition)
    const currentPixels = worldRadiusToPixels(getGizmoOuterRadius(), worldPosition, cam, canvasSize.height)
    if (currentPixels <= 0) return 1
    return Math.max(1, MIN_TAP_TARGET_RADIUS_PX / currentPixels)
  }

  const verticalHandle = (halfExtents: [number, number, number]) => {
    if (!showVerticalHandle) return null
    const position: [number, number, number] = [
      displayPosition[0],
      displayPosition[1] + Math.max(getVerticalExtent(halfExtents), getGizmoOuterRadius()) + HANDLE_GAP,
      displayPosition[2],
    ]
    // Fixed world-unit geometry shrinks below a comfortable tap target when
    // zoomed out — scale the whole cone up (never down) so its rendered
    // radius never falls under the app's 44px minimum.
    const minRadius = minWorldRadiusForPixels(MIN_TAP_TARGET_RADIUS_PX, new THREE.Vector3(...position), camera as THREE.PerspectiveCamera, canvasSize.height)
    const scale = Math.max(1, minRadius / MOVE_HANDLE_RADIUS)
    return (
      <mesh
        position={position}
        scale={scale}
        onPointerDown={handleVerticalPointerDown}
        onPointerMove={handleVerticalPointerMove}
        onPointerUp={handleVerticalPointerUp}
      >
        <coneGeometry args={[MOVE_HANDLE_RADIUS, 1.2, 12]} />
        <meshStandardMaterial color="#4a90d9" />
      </mesh>
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
            ref={tuneRotationGizmo}
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
          ref={tuneRotationGizmo}
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
