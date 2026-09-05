import { describe, it, expect } from 'vitest'
import { createSeedInstances } from './seedScene'
import { getSpecies } from './core/species'

describe('createSeedInstances', () => {
  it('gives every seed instance a valid speciesId whose color matches its material', () => {
    const instances = createSeedInstances()
    expect(instances.length).toBeGreaterThan(0)
    for (const instance of instances) {
      const species = getSpecies(instance.speciesId)
      expect(species).toBeDefined()
      expect(instance.material).toBe(species!.color)
    }
  })

  it('gives the two seed boards different species (stay visually distinct)', () => {
    const instances = createSeedInstances()
    const boardA = instances.find((i) => i.id === 'board-a')
    const boardB = instances.find((i) => i.id === 'board-b')
    expect(boardA?.speciesId).toBeDefined()
    expect(boardB?.speciesId).toBeDefined()
    expect(boardA?.speciesId).not.toBe(boardB?.speciesId)
  })
})
