import type { ComponentDefinition, ComponentInstance } from './types'
import { getRestingHeight } from './dimensions'
import { getSpecies } from './species'

let spawnCounter = 0

export function createInstance(definition: ComponentDefinition): ComponentInstance {
  spawnCounter += 1
  const spawnX = ((spawnCounter % 5) - 2) * 4
  const spawnZ = Math.floor(spawnCounter / 5) * 4
  // For a WOOD component with a real defaultSpeciesId, the species' own
  // color is the source of truth (species selection is the only way to
  // change a WOOD instance's color — see the species-database spec).
  // definition.material is only the fallback for HARDWARE/FASTENER
  // components, which have no species.
  const species = getSpecies(definition.defaultSpeciesId ?? undefined)
  return {
    id: `${definition.id}-${Date.now()}-${spawnCounter}`,
    componentDefinitionId: definition.id,
    position: [spawnX, getRestingHeight(definition), spawnZ],
    rotation: [0, 0, 0],
    dimensions: { ...definition.defaultDimensions },
    material: species?.color ?? definition.material,
    speciesId: definition.defaultSpeciesId ?? undefined,
  }
}
