import { useState } from 'react'
import { Board } from './Board'
import { BOARD_DEFINITION, INITIAL_BOARD_INSTANCES } from './component'
import type { ComponentInstance } from './component'

export function Scene({
  onDragStateChange,
}: {
  onDragStateChange: (dragging: boolean) => void
}) {
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [instances] = useState<ComponentInstance[]>(INITIAL_BOARD_INSTANCES)

  return (
    <>
      <ambientLight intensity={0.6} />
      <directionalLight position={[10, 20, 10]} intensity={0.8} />
      <gridHelper args={[120, 120, '#808080', '#808080']} />
      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        onPointerDown={() => setSelectedId(null)}
      >
        <planeGeometry args={[120, 120]} />
        <meshStandardMaterial transparent opacity={0} />
      </mesh>
      {instances.map((instance) => (
        <Board
          key={instance.id}
          instance={instance}
          definition={BOARD_DEFINITION}
          selected={selectedId === instance.id}
          onSelect={setSelectedId}
          onDragStateChange={onDragStateChange}
        />
      ))}
    </>
  )
}
