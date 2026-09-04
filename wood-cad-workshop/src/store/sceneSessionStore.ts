import { create } from 'zustand'
// Note: this store is app state, not `engine/core` — the "no three import"
// purity constraint applies only to `engine/core/*`.
import * as THREE from 'three'
import type { ComponentDefinition, ComponentInstance, Connection, ConnectionCandidate, Dimensions } from '../engine'
import {
  closestBetweenWorldAnchors,
  createInstance,
  createPullupKitInstances,
  createSeedInstances,
  findClosestConnectionMatch,
  getAnchors,
  getComponent,
  getConnectedPieceIds,
  isAnchorClaimable,
  pruneStaleConnections,
  SNAP_DISTANCE,
  toWorldAnchor,
} from '../engine'

interface SceneSessionState {
  instances: ComponentInstance[]
  selectedId: string | null
  inventoryOpen: boolean
  explodeAmount: number
  isDraggingPiece: boolean
  connections: Connection[]
  showRotationGizmo: boolean
  showMoveHandle: boolean
  // Set by movePiece when a drag ends up right next to an anchor that's
  // already claimed by another connection — the closest possible match,
  // but not one movePiece can make. Cleared as soon as the drag moves
  // away from that anchor, or the drag ends (see setDraggingPiece). A
  // live "why didn't this connect" hint, not a persisted/timed toast.
  blockedConnectionHint: string | null

  selectPiece: (id: string | null) => void
  addComponent: (definition: ComponentDefinition) => void
  addPullupKit: () => void
  movePiece: (id: string, position: [number, number, number]) => void
  confirmConnection: (candidate: ConnectionCandidate) => void
  detachConnection: (connectionId: string) => void
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
    connections: [],
    showRotationGizmo: true,
    showMoveHandle: true,
    blockedConnectionHint: null,

    selectPiece: (id) => set({ selectedId: id }),

    addComponent: (definition) =>
      set((state) => ({ instances: [...state.instances, createInstance(definition)] })),

    addPullupKit: () =>
      set((state) => ({ instances: [...state.instances, ...createPullupKitInstances()] })),

    movePiece: (id, position) =>
      set((state) => {
        const moving = state.instances.find((i) => i.id === id)
        if (!moving) return state

        // Group membership comes from the CURRENT connection graph — not a
        // position/distance-filtered snapshot. A uniform translation can
        // never change a connected pair's relative distance, so deriving
        // "who moves together" from anything but the raw topology risks a
        // large single-call delta (e.g. typing a new value in the
        // Inspector, or a fast drag) spuriously excluding a genuinely
        // connected piece from the move.
        const groupIds = getConnectedPieceIds(id, state.connections)

        // A point-kind anchor already claimed by ANY existing connection
        // — anywhere in the scene, not just on the dragged piece — can't
        // be claimed by a new one. Segment/face anchors are never
        // excluded, since they can host multiple simultaneous
        // connections (see isAnchorClaimable).
        const excludeAnchors = state.connections.flatMap((c) => [
          ...(isAnchorClaimable(state.instances, c.pieceAId, c.a.anchorIndex)
            ? [{ pieceId: c.pieceAId, anchorIndex: c.a.anchorIndex }]
            : []),
          ...(isAnchorClaimable(state.instances, c.pieceBId, c.b.anchorIndex)
            ? [{ pieceId: c.pieceBId, anchorIndex: c.b.anchorIndex }]
            : []),
        ])
        // A rigid translation can never change any two group members'
        // relative distance, so searching the dragged piece's own group for
        // a NEW connection can never legitimately succeed — the only thing
        // it can do is match against a group member's stale pre-move
        // position (see the near-closed-loop bug this guards against).
        // Excluding the whole group leaves candidates outside it unaffected.
        const otherInstances = state.instances.filter((i) => !groupIds.has(i.id))
        const match = findClosestConnectionMatch(moving, position, otherInstances, excludeAnchors)

        // If the exclusion-aware search above came up empty, check whether
        // that's because nothing is nearby at all, or because the nearest
        // possible match exists but its anchor is already claimed — the
        // same search with no exclusions. Only runs when `match` is null,
        // so a normal successful drag (the common case) never pays this
        // second scan. Mirrors this file's own note elsewhere that the
        // underlying O(pieces × anchors) scan is fine at current scale.
        const blockedConnectionHint: string | null =
          match === null && excludeAnchors.length > 0 && findClosestConnectionMatch(moving, position, otherInstances, []) !== null
            ? 'This point is already connected to another piece.'
            : null

        const finalPosition: [number, number, number] = match
          ? [position[0] + match.delta[0], position[1] + match.delta[1], position[2] + match.delta[2]]
          : position

        // The dragged piece's actual displacement this call, including any
        // snap correction — every other member of its connected assembly
        // rides along by exactly this much, so relative offsets (and their
        // existing connections to each other) are preserved exactly.
        const delta: [number, number, number] = [
          finalPosition[0] - moving.position[0],
          finalPosition[1] - moving.position[1],
          finalPosition[2] - moving.position[2],
        ]

        const instancesAtFinal = state.instances.map((i) => {
          if (i.id === id) return { ...i, position: finalPosition }
          if (!groupIds.has(i.id)) return i
          return {
            ...i,
            position: [i.position[0] + delta[0], i.position[1] + delta[1], i.position[2] + delta[2]] as [
              number,
              number,
              number,
            ],
          }
        })
        // Prune against the FINAL, fully-moved positions. Every
        // group-internal connection is translation-invariant by
        // construction (both endpoints moved by the identical delta) and
        // will always still measure as coincident here — this pass is a
        // defensive check, not the mechanism that decides group
        // membership.
        const nextConnections = pruneStaleConnections(instancesAtFinal, state.connections, SNAP_DISTANCE)

        return {
          instances: instancesAtFinal,
          connections: nextConnections,
          blockedConnectionHint,
        }
      }),

    // Persists a candidate found by findConnectionCandidates, after
    // translating pieceB's current connected group (via
    // getConnectedPieceIds, the same rigid-group convention movePiece
    // uses) by the exact delta that brings the two anchors' closest
    // points into coincidence — a candidate is only ever within
    // SNAP_DISTANCE, not necessarily touching, and a confirmed connection
    // must always be an exact, touching joint, never a frozen gap.
    // Re-derives the match at click time (in case something else moved a
    // piece between the candidate being rendered and the click landing)
    // and no-ops if it's gone stale. Also no-ops if either side's anchor
    // is point-kind AND already claimed by an existing connection (a
    // defensive guard against a duplicate confirm) — segment/face
    // anchors never conflict this way, since they can host multiple
    // connections.
    confirmConnection: (candidate) =>
      set((state) => {
        const pieceA = state.instances.find((i) => i.id === candidate.pieceAId)
        const pieceB = state.instances.find((i) => i.id === candidate.pieceBId)
        if (!pieceA || !pieceB) return state

        const anchorA = getAnchors(pieceA)[candidate.a.anchorIndex]
        const anchorB = getAnchors(pieceB)[candidate.b.anchorIndex]
        if (!anchorA || !anchorB) return state

        const worldA = toWorldAnchor(pieceA, anchorA)
        const worldB = toWorldAnchor(pieceB, anchorB)
        const match = closestBetweenWorldAnchors(worldA, worldB)
        if (match.distance > SNAP_DISTANCE) return state

        const claimConflict = state.connections.some((c) => {
          const aConflict =
            isAnchorClaimable(state.instances, candidate.pieceAId, candidate.a.anchorIndex) &&
            ((c.pieceAId === candidate.pieceAId && c.a.anchorIndex === candidate.a.anchorIndex) ||
              (c.pieceBId === candidate.pieceAId && c.b.anchorIndex === candidate.a.anchorIndex))
          const bConflict =
            isAnchorClaimable(state.instances, candidate.pieceBId, candidate.b.anchorIndex) &&
            ((c.pieceAId === candidate.pieceBId && c.a.anchorIndex === candidate.b.anchorIndex) ||
              (c.pieceBId === candidate.pieceBId && c.b.anchorIndex === candidate.b.anchorIndex))
          return aConflict || bConflict
        })
        if (claimConflict) return state

        const delta: [number, number, number] = [
          match.pointA[0] - match.pointB[0],
          match.pointA[1] - match.pointB[1],
          match.pointA[2] - match.pointB[2],
        ]

        const groupIds = getConnectedPieceIds(candidate.pieceBId, state.connections)
        const instances = state.instances.map((i) =>
          groupIds.has(i.id)
            ? {
                ...i,
                position: [i.position[0] + delta[0], i.position[1] + delta[1], i.position[2] + delta[2]] as [
                  number,
                  number,
                  number,
                ],
              }
            : i,
        )

        return {
          instances,
          connections: [
            ...state.connections,
            {
              id: `conn-${candidate.pieceAId}-${candidate.pieceBId}-${candidate.a.anchorIndex}-${candidate.b.anchorIndex}`,
              pieceAId: candidate.pieceAId,
              pieceBId: candidate.pieceBId,
              a: { anchorIndex: candidate.a.anchorIndex, param: match.paramA },
              b: { anchorIndex: candidate.b.anchorIndex, param: match.paramB },
            },
          ],
        }
      }),

    detachConnection: (connectionId) =>
      set((state) => ({
        connections: state.connections.filter((c) => c.id !== connectionId),
      })),

    setRotation: (id, rotation) =>
      set((state) => {
        const instances = state.instances.map((i) => (i.id === id ? { ...i, rotation } : i))
        return { instances, connections: pruneStaleConnections(instances, state.connections, SNAP_DISTANCE) }
      }),

    // Composes a 90° turn about the WORLD Y axis onto the current orientation.
    // Adding to the Euler Y term only spins about world Y while pitch/roll are
    // zero; now that they can be non-zero (Stand Up, gizmo X/Z rings) it has to
    // go through a quaternion or a stood-up post topples instead of spinning.
    rotateSelected: () =>
      set((state) => {
        const instances: ComponentInstance[] = state.instances.map((i) => {
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
        })
        return { instances, connections: pruneStaleConnections(instances, state.connections, SNAP_DISTANCE) }
      }),

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
        const instances: ComponentInstance[] = state.instances.map((i) =>
          i.id === selected.id
            ? // position is written directly rather than through movePiece: this
              // is an absolute pose, so it must not be nudged by connection-point
              // snapping against nearby pieces.
              { ...i, rotation: [Math.PI / 2, 0, 0], position: [i.position[0], halfLength, i.position[2]] }
            : i,
        )
        return { instances, connections: pruneStaleConnections(instances, state.connections, SNAP_DISTANCE) }
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
        connections: state.connections.filter(
          (c) => c.pieceAId !== state.selectedId && c.pieceBId !== state.selectedId,
        ),
        selectedId: null,
      })),

    changeDimensions: (id, dimensions) =>
      set((state) => {
        const instances = state.instances.map((i) => (i.id === id ? { ...i, dimensions } : i))
        return { instances, connections: pruneStaleConnections(instances, state.connections, SNAP_DISTANCE) }
      }),

    toggleInventory: () => set((state) => ({ inventoryOpen: !state.inventoryOpen })),

    setExplodeAmount: (amount) => set({ explodeAmount: amount }),

    setDraggingPiece: (dragging) =>
      // A drag ending is also the natural point to clear any lingering
      // "blocked" hint — it's only meaningful while actively dragging near
      // the contested anchor.
      set(dragging ? { isDraggingPiece: dragging } : { isDraggingPiece: dragging, blockedConnectionHint: null }),

    toggleRotationGizmo: () => set((state) => ({ showRotationGizmo: !state.showRotationGizmo })),

    toggleMoveHandle: () => set((state) => ({ showMoveHandle: !state.showMoveHandle })),
  }))
}

export type SceneSessionStore = ReturnType<typeof createSceneSessionStore>

// One session per app load — this is a single-scene app, not a multi-tab one.
export const useSceneSession = createSceneSessionStore()
