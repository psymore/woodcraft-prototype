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

// A distinct shape from StructuralCheckResult: this check compares a
// force to a capacity directly (no bearing area is modeled), so there's
// no stress in Pa to report — reusing StructuralCheckResult's `stress`
// field would misrepresent what's being compared.
export interface ConnectionCheckResult {
  reactionForce: number // N
  safetyFactor: number
  status: StructuralCheckStatus
}

// Shear/pull-apart estimate at the pull-up bar's own two end
// connections (see the structural-check spec's 2026-09-05 amendment for
// why this is scoped narrowly to just this one component's joints, not
// a general shear check). For a symmetric simply-supported beam under a
// center point load, each support carries exactly half the load.
export function checkPullupBarConnection(params: { userWeightKg: number; connectionCapacity: number }): ConnectionCheckResult {
  const { userWeightKg, connectionCapacity } = params

  if (userWeightKg <= 0) {
    return { reactionForce: 0, safetyFactor: Infinity, status: 'safe' }
  }

  const forceN = userWeightKg * GRAVITY
  const reactionForce = forceN / 2
  const safetyFactor = connectionCapacity / reactionForce

  return { reactionForce, safetyFactor, status: classifySafetyFactor(safetyFactor) }
}
