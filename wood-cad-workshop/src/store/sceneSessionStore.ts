import { create } from 'zustand'
// Note: this store is app state, not `engine/core` — the "no three import"
// purity constraint applies only to `engine/core/*`.
import * as THREE from 'three'
import type { ComponentDefinition, ComponentInstance, Dimensions } from '../engine'
import {
  createInstance,
  createPullupKitInstances,
  createSeedInstances,
  findConnectionSnapDelta,
  getComponent,
} from '../engine'

interface SceneSessionState {
  instances: ComponentInstance[]
  selectedId: string | null
  inventoryOpen: boolean
  explodeAmount: number
  isDraggingPiece: boolean
  showRotationGizmo: boolean
  showMoveHandle: boolean

  selectPiece: (id: string | null) => void
  addComponent: (definition: ComponentDefinition) => void
  addPullupKit: () => void
  movePiece: (id: string, position: [number, number, number]) => void
  setRotation: (id: string, rotation: [number, number, number]) => void
  rotateSelected: () => void
  standSelectedUp: () => void
  duplicateSelected: () => void
  deleteSelected: () => void
  changeDimensions: (id: string, dimensions: Dimensions) => void
  toggleInventory: () => void
  setExplodeAmount: (amount: number) => void
  setDraggingPiece: (dragging: boolean) => void
  toggleRotationGizmo: () => void
  toggleMoveHandle: () => void
}

// One short-lived per-session store, created via a factory — mirrors
// world-of-cards' createGameSessionStore discipline (never a single
// mega-store covering unrelated concerns). If this app grows a real global
// setting (units, theme, ...), that becomes a separate, small global store,
// not a field added here.
export function createSceneSessionStore() {
  return create<SceneSessionState>((set, get) => ({
    instances: createSeedInstances(),
    selectedId: null,
    inventoryOpen: false,
    explodeAmount: 0,
    isDraggingPiece: false,
    showRotationGizmo: true,
    showMoveHandle: true,

    selectPiece: (id) => set({ selectedId: id }),

    addComponent: (definition) =>
      set((state) => ({ instances: [...state.instances, createInstance(definition)] })),

    addPullupKit: () =>
      set((state) => ({ instances: [...state.instances, ...createPullupKitInstances()] })),

    movePiece: (id, position) =>
      set((state) => {
        const moving = state.instances.find((i) => i.id === id)
        if (!moving) return state
        const delta = findConnectionSnapDelta(moving, position, state.instances)
        const finalPosition: [number, number, number] = delta
          ? [position[0] + delta[0], position[1] + delta[1], position[2] + delta[2]]
          : position
        return {
          instances: state.instances.map((i) => (i.id === id ? { ...i, position: finalPosition } : i)),
        }
      }),

    setRotation: (id, rotation) =>
      set((state) => ({
        instances: state.instances.map((i) => (i.id === id ? { ...i, rotation } : i)),
      })),

    // Composes a 90° turn about the WORLD Y axis onto the current orientation.
    // Adding to the Euler Y term only spins about world Y while pitch/roll are
    // zero; now that they can be non-zero (Stand Up, gizmo X/Z rings) it has to
    // go through a quaternion or a stood-up post topples instead of spinning.
    rotateSelected: () =>
      set((state) => ({
        instances: state.instances.map((i) => {
          if (i.id !== state.selectedId) return i
          const currentEuler = new THREE.Euler(i.rotation[0], i.rotation[1], i.rotation[2], 'XYZ')
          const q = new THREE.Quaternion().setFromEuler(currentEuler)
          const yTurn = new THREE.Quaternion().setFromAxisAngle(
            new THREE.Vector3(0, 1, 0),
            Math.PI / 2,
          )
          q.premultiply(yTurn)
          const nextEuler = new THREE.Euler().setFromQuaternion(q, 'XYZ')
          return { ...i, rotation: [nextEuler.x, nextEuler.y, nextEuler.z] }
        }),
      })),

    // Absolute canonical standing pose — always the same result regardless
    // of the piece's prior rotation, so it's predictable even after a free
    // gizmo rotation. Only meaningful for "ends"-role pieces (board, beam,
    // rod, post — anything with a long axis to stand on); a no-op for
    // small hardware ("single"/"none" role) where "vertical" has no clear
    // meaning.
    standSelectedUp: () =>
      set((state) => {
        const selected = state.instances.find((i) => i.id === state.selectedId)
        if (!selected) return state
        if (getComponent(selected.componentDefinitionId).connectionRole !== 'ends') return state
        const halfLength = selected.dimensions.length / 2
        if (!Number.isFinite(halfLength)) return state
        return {
          instances: state.instances.map((i) =>
            i.id === selected.id
              ? // position is written directly rather than through movePiece: this
                // is an absolute pose, so it must not be nudged by connection-point
                // snapping against nearby pieces.
                { ...i, rotation: [Math.PI / 2, 0, 0], position: [i.position[0], halfLength, i.position[2]] }
              : i,
          ),
        }
      }),

    duplicateSelected: () => {
      const state = get()
      const selected = state.instances.find((i) => i.id === state.selectedId)
      if (!selected) return
      const duplicate: ComponentInstance = {
        ...selected,
        id: `${selected.componentDefinitionId}-${Date.now()}`,
        position: [selected.position[0] + 2, selected.position[1], selected.position[2] + 2],
      }
      set({ instances: [...state.instances, duplicate], selectedId: duplicate.id })
    },

    deleteSelected: () =>
      set((state) => ({
        instances: state.instances.filter((i) => i.id !== state.selectedId),
        selectedId: null,
      })),

    changeDimensions: (id, dimensions) =>
      set((state) => ({
        instances: state.instances.map((i) => (i.id === id ? { ...i, dimensions } : i)),
      })),

    toggleInventory: () => set((state) => ({ inventoryOpen: !state.inventoryOpen })),

    setExplodeAmount: (amount) => set({ explodeAmount: amount }),

    setDraggingPiece: (dragging) => set({ isDraggingPiece: dragging }),

    toggleRotationGizmo: () => set((state) => ({ showRotationGizmo: !state.showRotationGizmo })),

    toggleMoveHandle: () => set((state) => ({ showMoveHandle: !state.showMoveHandle })),
  }))
}

export type SceneSessionStore = ReturnType<typeof createSceneSessionStore>

// One session per app load — this is a single-scene app, not a multi-tab one.
export const useSceneSession = createSceneSessionStore()
