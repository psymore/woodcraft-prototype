export interface Bounds {
  center: [number, number, number]
  radius: number
}

export function computeBounds(positions: Array<[number, number, number]>): Bounds {
  if (positions.length === 0) {
    return { center: [0, 0, 0], radius: 10 }
  }
  const n = positions.length
  const cx = positions.reduce((sum, p) => sum + p[0], 0) / n
  const cy = positions.reduce((sum, p) => sum + p[1], 0) / n
  const cz = positions.reduce((sum, p) => sum + p[2], 0) / n
  const center: [number, number, number] = [cx, cy, cz]
  const radius = positions.reduce((max, p) => {
    const d = Math.hypot(p[0] - cx, p[1] - cy, p[2] - cz)
    return Math.max(max, d)
  }, 1)
  return { center, radius }
}
