import { useState } from 'react'
import type { RefObject } from 'react'
import { DoubleSide } from 'three'
import { Grid } from '@react-three/drei'
import { Piece } from './Piece'
import { getDefinition } from './component'
import type { ComponentInstance } from './component'

export function Scene({
  instances,
  onSelectionChange,
  onDragStateChange,
  onMove,
  multiTouchActiveRef,
  explodeAmount,
  centroid,
}: {
  instances: ComponentInstance[]
  onSelectionChange: (id: string | null) => void
  onDragStateChange: (dragging: boolean) => void
  onMove: (id: string, position: [number, number, number]) => void
  multiTouchActiveRef: RefObject<boolean>
  explodeAmount: number
  centroid: [number, number, number]
}) {
  const [selectedId, setSelectedId] = useState<string | null>(null)

  const select = (id: string | null) => {
    setSelectedId(id)
    onSelectionChange(id)
  }

  return (
    <>
      <ambientLight intensity={0.6} />
      <directionalLight position={[10, 20, 10]} intensity={0.8} />
      <Grid
        args={[120, 120]}
        position={[0, -0.02, 0]}
        cellSize={1}
        cellColor="#6b6b6b"
        cellThickness={1.5}
        sectionSize={0}
        fadeDistance={200}
        side={DoubleSide}
      />
      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        onPointerDown={() => select(null)}
      >
        <planeGeometry args={[120, 120]} />
        <meshStandardMaterial transparent opacity={0} />
      </mesh>
      {instances.map((instance) => (
        <Piece
          key={instance.id}
          instance={instance}
          definition={getDefinition(instance.componentDefinitionId)}
          selected={selectedId === instance.id}
          onSelect={select}
          onMove={onMove}
          onDragStateChange={onDragStateChange}
          multiTouchActiveRef={multiTouchActiveRef}
          explodeAmount={explodeAmount}
          centroid={centroid}
        />
      ))}
    </>
  )
}
