import { describe, it, expect } from 'vitest'
import { checkPullupBarBending, checkPullupBarConnection, classifySafetyFactor } from './structuralCheck'

describe('classifySafetyFactor', () => {
  it('classifies safe at and above 4', () => {
    expect(classifySafetyFactor(4)).toBe('safe')
    expect(classifySafetyFactor(10)).toBe('safe')
  })

  it('classifies warning between 2 (inclusive) and 4 (exclusive)', () => {
    expect(classifySafetyFactor(3.99)).toBe('warning')
    expect(classifySafetyFactor(2)).toBe('warning')
  })

  it('classifies unsafe below 2', () => {
    expect(classifySafetyFactor(1.99)).toBe('unsafe')
    expect(classifySafetyFactor(0)).toBe('unsafe')
  })
})

describe('checkPullupBarBending', () => {
  it('computes a safe result for a light load on a 2in x 40in bar', () => {
    // d=2in=0.0508m, L=40in=1.016m, P=50kg*9.81=490.5N
    // M = P*L/4 ≈ 124.6 N·m, Z = π*d³/32 ≈ 1.287e-5 m³, σ ≈ 9.68 MPa
    // SF = 50e6 / 9.68e6 ≈ 5.17 -> safe
    const result = checkPullupBarBending({
      diameterIn: 2,
      lengthIn: 40,
      userWeightKg: 50,
      bendingStrength: 50_000_000,
    })
    expect(result.status).toBe('safe')
    expect(result.safetyFactor).toBeGreaterThan(4)
    expect(result.safetyFactor).toBeLessThan(7)
    expect(result.stress).toBeGreaterThan(8_000_000)
    expect(result.stress).toBeLessThan(11_000_000)
  })

  it('computes an unsafe result for the actual pull-up bar dimensions under an 80kg load', () => {
    // Mirrors PULLUP_BAR_DEFINITION (diameter=1.25in, length=48in,
    // bendingStrength=98.6e6 Pa, red oak MOR) — the shipped default is
    // too slender at this span to safely hold an adult's full
    // bodyweight, which is exactly the kind of estimate this feature
    // exists to surface.
    const result = checkPullupBarBending({
      diameterIn: 1.25,
      lengthIn: 48,
      userWeightKg: 80,
      bendingStrength: 98_600_000,
    })
    expect(result.status).toBe('unsafe')
    expect(result.safetyFactor).toBeGreaterThan(1)
    expect(result.safetyFactor).toBeLessThan(2)
  })

  it('guards against non-positive weight without throwing', () => {
    const result = checkPullupBarBending({
      diameterIn: 1.25,
      lengthIn: 48,
      userWeightKg: 0,
      bendingStrength: 98_000_000,
    })
    expect(result.stress).toBe(0)
    expect(result.safetyFactor).toBe(Infinity)
    expect(result.status).toBe('safe')
  })

  it('guards against non-positive diameter without throwing', () => {
    const result = checkPullupBarBending({
      diameterIn: 0,
      lengthIn: 48,
      userWeightKg: 80,
      bendingStrength: 98_000_000,
    })
    expect(result.stress).toBe(0)
    expect(result.safetyFactor).toBe(Infinity)
    expect(result.status).toBe('safe')
  })
})

describe('checkPullupBarConnection', () => {
  it('computes a safe result for a light load', () => {
    // P=20kg*9.81=196.2N, reactionForce=P/2=98.1N
    // SF = 600 / 98.1 ≈ 6.12 -> safe
    const result = checkPullupBarConnection({ userWeightKg: 20, connectionCapacity: 600 })
    expect(result.status).toBe('safe')
    expect(result.reactionForce).toBeCloseTo(98.1, 1)
    expect(result.safetyFactor).toBeGreaterThan(4)
  })

  it('computes an unsafe result for an 80kg load against the shipped connectionCapacity', () => {
    // Mirrors PULLUP_BAR_DEFINITION's connectionCapacity=600N (spruce
    // doweled-joint estimate) — P=80kg*9.81=784.8N, reactionForce=392.4N
    // SF = 600 / 392.4 ≈ 1.53 -> unsafe
    const result = checkPullupBarConnection({ userWeightKg: 80, connectionCapacity: 600 })
    expect(result.status).toBe('unsafe')
    expect(result.reactionForce).toBeCloseTo(392.4, 1)
    expect(result.safetyFactor).toBeGreaterThan(1)
    expect(result.safetyFactor).toBeLessThan(2)
  })

  it('guards against non-positive weight without throwing', () => {
    const result = checkPullupBarConnection({ userWeightKg: 0, connectionCapacity: 600 })
    expect(result.reactionForce).toBe(0)
    expect(result.safetyFactor).toBe(Infinity)
    expect(result.status).toBe('safe')
  })
})
