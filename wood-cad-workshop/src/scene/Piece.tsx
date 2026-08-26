import { useRef } from 'react'
import type { RefObject } from 'react'
import type { ThreeEvent } from '@react-three/fiber'
import { useThree } from '@react-three/fiber'
import * as THREE from 'three'
import type { ComponentDefinition, ComponentInstance } from '../engine'
import { getBoxSize, getCylinderSize, getExplodedPosition, snapValue } from '../engine'
import { useSceneSession } from '../store/sceneSessionStore'

const GRID_INCREMENT = 1
const GROUND_PLANE = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0)
const HANDLE_GAP = 0.5

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
  const camera = useThree((s) => s.camera)

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

  const color = selected ? '#ffb347' : instance.material
  const yaw = instance.rotation[1]
  const displayPosition = getExplodedPosition(instance.position, centroid, explodeAmount)

  const showVerticalHandle = selected && explodeAmount === 0

  const verticalHandle = (topY: number) =>
    showVerticalHandle && (
      <mesh
        position={[displayPosition[0], topY + HANDLE_GAP, displayPosition[2]]}
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
        <mesh
          position={displayPosition}
          rotation={[Math.PI / 2, yaw, 0]}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
        >
          <cylinderGeometry args={[radius, radius, height, 16]} />
          <meshStandardMaterial color={color} />
        </mesh>
        {verticalHandle(displayPosition[1] + height / 2)}
      </>
    )
  }

  const size = getBoxSize(instance)
  return (
    <>
      <mesh
        position={displayPosition}
        rotation={[0, yaw, 0]}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
      >
        <boxGeometry args={size} />
        <meshStandardMaterial color={color} />
      </mesh>
      {verticalHandle(displayPosition[1] + size[1] / 2)}
    </>
  )
}
