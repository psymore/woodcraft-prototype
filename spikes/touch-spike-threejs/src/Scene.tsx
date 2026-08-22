import { useState } from 'react'
import { Board } from './Board'

export type BoardData = {
  id: string
  size: [number, number, number] // width, height, depth (Three.js BoxGeometry order)
  position: [number, number, number]
  color: string
}

export const BOARDS: BoardData[] = [
  { id: 'board-a', size: [1.5, 3.5, 48], position: [-6, 1.75, 0], color: '#a6693f' },
  { id: 'board-b', size: [1.5, 3.5, 36], position: [6, 1.75, 0], color: '#8c5730' },
]

export function Scene() {
  const [selectedId, setSelectedId] = useState<string | null>(null)

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
      {BOARDS.map((board) => (
        <Board
          key={board.id}
          data={board}
          selected={selectedId === board.id}
          onSelect={setSelectedId}
        />
      ))}
    </>
  )
}
