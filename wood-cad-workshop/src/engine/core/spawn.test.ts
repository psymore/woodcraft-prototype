import { describe, it, expect } from 'vitest'
import { createInstance } from './spawn'
import type { ComponentDefinition } from './types'

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
