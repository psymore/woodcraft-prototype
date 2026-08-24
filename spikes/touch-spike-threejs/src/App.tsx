import { useRef, useState } from 'react'
import type { ComponentRef, PointerEvent as ReactPointerEvent } from 'react'
import { Canvas } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import * as THREE from 'three'
import { Scene } from './Scene'
import { ViewControls } from './ViewControls'
import { Inventory } from './Inventory'
import { PieceControls } from './PieceControls'
import { Inspector } from './Inspector'
import { ExplodedView } from './ExplodedView'
import { getViewPreset } from './viewPresets'
import type { ViewName } from './viewPresets'
import { computeBounds } from './framing'
import { INITIAL_BOARD_INSTANCES, PULLUP_KIT_DEFINITIONS, createInstance, getDefinition } from './component'
import type { ComponentDefinition, ComponentInstance, Dimensions } from './component'
import { findConnectionSnapDelta } from './snapConnections'

function App() {
  const [isDraggingPiece, setIsDraggingPiece] = useState(false)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [instances, setInstances] = useState<ComponentInstance[]>(INITIAL_BOARD_INSTANCES)
  const [inventoryOpen, setInventoryOpen] = useState(false)
  const [explodeAmount, setExplodeAmount] = useState(0)
  const controlsRef = useRef<ComponentRef<typeof OrbitControls>>(null)

  // A piece-drag captures one finger's pointer events, which would otherwise
  // keep OrbitControls disabled (see `enabled={!isDraggingPiece}` below) even
  // after a second finger joins for a pinch/pan gesture. Tracking active
  // touch pointers lets us hand control back to OrbitControls the moment a
  // second finger touches down, mirroring the Godot side's
  // `active_touches.size() == 2` check in `_on_touch_begin`.
  const activeTouchesRef = useRef<Set<number>>(new Set())
  const multiTouchActiveRef = useRef(false)

  const handlePointerDownCapture = (e: ReactPointerEvent) => {
    if (e.pointerType !== 'touch') return
    activeTouchesRef.current.add(e.pointerId)
    if (activeTouchesRef.current.size >= 2) {
      multiTouchActiveRef.current = true
      setIsDraggingPiece(false)
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
    const direction = new THREE.Vector3()
      .subVectors(camera.position, controls.target)
      .normalize()
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

  const handleAddComponent = (definition: ComponentDefinition) => {
    setInstances((prev) => [...prev, createInstance(definition)])
  }

  const handleMove = (id: string, position: [number, number, number]) => {
    setInstances((prev) => {
      const moving = prev.find((i) => i.id === id)
      if (!moving) return prev
      const delta = findConnectionSnapDelta(moving, position, prev)
      const finalPosition: [number, number, number] = delta
        ? [position[0] + delta[0], position[1] + delta[1], position[2] + delta[2]]
        : position
      return prev.map((i) => (i.id === id ? { ...i, position: finalPosition } : i))
    })
  }

  const handleAddPullupKit = () => {
    setInstances((prev) => [...prev, ...PULLUP_KIT_DEFINITIONS.map((def) => createInstance(def))])
  }

  const handleRotateSelected = () => {
    setInstances((prev) =>
      prev.map((i) =>
        i.id === selectedId
          ? { ...i, rotation: [i.rotation[0], i.rotation[1] + Math.PI / 2, i.rotation[2]] }
          : i,
      ),
    )
  }

  const handleDuplicateSelected = () => {
    const selected = instances.find((i) => i.id === selectedId)
    if (!selected) return
    const duplicate: ComponentInstance = {
      ...selected,
      id: `${selected.componentDefinitionId}-${Date.now()}`,
      position: [selected.position[0] + 2, selected.position[1], selected.position[2] + 2],
    }
    setInstances((prev) => [...prev, duplicate])
    setSelectedId(duplicate.id)
  }

  const handleDeleteSelected = () => {
    setInstances((prev) => prev.filter((i) => i.id !== selectedId))
    setSelectedId(null)
  }

  const handleChangeDimensions = (id: string, dimensions: Dimensions) => {
    setInstances((prev) => prev.map((i) => (i.id === id ? { ...i, dimensions } : i)))
  }

  const centroid: [number, number, number] =
    instances.length === 0
      ? [0, 0, 0]
      : [
          instances.reduce((sum, i) => sum + i.position[0], 0) / instances.length,
          instances.reduce((sum, i) => sum + i.position[1], 0) / instances.length,
          instances.reduce((sum, i) => sum + i.position[2], 0) / instances.length,
        ]

  const selectedInstance = instances.find((i) => i.id === selectedId) ?? null
  const selectedDefinition = selectedInstance ? getDefinition(selectedInstance.componentDefinitionId) : null

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
    <div
      style={{ width: '100vw', height: '100vh', touchAction: 'none' }}
      onPointerDownCapture={handlePointerDownCapture}
      onPointerUpCapture={handlePointerUpCapture}
      onPointerCancelCapture={handlePointerUpCapture}
    >
      <Canvas camera={{ position: [0, 20, 25], fov: 50, near: 0.5, far: 500 }}>
        <Scene
          instances={instances}
          onDragStateChange={setIsDraggingPiece}
          onSelectionChange={setSelectedId}
          onMove={handleMove}
          multiTouchActiveRef={multiTouchActiveRef}
          explodeAmount={explodeAmount}
          centroid={centroid}
        />
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
      <Inventory open={inventoryOpen} onToggle={() => setInventoryOpen((o) => !o)} onAdd={handleAddComponent} />
      <button
        onClick={handleAddPullupKit}
        style={{ position: 'absolute', bottom: 8, right: 146, minWidth: 44, minHeight: 44, zIndex: 1 }}
      >
        PULL-UP KIT
      </button>
      <ExplodedView amount={explodeAmount} onChange={setExplodeAmount} />
      <PieceControls
        hasSelection={selectedId !== null}
        onRotate={handleRotateSelected}
        onDuplicate={handleDuplicateSelected}
        onDelete={handleDeleteSelected}
      />
      <Inspector
        instance={selectedInstance}
        definition={selectedDefinition}
        onChangeDimensions={handleChangeDimensions}
      />
    </div>
  )
}

export default App
