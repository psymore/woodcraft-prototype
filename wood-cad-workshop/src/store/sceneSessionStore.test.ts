import { describe, it, expect, beforeEach } from 'vitest'
import { registerComponent, clearRegistry } from '../engine/registry/registry'
import { SNAP_DISTANCE, getSpecies } from '../engine'
import type { ComponentDefinition, ComponentInstance, Connection } from '../engine'
import { createSceneSessionStore } from './sceneSessionStore'

// Same fixture shape as engine/core/connections.test.ts's rodDefinition():
// an 'ends'-role piece of length 10, so getAnchors (engine/core/connectionPoints.ts)
// returns local points at z=-5 (index 0) and z=+5 (index 1).
function rodDefinition(): ComponentDefinition {
  return {
    id: 'test_rod',
    name: 'Test Rod',
    category: 'WOOD',
    geometry: { shape: 'cylinder' },
    defaultDimensions: { diameter: 1, length: 10 },
    material: '#000',
    connectionRole: 'ends',
    structuralProperties: {},
    explodeDirection: null,
    defaultSpeciesId: null,
  }
}

function rod(id: string, position: [number, number, number]): ComponentInstance {
  return {
    id,
    componentDefinitionId: 'test_rod',
    position,
    rotation: [0, 0, 0],
    dimensions: { diameter: 1, length: 10 },
    material: '#000',
  }
}

// A much shorter rod than rod() above — used to isolate the
// blockedConnectionHint tests below to exactly one contested joint,
// since a full-length (10-unit) rod's *other* end can land close enough
// to a second, unclaimed anchor to form its own accidental match (see
// that test's comment for the specific case this avoids).
function shortRod(id: string, position: [number, number, number], length: number): ComponentInstance {
  return {
    id,
    componentDefinitionId: 'test_rod',
    position,
    rotation: [0, 0, 0],
    dimensions: { diameter: 1, length },
    material: '#000',
  }
}

beforeEach(() => {
  clearRegistry()
  registerComponent(rodDefinition())
})

describe('movePiece — group translation', () => {
  it('moves a connected piece along with the dragged piece, keeping their connection', () => {
    // r1 at z=0 (points z=-5, z=5), r2 at z=10 (points z=5, z=15) — r1's
    // idx1 point (world z=5) coincides with r2's idx0 point (world z=5).
    const r1 = rod('r1', [0, 0, 0])
    const r2 = rod('r2', [0, 0, 10])
    const connection: Connection = { id: 'c1', pieceAId: 'r1', pieceBId: 'r2', a: { anchorIndex: 1 }, b: { anchorIndex: 0 } }

    const store = createSceneSessionStore()
    store.setState({ instances: [r1, r2], connections: [connection] })

    // Drag r1 far away by a delta well past SNAP_DISTANCE — regression
    // test for the earlier stranded-neighbor bug, where a large single-call
    // delta caused group membership (derived from a stale, distance-filtered
    // snapshot) to spuriously exclude r2 from the move.
    expect(SNAP_DISTANCE).toBeLessThan(50)
    store.getState().movePiece('r1', [50, 0, 0])

    const { instances, connections } = store.getState()
    const nextR1 = instances.find((i) => i.id === 'r1')
    const nextR2 = instances.find((i) => i.id === 'r2')
    expect(nextR1?.position).toEqual([50, 0, 0])
    // r2 rides along by the same delta ([50, 0, 0]), preserving its
    // original offset from r1.
    expect(nextR2?.position).toEqual([50, 0, 10])
    expect(connections).toHaveLength(1)
    expect(connections[0]).toEqual(connection)
  })

  it('does not form a spurious new connection when a drag brings two group members\' free ends near each other', () => {
    // Chain r1 - r2 - r3 (connected via c1: r1.idx1-r2.idx0, c2: r2.idx1-r3.idx0).
    // r1's free end (idx0, local z=-5) is the point that will be dragged
    // near r3's free end (idx1, local z=+5) — the near-closed-loop scenario.
    const r1 = rod('r1', [0, 0, 0]) // points: z=-5 (free), z=5 (-> r2)
    const r2 = rod('r2', [0, 0, 10]) // points: z=5 (-> r1), z=15 (-> r3)
    const r3 = rod('r3', [0, 0, 20]) // points: z=15 (-> r2), z=25 (free)
    const c1: Connection = { id: 'c1', pieceAId: 'r1', pieceBId: 'r2', a: { anchorIndex: 1 }, b: { anchorIndex: 0 } }
    const c2: Connection = { id: 'c2', pieceAId: 'r2', pieceBId: 'r3', a: { anchorIndex: 1 }, b: { anchorIndex: 0 } }

    const store = createSceneSessionStore()
    store.setState({ instances: [r1, r2, r3], connections: [c1, c2] })

    // Drag r1 to z=29: its free point (idx0) would land at world z=24 —
    // only 1 unit from r3's CURRENT (pre-move) free point at world z=25.
    // If findClosestConnectionMatch searched r3 (a fellow group member) as
    // a match candidate, it would find this stale-position "match" and
    // snap r1 to z=30 — silently misplacing the dragged piece off the
    // position the user actually dragged it to, using a position r3 is
    // about to move away from anyway (it rides along by the same delta).
    // r3 (being in r1's own connected group) is excluded from the
    // candidate list, so no match is found and r1 lands exactly at the
    // proposed position — the assertions below on nextR1/nextR2/nextR3
    // guard against that stale-position match regressing.
    store.getState().movePiece('r1', [0, 0, 29])

    const { instances, connections } = store.getState()
    const nextR1 = instances.find((i) => i.id === 'r1')
    const nextR2 = instances.find((i) => i.id === 'r2')
    const nextR3 = instances.find((i) => i.id === 'r3')

    // No snap correction applied — r1 lands exactly where it was dragged.
    expect(nextR1?.position).toEqual([0, 0, 29])
    // r2 and r3 ride along by the identical delta ([0, 0, 29]), so every
    // relative offset in the group is preserved exactly.
    expect(nextR2?.position).toEqual([0, 0, 39])
    expect(nextR3?.position).toEqual([0, 0, 49])

    // Still just the original two chain connections — no new r1-r3 link.
    expect(connections).toHaveLength(2)
    expect(connections).toEqual(expect.arrayContaining([c1, c2]))
    expect(
      connections.some(
        (c) =>
          (c.pieceAId === 'r1' && c.pieceBId === 'r3') || (c.pieceAId === 'r3' && c.pieceBId === 'r1'),
      ),
    ).toBe(false)
  })
})

describe('movePiece — unconnected piece', () => {
  it('moves only the dragged piece, leaving every other instance and connections untouched', () => {
    const moving = rod('r1', [0, 0, 0])
    const other = rod('r2', [100, 0, 0]) // far away — no chance of an accidental snap match
    const emptyConnections: Connection[] = []

    const store = createSceneSessionStore()
    store.setState({ instances: [moving, other], connections: emptyConnections })

    store.getState().movePiece('r1', [5, 0, 0])

    const { instances, connections } = store.getState()
    const nextR1 = instances.find((i) => i.id === 'r1')
    const nextR2 = instances.find((i) => i.id === 'r2')
    expect(nextR1?.position).toEqual([5, 0, 0])
    // Untouched instances keep the exact same object reference — the store
    // only allocates a new object for pieces it actually moved.
    expect(nextR2).toBe(other)
    // pruneStaleConnections returns the original array reference when
    // nothing changed, and no new connection was created.
    expect(connections).toBe(emptyConnections)
  })
})

describe('movePiece — blockedConnectionHint', () => {
  // r1-r2 are pre-connected at world z=5 (r1's idx1, r2's idx0 — both
  // claimed). r3 is a short (0.4-unit) rod so both its own anchors sit
  // right on top of that single contested joint when dragged there,
  // instead of one end also happening to land near r2's own free idx1 —
  // which a full 10-unit rod would (its far end would land near z=15,
  // right where r2's unclaimed idx1 already is), forming an unrelated
  // accidental connection instead of exercising the "blocked" path.
  function connectedPair(): { r1: ComponentInstance; r2: ComponentInstance; c1: Connection } {
    return {
      r1: rod('r1', [0, 0, 0]), // points z=-5 (free), z=5 (-> r2, claimed)
      r2: rod('r2', [0, 0, 10]), // points z=5 (-> r1, claimed), z=15 (free)
      c1: { id: 'c1', pieceAId: 'r1', pieceBId: 'r2', a: { anchorIndex: 1 }, b: { anchorIndex: 0 } },
    }
  }

  it('sets blockedConnectionHint when the only anchor in range is already claimed', () => {
    const { r1, r2, c1 } = connectedPair()
    const r3 = shortRod('r3', [0, 0, 100], 0.4) // starts far from the assembly

    const store = createSceneSessionStore()
    store.setState({ instances: [r1, r2, r3], connections: [c1] })

    // Drag r3 onto the claimed joint at world z=5.
    store.getState().movePiece('r3', [0, 0, 5])

    const state = store.getState()
    expect(state.blockedConnectionHint).not.toBeNull()
    // r3 did not snap — no connection delta was applied, since the only
    // nearby anchor was excluded.
    expect(state.instances.find((i) => i.id === 'r3')?.position).toEqual([0, 0, 5])
    expect(state.connections).toHaveLength(1)
  })

  it('does not set blockedConnectionHint when nothing is nearby at all', () => {
    const { r1, r2, c1 } = connectedPair()
    const r3 = shortRod('r3', [0, 0, 100], 0.4)

    const store = createSceneSessionStore()
    store.setState({ instances: [r1, r2, r3], connections: [c1] })

    store.getState().movePiece('r3', [0, 0, 100.5])

    expect(store.getState().blockedConnectionHint).toBeNull()
  })

  it('clears blockedConnectionHint once the drag moves away from the claimed anchor', () => {
    const { r1, r2, c1 } = connectedPair()
    const r3 = shortRod('r3', [0, 0, 100], 0.4)

    const store = createSceneSessionStore()
    store.setState({ instances: [r1, r2, r3], connections: [c1] })

    store.getState().movePiece('r3', [0, 0, 5])
    expect(store.getState().blockedConnectionHint).not.toBeNull()

    store.getState().movePiece('r3', [0, 0, 100])
    expect(store.getState().blockedConnectionHint).toBeNull()
  })

  it('setDraggingPiece(false) clears blockedConnectionHint', () => {
    const { r1, r2, c1 } = connectedPair()
    const r3 = shortRod('r3', [0, 0, 100], 0.4)

    const store = createSceneSessionStore()
    store.setState({ instances: [r1, r2, r3], connections: [c1] })

    store.getState().movePiece('r3', [0, 0, 5])
    expect(store.getState().blockedConnectionHint).not.toBeNull()

    store.getState().setDraggingPiece(false)
    expect(store.getState().blockedConnectionHint).toBeNull()
  })
})

describe('changeSpecies', () => {
  it('updates both speciesId and material together for a known species', () => {
    const r1 = rod('r1', [0, 0, 0])
    const store = createSceneSessionStore()
    store.setState({ instances: [r1] })

    store.getState().changeSpecies('r1', 'sugar_maple')

    const updated = store.getState().instances.find((i) => i.id === 'r1')
    expect(updated?.speciesId).toBe('sugar_maple')
    expect(updated?.material).toBe(getSpecies('sugar_maple')!.color)
  })

  it('leaves state unchanged for an unknown species id', () => {
    const r1 = rod('r1', [0, 0, 0])
    const store = createSceneSessionStore()
    store.setState({ instances: [r1] })
    const before = store.getState().instances

    store.getState().changeSpecies('r1', 'unobtainium')

    expect(store.getState().instances).toBe(before)
  })
})
