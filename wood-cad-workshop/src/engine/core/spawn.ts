import type { ComponentDefinition, ComponentInstance } from './types'
import { getRestingHeight } from './dimensions'

let spawnCounter = 0

export function createInstance(definition: ComponentDefinition): ComponentInstance {
  spawnCounter += 1
  const spawnX = ((spawnCounter % 5) - 2) * 4
  const spawnZ = Math.floor(spawnCounter / 5) * 4
  return {
    id: `${definition.id}-${Date.now()}-${spawnCounter}`,
    componentDefinitionId: definition.id,
    position: [spawnX, getRestingHeight(definition), spawnZ],
    rotation: [0, 0, 0],
    dimensions: { ...definition.defaultDimensions },
    material: definition.material,
  }
}
