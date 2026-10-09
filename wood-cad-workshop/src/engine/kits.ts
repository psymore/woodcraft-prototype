import { getComponent } from './registry/registry'
import { createInstance } from './core/spawn'
import type { ComponentInstance } from './core/types'

const PULLUP_KIT_IDS = ['pullup_bar', 'vertical_post', 'vertical_post', 'foot', 'foot']

export function createPullupKitInstances(): ComponentInstance[] {
  return PULLUP_KIT_IDS.map((id) => createInstance(getComponent(id)))
}

// Same 5 pieces as createPullupKitInstances, pre-positioned and rotated so
// their connection-point anchors land exactly on top of each other (see
// getAnchors in connectionPoints.ts) — the caller is expected to run the
// result through findConnectionCandidates and persist the matches as real
// Connections, so this spawns a kit that's already snapped together
// instead of 5 loose pieces the user has to drag into place by hand.
//
// Layout: two posts stand at x = ±barHalfLength (so the bar's own ends,
// which land at x = ±barHalfLength once rotated onto the X axis, touch
// each post's top point exactly), each post's bottom point sits at
// y=0 — which is also where each foot's single anchor (its own center,
// see getAnchors' 'single' case) is placed, so the foot ends up centered
// under its post like a T-base. Mirrors the exact position math
// standSelectedUp already uses for "a post standing on the ground".
export function createAssembledPullupKitInstances(): ComponentInstance[] {
  const bar = createInstance(getComponent('pullup_bar'))
  const postLeft = createInstance(getComponent('vertical_post'))
  const postRight = createInstance(getComponent('vertical_post'))
  const footLeft = createInstance(getComponent('foot'))
  const footRight = createInstance(getComponent('foot'))

  const postHeight = postLeft.dimensions.length
  const postHalfHeight = postHeight / 2
  const barHalfLength = bar.dimensions.length / 2

  postLeft.position = [-barHalfLength, postHalfHeight, 0]
  postLeft.rotation = [Math.PI / 2, 0, 0]
  postRight.position = [barHalfLength, postHalfHeight, 0]
  postRight.rotation = [Math.PI / 2, 0, 0]

  footLeft.position = [-barHalfLength, 0, 0]
  footRight.position = [barHalfLength, 0, 0]

  bar.position = [0, postHeight, 0]
  bar.rotation = [0, Math.PI / 2, 0]

  return [bar, postLeft, postRight, footLeft, footRight]
}
