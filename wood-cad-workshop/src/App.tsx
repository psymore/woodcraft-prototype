import { useRef } from 'react'
import type { ComponentRef, PointerEvent as ReactPointerEvent } from 'react'
import { Canvas } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import * as THREE from 'three'
import { Scene } from './scene/Scene'
import { ViewControls } from './ui/ViewControls'
import { Inventory } from './ui/Inventory'
import { PieceControls } from './ui/PieceControls'
import { Inspector } from './ui/Inspector'
import { ExplodedView } from './ui/ExplodedView'
import { PullupKitButton } from './ui/PullupKitButton'
import { getViewPreset, computeBounds } from './engine'
import type { ViewName } from './engine'
import { useSceneSession } from './store/sceneSessionStore'

function App() {
  const isDraggingPiece = useSceneSession((s) => s.isDraggingPiece)
  const instances = useSceneSession((s) => s.instances)
  const selectedId = useSceneSession((s) => s.selectedId)
  const controlsRef = useRef<ComponentRef<typeof OrbitControls>>(null)

  // A piece-drag captures one finger's pointer events, which would otherwise
  // keep OrbitControls disabled (see `enabled={!isDraggingPiece}` below) even
  // after a second finger joins for a pinch/pan gesture. Tracking active
  // touch pointers lets Piece hand control back to OrbitControls the moment
  // a second finger touches down (see Piece.tsx's multiTouchActiveRef guard).
  const activeTouchesRef = useRef<Set<number>>(new Set())
  const multiTouchActiveRef = useRef(false)

  const handlePointerDownCapture = (e: ReactPointerEvent) => {
    if (e.pointerType !== 'touch') return
    activeTouchesRef.current.add(e.pointerId)
    if (activeTouchesRef.current.size >= 2) {
      multiTouchActiveRef.current = true
      useSceneSession.getState().setDraggingPiece(false)
    }
  }

  const handlePointerUpCapture = (e: ReactPointerEvent) => {
    if (e.pointerType !== 'touch') return
    activeTouchesRef.current.delete(e.pointerId)
    if (activeTouchesRef.current.size === 0) {
      multiTouchActiveRef.current = false
    }
  }

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
    const direction = new THREE.Vector3().subVectors(camera.position, controls.target).normalize()
    controls.target.set(...center)
    camera.position.copy(controls.target).addScaledVector(direction, distance)
    camera.lookAt(controls.target)
    controls.update()
  }

  const handleFrameAll = () => frame(instances.map((i) => i.position))
  const handleFrameSelected = () => {
    const selected = instances.find((i) => i.id === selectedId)
    if (selected) frame([selected.position])
  }

  // OrbitControls computes its internal up-alignment quaternion once, in its
  // constructor, from camera.up — it never recomputes it afterward. If a
  // TOP/BOTTOM preset click left camera.up at (0,0,-1)/(0,0,1), a later
  // orbit-drag would keep using that stale quaternion while camera.up itself
  // stayed non-standard, drifting the horizon roughly 90 degrees for the rest
  // of the gesture. Resetting camera.up back to (0,1,0) at the start of every
  // new orbit-drag gesture (before OrbitControls processes it) avoids the
  // mismatch.
  const handleOrbitStart = () => {
    const controls = controlsRef.current
    if (!controls) return
    ;(controls.object as THREE.PerspectiveCamera).up.set(0, 1, 0)
  }

  return (
    <div
      style={{ width: '100vw', height: '100vh', touchAction: 'none' }}
      onPointerDownCapture={handlePointerDownCapture}
      onPointerUpCapture={handlePointerUpCapture}
      onPointerCancelCapture={handlePointerUpCapture}
    >
      <Canvas camera={{ position: [0, 20, 25], fov: 50, near: 0.5, far: 500 }}>
        <Scene multiTouchActiveRef={multiTouchActiveRef} />
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
      />
      <Inventory />
      <PullupKitButton />
      <div
        style={{
          position: 'absolute',
          top: 8,
          right: 8,
          display: 'flex',
          flexDirection: 'column',
          gap: 8,
          zIndex: 1,
        }}
      >
        <PieceControls />
        <Inspector />
      </div>
      <ExplodedView />
    </div>
  )
}

export default App
