import { describe, it, expect } from 'vitest'
import { createInstance } from './spawn'
import type { ComponentDefinition } from './types'
import { getComponents } from '../registry/registry'
import { getSpecies } from './species'
import '../index'

function woodDefinition(defaultSpeciesId: string | null): ComponentDefinition {
  return {
    id: 'test_wood',
    name: 'Test Wood',
    category: 'WOOD',
    geometry: { shape: 'box' },
    defaultDimensions: { thickness: 1, width: 1, length: 1 },
    material: '#a6693f',
    connectionRole: 'single',
    structuralProperties: {},
    explodeDirection: null,
    defaultSpeciesId,
  }
}

describe('createInstance', () => {
  it('copies defaultSpeciesId into the new instance as speciesId', () => {
    const instance = createInstance(woodDefinition('red_oak'))
    expect(instance.speciesId).toBe('red_oak')
  })

  it('leaves speciesId undefined when defaultSpeciesId is null', () => {
    const instance = createInstance(woodDefinition(null))
    expect(instance.speciesId).toBeUndefined()
  })
})

describe('createInstance — species/material consistency across real components', () => {
  it('every WOOD component spawns with material matching its default species color', () => {
    const woodDefinitions = getComponents().filter((d) => d.category === 'WOOD')
    expect(woodDefinitions.length).toBeGreaterThan(0)
    for (const definition of woodDefinitions) {
      const instance = createInstance(definition)
      const species = getSpecies(definition.defaultSpeciesId ?? undefined)
      expect(species).toBeDefined()
      expect(instance.material).toBe(species!.color)
    }
  })

  it('every non-WOOD component spawns with its own definition.material unchanged', () => {
    const nonWoodDefinitions = getComponents().filter((d) => d.category !== 'WOOD')
    expect(nonWoodDefinitions.length).toBeGreaterThan(0)
    for (const definition of nonWoodDefinitions) {
      const instance = createInstance(definition)
      expect(instance.material).toBe(definition.material)
    }
  })
})
