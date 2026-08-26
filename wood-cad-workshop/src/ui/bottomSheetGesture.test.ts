import { describe, it, expect } from 'vitest'
import { shouldDismiss } from './bottomSheetGesture'

describe('shouldDismiss', () => {
  it('does not dismiss with zero drag', () => {
    expect(shouldDismiss(0, 100)).toBe(false)
  })

  it('does not dismiss below the threshold', () => {
    expect(shouldDismiss(29, 100)).toBe(false)
  })

  it('does not dismiss exactly at the threshold', () => {
    expect(shouldDismiss(30, 100)).toBe(false)
  })

  it('dismisses just above the threshold', () => {
    expect(shouldDismiss(31, 100)).toBe(true)
  })

  it('dismisses well above the threshold', () => {
    expect(shouldDismiss(80, 100)).toBe(true)
  })

  it('never dismisses with a non-positive sheet height', () => {
    expect(shouldDismiss(50, 0)).toBe(false)
    expect(shouldDismiss(50, -10)).toBe(false)
  })
})
