import { describe, it, expect } from 'vitest'
import { getSpecies, SPECIES_LIST } from './species'

describe('SPECIES_LIST', () => {
  it('has exactly 6 species with unique ids', () => {
    expect(SPECIES_LIST).toHaveLength(6)
    const ids = SPECIES_LIST.map((s) => s.id)
    expect(new Set(ids).size).toBe(6)
  })
})

describe('getSpecies', () => {
  it('returns the matching species for each known id', () => {
    for (const species of SPECIES_LIST) {
      expect(getSpecies(species.id)).toEqual(species)
    }
  })

  it('returns undefined for an unknown id', () => {
    expect(getSpecies('unobtainium')).toBeUndefined()
  })

  it('returns undefined for undefined input', () => {
    expect(getSpecies(undefined)).toBeUndefined()
  })
})
