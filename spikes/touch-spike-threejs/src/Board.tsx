import { useRef, useState } from 'react'
import type { ThreeEvent } from '@react-three/fiber'
import * as THREE from 'three'
import type { ComponentDefinition, ComponentInstance } from './component'
import { getBoxSize } from './component'
import { snapValue } from './snap'

const GRID_INCREMENT = 1
const GROUND_PLANE = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0)

export function Board({
  instance,
  definition,
  selected,
  onSelect,
  onDragStateChange,
}: {
  instance: ComponentInstance
  definition: ComponentDefinition
  selected: boolean
  onSelect: (id: string) => void
  onDragStateChange: (dragging: boolean) => void
}) {
  const [pos, setPos] = useState(instance.position)
  const dragging = useRef(false)
  const dragOffset = useRef<[number, number]>([0, 0])

  const groundHit = (ray: THREE.Ray): THREE.Vector3 | null => {
    const target = new THREE.Vector3()
    return ray.intersectPlane(GROUND_PLANE, target)
  }

  const handlePointerDown = (e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation()
    ;(e.target as Element).setPointerCapture(e.pointerId)
    onSelect(instance.id)
    dragging.current = true
    onDragStateChange(true)
    const hit = groundHit(e.ray)
    dragOffset.current = hit ? [pos[0] - hit.x, pos[2] - hit.z] : [0, 0]
  }

  const handlePointerMove = (e: ThreeEvent<PointerEvent>) => {
    if (!dragging.current) return
    // Deliberately e.ray, not e.point: once the pointer is captured,
    // e.point/e.object replay a stale intersection from pick time if the
    // live raycast no longer hits this mesh. e.ray is always live.
    const hit = groundHit(e.ray)
    if (!hit) return
    const [offsetX, offsetZ] = dragOffset.current
    const snappedX = snapValue(hit.x + offsetX, GRID_INCREMENT)
    const snappedZ = snapValue(hit.z + offsetZ, GRID_INCREMENT)
    setPos([snappedX, pos[1], snappedZ])
  }

  const handlePointerUp = (e: ThreeEvent<PointerEvent>) => {
    dragging.current = false
    onDragStateChange(false)
    ;(e.target as Element).releasePointerCapture(e.pointerId)
  }

  const size = getBoxSize(instance)
  void definition // threaded through for future sub-projects (materials, geometry variants); unused this phase beyond its instance override

  return (
    <mesh
      position={pos}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
    >
      <boxGeometry args={size} />
      <meshStandardMaterial color={selected ? '#ffb347' : instance.material} />
    </mesh>
  )
}
