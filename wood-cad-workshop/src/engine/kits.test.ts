import { describe, it, expect } from 'vitest'
import { SNAP_DISTANCE, createAssembledPullupKitInstances, findConnectionCandidates } from '.'

describe('createAssembledPullupKitInstances', () => {
  it('lays out the 5 pieces so exactly the 4 intended joints are in snap range', () => {
    const [bar, postLeft, postRight, footLeft, footRight] = createAssembledPullupKitInstances()
    const candidates = findConnectionCandidates([bar, postLeft, postRight, footLeft, footRight], [], SNAP_DISTANCE)

    const pairs = candidates.map((c) => [c.pieceAId, c.pieceBId].sort().join('+')).sort()
    const expected = [
      [bar.id, postLeft.id],
      [bar.id, postRight.id],
      [postLeft.id, footLeft.id],
      [postRight.id, footRight.id],
    ]
      .map((p) => p.sort().join('+'))
      .sort()
    expect(pairs).toEqual(expected)
  })
})
