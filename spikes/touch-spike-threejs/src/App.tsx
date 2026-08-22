import { useRef, useState } from 'react'
import type { ComponentRef } from 'react'
import { Canvas } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import * as THREE from 'three'
import { Scene } from './Scene'
import { ViewControls } from './ViewControls'
import { getViewPreset } from './viewPresets'
import type { ViewName } from './viewPresets'
import { computeBounds } from './framing'
import { INITIAL_BOARD_INSTANCES } from './component'

function App() {
  const [isDraggingPiece, setIsDraggingPiece] = useState(false)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const controlsRef = useRef<ComponentRef<typeof OrbitControls>>(null)

  const applyCameraState = (position: [number, number, number], up: [number, number, number]) => {
    const controls = controlsRef.current
    if (!controls) return
    const camera = controls.object as THREE.PerspectiveCamera
    camera.up.set(...up)
    camera.position.set(...position)
    camera.lookAt(controls.target)
    controls.update()
  }

  const handleSelectView = (view: ViewName) => {
    const preset = getViewPreset(view)
    applyCameraState(preset.position, preset.up)
  }

  const frame = (positions: Array<[number, number, number]>) => {
    const controls = controlsRef.current
    if (!controls) return
    const camera = controls.object as THREE.PerspectiveCamera
    const { center, radius } = computeBounds(positions)
    const distance = Math.max(radius * 2.5, 10)
    const direction = new THREE.Vector3()
      .subVectors(camera.position, controls.target)
      .normalize()
    controls.target.set(...center)
    camera.position.copy(controls.target).addScaledVector(direction, distance)
    camera.lookAt(controls.target)
    controls.update()
  }

  const handleFrameAll = () => frame(INITIAL_BOARD_INSTANCES.map((i) => i.position))
  const handleFrameSelected = () => {
    const selected = INITIAL_BOARD_INSTANCES.find((i) => i.id === selectedId)
    if (selected) frame([selected.position])
  }

  return (
    <div style={{ width: '100vw', height: '100vh', touchAction: 'none' }}>
      <Canvas camera={{ position: [0, 20, 25], fov: 50 }}>
        <Scene onDragStateChange={setIsDraggingPiece} onSelectionChange={setSelectedId} />
        <OrbitControls ref={controlsRef} makeDefault enabled={!isDraggingPiece} />
      </Canvas>
      <ViewControls
        onSelectView={handleSelectView}
        onFrameAll={handleFrameAll}
        onFrameSelected={handleFrameSelected}
        hasSelection={selectedId !== null}
      />
    </div>
  )
}

export default App
