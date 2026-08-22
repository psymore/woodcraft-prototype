import { useRef, useState } from 'react'
import type { ThreeEvent } from '@react-three/fiber'
import * as THREE from 'three'
import type { BoardData } from './Scene'
import { snapValue } from './snap'

const GRID_INCREMENT = 1
const GROUND_PLANE = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0)

export function Board({
  data,
  selected,
  onSelect,
}: {
  data: BoardData
  selected: boolean
  onSelect: (id: string) => void
}) {
  const [pos, setPos] = useState(data.position)
  const dragging = useRef(false)
  const dragOffset = useRef<[number, number]>([0, 0])

  const groundHit = (ray: THREE.Ray): THREE.Vector3 | null => {
    const target = new THREE.Vector3()
    return ray.intersectPlane(GROUND_PLANE, target)
  }

  const handlePointerDown = (e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation()
    ;(e.target as Element).setPointerCapture(e.pointerId)
    onSelect(data.id)
    dragging.current = true
    const hit = groundHit(e.ray)
    dragOffset.current = hit ? [pos[0] - hit.x, pos[2] - hit.z] : [0, 0]
  }

  const handlePointerMove = (e: ThreeEvent<PointerEvent>) => {
    if (!dragging.current) return
    // Deliberately e.ray, not e.point: once the pointer is captured,
    // e.point/e.object replay a stale intersection from pick time if the
    // live raycast no longer hits this mesh. e.ray is always live. See
    // this plan's Verified Environment Notes for why.
    const hit = groundHit(e.ray)
    if (!hit) return
    const [offsetX, offsetZ] = dragOffset.current
    const snappedX = snapValue(hit.x + offsetX, GRID_INCREMENT)
    const snappedZ = snapValue(hit.z + offsetZ, GRID_INCREMENT)
    setPos([snappedX, pos[1], snappedZ])
  }

  const handlePointerUp = (e: ThreeEvent<PointerEvent>) => {
    dragging.current = false
    ;(e.target as Element).releasePointerCapture(e.pointerId)
  }

  return (
    <mesh
      position={pos}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
    >
      <boxGeometry args={data.size} />
      <meshStandardMaterial color={selected ? '#ffb347' : data.color} />
    </mesh>
  )
}
