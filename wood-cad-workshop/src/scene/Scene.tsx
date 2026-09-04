import type { RefObject } from 'react'
import { DoubleSide } from 'three'
import { Grid } from '@react-three/drei'
import { Piece } from './Piece'
import { ConnectionMarkers } from './ConnectionMarkers'
import { AnchorMarkers } from './AnchorMarkers'
import { getComponent, computeCentroid } from '../engine'
import { useSceneSession } from '../store/sceneSessionStore'

export function Scene({ multiTouchActiveRef }: { multiTouchActiveRef: RefObject<boolean> }) {
  const instances = useSceneSession((s) => s.instances)
  const selectPiece = useSceneSession((s) => s.selectPiece)
  const centroid = computeCentroid(instances)

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
      <mesh rotation={[-Math.PI / 2, 0, 0]} onPointerDown={() => selectPiece(null)}>
        <planeGeometry args={[120, 120]} />
        <meshStandardMaterial transparent opacity={0} />
      </mesh>
      {instances.map((instance) => (
        <Piece
          key={instance.id}
          instance={instance}
          definition={getComponent(instance.componentDefinitionId)}
          centroid={centroid}
          multiTouchActiveRef={multiTouchActiveRef}
        />
      ))}
      <ConnectionMarkers />
      <AnchorMarkers />
    </>
  )
}
