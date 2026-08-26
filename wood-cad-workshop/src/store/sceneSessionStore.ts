import { create } from 'zustand'
import type { ComponentDefinition, ComponentInstance, Dimensions } from '../engine'
import { createInstance, createPullupKitInstances, createSeedInstances, findConnectionSnapDelta } from '../engine'

interface SceneSessionState {
  instances: ComponentInstance[]
  selectedId: string | null
  inventoryOpen: boolean
  explodeAmount: number
  isDraggingPiece: boolean

  selectPiece: (id: string | null) => void
  addComponent: (definition: ComponentDefinition) => void
  addPullupKit: () => void
  movePiece: (id: string, position: [number, number, number]) => void
  setRotation: (id: string, rotation: [number, number, number]) => void
  rotateSelected: () => void
  duplicateSelected: () => void
  deleteSelected: () => void
  changeDimensions: (id: string, dimensions: Dimensions) => void
  toggleInventory: () => void
  setExplodeAmount: (amount: number) => void
  setDraggingPiece: (dragging: boolean) => void
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

    rotateSelected: () =>
      set((state) => ({
        instances: state.instances.map((i) =>
          i.id === state.selectedId
            ? { ...i, rotation: [i.rotation[0], i.rotation[1] + Math.PI / 2, i.rotation[2]] }
            : i,
        ),
      })),

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
  }))
}

export type SceneSessionStore = ReturnType<typeof createSceneSessionStore>

// One session per app load — this is a single-scene app, not a multi-tab one.
export const useSceneSession = createSceneSessionStore()
