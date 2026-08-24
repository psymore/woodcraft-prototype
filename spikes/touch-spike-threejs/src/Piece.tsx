import { useRef } from 'react'
import type { RefObject } from 'react'
import type { ThreeEvent } from '@react-three/fiber'
import * as THREE from 'three'
import type { ComponentDefinition, ComponentInstance } from './component'
import { getBoxSize, getCylinderSize } from './component'
import { snapValue } from './snap'

const GRID_INCREMENT = 1
const GROUND_PLANE = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0)
const EXPLODE_DISTANCE = 10

export function Piece({
  instance,
  definition,
  selected,
  onSelect,
  onMove,
  onDragStateChange,
  multiTouchActiveRef,
  explodeAmount,
  centroid,
}: {
  instance: ComponentInstance
  definition: ComponentDefinition
  selected: boolean
  onSelect: (id: string) => void
  onMove: (id: string, position: [number, number, number]) => void
  onDragStateChange: (dragging: boolean) => void
  multiTouchActiveRef: RefObject<boolean>
  explodeAmount: number
  centroid: [number, number, number]
}) {
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
    onSelect(instance.id)
    dragging.current = true
    onDragStateChange(true)
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
    onMove(instance.id, [snappedX, instance.position[1], snappedZ])
  }

  const handlePointerUp = (e: ThreeEvent<PointerEvent>) => {
    dragging.current = false
    onDragStateChange(false)
    ;(e.target as Element).releasePointerCapture(e.pointerId)
  }

  const color = selected ? '#ffb347' : instance.material
  const yaw = instance.rotation[1]

  const dx = instance.position[0] - centroid[0]
  const dy = instance.position[1] - centroid[1]
  const dz = instance.position[2] - centroid[2]
  const len = Math.sqrt(dx * dx + dy * dy + dz * dz) || 1
  const displayPosition: [number, number, number] =
    explodeAmount > 0
      ? [
          instance.position[0] + (dx / len) * explodeAmount * EXPLODE_DISTANCE,
          instance.position[1] + (dy / len) * explodeAmount * EXPLODE_DISTANCE,
          instance.position[2] + (dz / len) * explodeAmount * EXPLODE_DISTANCE,
        ]
      : instance.position

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
