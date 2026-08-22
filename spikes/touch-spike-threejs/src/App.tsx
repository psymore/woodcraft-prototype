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

  // OrbitControls computes its internal up-alignment quaternion once, in its
  // constructor, from camera.up — it never recomputes it afterward. If a
  // TOP/BOTTOM preset click left camera.up at (0,0,-1)/(0,0,1), a later
  // orbit-drag would keep using that stale quaternion while camera.up itself
  // stayed non-standard, drifting the horizon roughly 90 degrees for the rest
  // of the gesture. Resetting camera.up back to (0,1,0) at the start of every
  // new orbit-drag gesture (before OrbitControls processes it) avoids the
  // mismatch, mirroring the Godot side's `camera_up = Vector3.UP` reset in
  // `_on_touch_begin`.
  const handleOrbitStart = () => {
    const controls = controlsRef.current
    if (!controls) return
    ;(controls.object as THREE.PerspectiveCamera).up.set(0, 1, 0)
  }

  return (
    <div style={{ width: '100vw', height: '100vh', touchAction: 'none' }}>
      <Canvas camera={{ position: [0, 20, 25], fov: 50 }}>
        <Scene onDragStateChange={setIsDraggingPiece} onSelectionChange={setSelectedId} />
        <OrbitControls
          ref={controlsRef}
          makeDefault
          enabled={!isDraggingPiece}
          onStart={handleOrbitStart}
        />
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
