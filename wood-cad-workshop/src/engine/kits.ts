import { getComponent } from './registry/registry'
import { createInstance } from './core/spawn'
import type { ComponentInstance } from './core/types'

const PULLUP_KIT_IDS = ['pullup_bar', 'vertical_post', 'vertical_post', 'foot', 'foot']

export function createPullupKitInstances(): ComponentInstance[] {
  return PULLUP_KIT_IDS.map((id) => createInstance(getComponent(id)))
}
