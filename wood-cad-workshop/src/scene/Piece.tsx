import { useRef } from 'react'
import type { RefObject } from 'react'
import type { ThreeEvent } from '@react-three/fiber'
import * as THREE from 'three'
import type { ComponentDefinition, ComponentInstance } from '../engine'
import { getBoxSize, getCylinderSize, getExplodedPosition, snapValue } from '../engine'
import { useSceneSession } from '../store/sceneSessionStore'

const GRID_INCREMENT = 1
const GROUND_PLANE = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0)

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

  const dragging = useRef(false)
  const dragOffset = useRef<[number, number]>([0, 0])

  const groundHit = (ray: THREE.Ray): THREE.Vector3 | null => {
    const target = new THREE.Vector3()
    return ray.intersectPlane(GROUND_PLANE, target)
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

  if (definition.geometry.shape === 'cylinder') {
    const { radius, height } = getCylinderSize(instance)
    return (
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
    )
  }

  const size = getBoxSize(instance)
  return (
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
  )
}
