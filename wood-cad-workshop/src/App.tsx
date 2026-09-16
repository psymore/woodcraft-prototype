import { Suspense, useEffect, useRef, useState } from 'react'
import type { ComponentRef, PointerEvent as ReactPointerEvent } from 'react'
import { Canvas } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import * as THREE from 'three'
import { Scene } from './scene/Scene'
import { MainMenu } from './ui/MainMenu'
import { InventorySheet } from './ui/Inventory'
import { Inspector } from './ui/Inspector'
import { GizmoToggles } from './ui/GizmoToggles'
import { ConnectionHint } from './ui/ConnectionHint'
import { ThemeToggle } from './ui/ThemeToggle'
import { readTheme, writeTheme } from './ui/theme'
import type { Theme } from './ui/theme'
import { getViewPreset, computeInstanceBounds } from './engine'
import type { ComponentInstance, ViewName } from './engine'
import { useSceneSession } from './store/sceneSessionStore'

function App() {
  const isDraggingPiece = useSceneSession((s) => s.isDraggingPiece)
  const instances = useSceneSession((s) => s.instances)
  const selectedId = useSceneSession((s) => s.selectedId)
  const controlsRef = useRef<ComponentRef<typeof OrbitControls>>(null)
  const [theme, setTheme] = useState<Theme>(readTheme)

  // Reflected onto <html> (not just a component-local class) so the
  // data-theme selector in index.css can override :root's own custom
  // properties — every panel already reads those vars, so this one
  // attribute is what actually flips the whole app's look.
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
  }, [theme])

  const toggleTheme = () => {
    setTheme((prev) => {
      const next: Theme = prev === 'dark' ? 'light' : 'dark'
      writeTheme(next)
      return next
    })
  }

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

  const frame = (pieces: ComponentInstance[]) => {
    const controls = controlsRef.current
    if (!controls) return
    const camera = controls.object as THREE.PerspectiveCamera
    const { center, radius } = computeInstanceBounds(pieces)
    // Explicitly mirrors OrbitControls' own maxDistance={300} below —
    // belt-and-suspenders so `distance` accurately reflects where the
    // camera will actually end up, rather than relying solely on
    // OrbitControls' internal clamp during controls.update().
    const distance = Math.min(Math.max(radius * 2.5, 10), 300)
    const direction = new THREE.Vector3().subVectors(camera.position, controls.target).normalize()
    controls.target.set(...center)
    camera.position.copy(controls.target).addScaledVector(direction, distance)
    camera.lookAt(controls.target)
    controls.update()
  }

  const handleFrameAll = () => frame(instances)
  const handleFrameSelected = () => {
    const selected = instances.find((i) => i.id === selectedId)
    if (selected) frame([selected])
  }

  // The initial camera position below is a fixed guess, unrelated to what's
  // actually loaded — a long piece can start tiny/off-center, making the
  // first orbit gesture harder than it should be. Frame to the real bounds
  // once, the first time there's something to frame, instead of relying on
  // that fixed position as the default view. Runs only once (not on every
  // instances change) so it doesn't fight a user's manual zoom/pan mid-session.
  const hasFramedInitialViewRef = useRef(false)
  useEffect(() => {
    if (hasFramedInitialViewRef.current || instances.length === 0) return
    frame(instances)
    hasFramedInitialViewRef.current = true
  }, [instances])

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
        {/* Outermost safety net only — without SOME boundary here, an
            uncaught suspense (e.g. the very first texture load, before any
            piece exists to own it) would throw all the way past Canvas.
            Piece.tsx's WoodMaterial owns its own per-piece Suspense with a
            flat-color fallback, so an in-session species change never
            reaches this one and blanks the whole scene. */}
        <Suspense fallback={null}>
          <Scene multiTouchActiveRef={multiTouchActiveRef} />
        </Suspense>
        <OrbitControls
          ref={controlsRef}
          makeDefault
          enabled={!isDraggingPiece}
          onStart={handleOrbitStart}
          minDistance={1.5}
          maxDistance={300}
        />
      </Canvas>
      <MainMenu
        onSelectView={handleSelectView}
        onFrameAll={handleFrameAll}
        onFrameSelected={handleFrameSelected}
      />
      <InventorySheet />
      <div
        style={{
          position: 'absolute',
          top: 'max(8px, env(safe-area-inset-top))',
          right: 'max(8px, env(safe-area-inset-right))',
          zIndex: 1,
        }}
      >
        <Inspector />
      </div>
      <GizmoToggles />
      <ConnectionHint />
      <ThemeToggle theme={theme} onToggle={toggleTheme} />
    </div>
  )
}

export default App
