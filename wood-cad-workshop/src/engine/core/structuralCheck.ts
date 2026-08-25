const INCHES_TO_METERS = 0.0254
const GRAVITY = 9.81 // m/s^2

export type StructuralCheckStatus = 'safe' | 'warning' | 'unsafe'

export interface StructuralCheckResult {
  stress: number // Pa
  safetyFactor: number
  status: StructuralCheckStatus
}

// Simply-supported beam, static point load at midspan — the standard
// conservative model for a pull-up bar mounted between two posts with a
// person hanging center-bar. No dynamic/impact multiplier.
export function checkPullupBarBending(params: {
  diameterIn: number
  lengthIn: number
  userWeightKg: number
  bendingStrength: number
}): StructuralCheckResult {
  const { diameterIn, lengthIn, userWeightKg, bendingStrength } = params

  if (userWeightKg <= 0 || diameterIn <= 0 || lengthIn <= 0) {
    return { stress: 0, safetyFactor: Infinity, status: 'safe' }
  }

  const diameterM = diameterIn * INCHES_TO_METERS
  const lengthM = lengthIn * INCHES_TO_METERS
  const forceN = userWeightKg * GRAVITY

  const maxMoment = (forceN * lengthM) / 4
  const sectionModulus = (Math.PI * diameterM ** 3) / 32
  const stress = maxMoment / sectionModulus
  const safetyFactor = bendingStrength / stress

  return { stress, safetyFactor, status: classifySafetyFactor(safetyFactor) }
}

export function classifySafetyFactor(safetyFactor: number): StructuralCheckStatus {
  if (safetyFactor >= 4) return 'safe'
  if (safetyFactor >= 2) return 'warning'
  return 'unsafe'
}
