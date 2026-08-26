import { useRef, useState } from 'react'
import type { RefObject } from 'react'
import type { ThreeEvent } from '@react-three/fiber'
import { useThree } from '@react-three/fiber'
import { TransformControls } from '@react-three/drei'
import * as THREE from 'three'
import type { ComponentDefinition, ComponentInstance } from '../engine'
import { getBoxSize, getCylinderSize, getExplodedPosition, snapValue } from '../engine'
import { useSceneSession } from '../store/sceneSessionStore'

const GRID_INCREMENT = 1
const GROUND_PLANE = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0)
const HANDLE_GAP = 0.5
const ROTATION_SNAP = THREE.MathUtils.degToRad(15)

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
  const camera = useThree((s) => s.camera)

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
    if (!verticalDragging.current || multiTouchActiveRef.current) return
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
    if (!dragging.current || multiTouchActiveRef.current) return
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

  const showVerticalHandle = selected && explodeAmount === 0
  const showGizmo = selected && explodeAmount === 0

  // The handle is a SIBLING of the rotating group, so it stays in world space:
  // pieces can now pitch/roll, and a child at local +Y would swing off to the
  // side while its drag logic still moves along world Y. Using the largest
  // dimension as a half-extent is deliberately a slight over-estimate — it is
  // always above the piece whatever the current rotation is.
  const maxHalfExtent = Math.max(...Object.values(instance.dimensions)) / 2

  const verticalHandle = () =>
    showVerticalHandle && (
      <mesh
        position={[
          displayPosition[0],
          displayPosition[1] + maxHalfExtent + HANDLE_GAP,
          displayPosition[2],
        ]}
        onPointerDown={handleVerticalPointerDown}
        onPointerMove={handleVerticalPointerMove}
        onPointerUp={handleVerticalPointerUp}
      >
        <coneGeometry args={[0.15, 0.3, 12]} />
        <meshStandardMaterial color="#4a90d9" />
      </mesh>
    )

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
            <meshStandardMaterial color={color} />
          </mesh>
        </group>
        {verticalHandle()}
        {showGizmo && group && (
          <TransformControls
            object={group}
            mode="rotate"
            space="world"
            rotationSnap={ROTATION_SNAP}
            showX
            showY
            showZ
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
          <meshStandardMaterial color={color} />
        </mesh>
      </group>
      {verticalHandle()}
      {showGizmo && group && (
        <TransformControls
          object={group}
          mode="rotate"
          space="world"
          rotationSnap={ROTATION_SNAP}
          showX
          showY
          showZ
          onObjectChange={handleGizmoChange}
        />
      )}
    </>
  )
}
