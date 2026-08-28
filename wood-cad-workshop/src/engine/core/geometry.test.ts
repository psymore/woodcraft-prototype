import { describe, it, expect } from 'vitest'
import { distance, closestPointOnSegment, closestPointOnRect } from './geometry'

describe('distance', () => {
  it('computes straight-line 3D distance', () => {
    expect(distance([0, 0, 0], [3, 4, 0])).toBeCloseTo(5)
  })
})

describe('closestPointOnSegment', () => {
  it('returns the perpendicular projection when it falls inside the segment', () => {
    const result = closestPointOnSegment([0, 1, 5], [0, 0, 0], [0, 0, 10])
    expect(result.point[0]).toBeCloseTo(0)
    expect(result.point[1]).toBeCloseTo(0)
    expect(result.point[2]).toBeCloseTo(5)
    expect(result.t).toBeCloseTo(0.5)
  })

  it('clamps to the start point when the projection falls before it', () => {
    const result = closestPointOnSegment([0, 1, -5], [0, 0, 0], [0, 0, 10])
    expect(result.point).toEqual([0, 0, 0])
    expect(result.t).toBe(0)
  })

  it('clamps to the end point when the projection falls past it', () => {
    const result = closestPointOnSegment([0, 1, 15], [0, 0, 0], [0, 0, 10])
    expect(result.point).toEqual([0, 0, 10])
    expect(result.t).toBe(1)
  })

  it('does not throw on a degenerate zero-length segment', () => {
    const result = closestPointOnSegment([5, 5, 5], [1, 1, 1], [1, 1, 1])
    expect(result.point).toEqual([1, 1, 1])
    expect(result.t).toBe(0)
  })
})

describe('closestPointOnRect', () => {
  const center: [number, number, number] = [0, 0, 0]
  const uAxis: [number, number, number] = [1, 0, 0]
  const vAxis: [number, number, number] = [0, 0, 1]

  it('returns the projected point when it falls inside both extents', () => {
    const result = closestPointOnRect([1, 3, 2], center, uAxis, vAxis, 2, 5)
    expect(result.point[0]).toBeCloseTo(1)
    expect(result.point[1]).toBeCloseTo(0)
    expect(result.point[2]).toBeCloseTo(2)
    expect(result.u).toBeCloseTo(1)
    expect(result.v).toBeCloseTo(2)
  })

  it('clamps on the u axis only when only u is out of range', () => {
    const result = closestPointOnRect([5, 0, 2], center, uAxis, vAxis, 2, 5)
    expect(result.point).toEqual([2, 0, 2])
    expect(result.u).toBe(2)
    expect(result.v).toBeCloseTo(2)
  })

  it('clamps on both axes when both are out of range', () => {
    const result = closestPointOnRect([10, 0, 10], center, uAxis, vAxis, 2, 5)
    expect(result.point).toEqual([2, 0, 5])
    expect(result.u).toBe(2)
    expect(result.v).toBe(5)
  })
})
