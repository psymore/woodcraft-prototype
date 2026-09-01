import type { Vec3 } from './types'

export function distance(a: Vec3, b: Vec3): number {
  const dx = b[0] - a[0]
  const dy = b[1] - a[1]
  const dz = b[2] - a[2]
  return Math.sqrt(dx * dx + dy * dy + dz * dz)
}

// Full 3-axis rotation matrix for three.js's default Euler order 'XYZ'
// (matches THREE.Matrix4.makeRotationFromEuler exactly, so this stays in
// sync with how Piece.tsx renders `instance.rotation`). Rotates a
// direction vector only — no translation. Reduces to a yaw-only formula
// when rx = rz = 0. Shared by connectionPoints.ts (anchor transforms)
// and framing.ts (camera bounding-box corners) so both stay in sync.
export function applyRotation(rotation: Vec3, local: Vec3): Vec3 {
  const [rx, ry, rz] = rotation
  const [lx, ly, lz] = local
  const c1 = Math.cos(rx)
  const s1 = Math.sin(rx)
  const c2 = Math.cos(ry)
  const s2 = Math.sin(ry)
  const c3 = Math.cos(rz)
  const s3 = Math.sin(rz)

  const m11 = c2 * c3
  const m12 = -c2 * s3
  const m13 = s2
  const m21 = c1 * s3 + s1 * s2 * c3
  const m22 = c1 * c3 - s1 * s2 * s3
  const m23 = -s1 * c2
  const m31 = s1 * s3 - c1 * s2 * c3
  const m32 = s1 * c3 + c1 * s2 * s3
  const m33 = c1 * c2

  return [m11 * lx + m12 * ly + m13 * lz, m21 * lx + m22 * ly + m23 * lz, m31 * lx + m32 * ly + m33 * lz]
}

// Closest point on the finite segment [a, b] to p, via clamped
// projection: project p onto the segment's direction, clamp the
// parameter t to [0, 1]. Degenerate (zero-length) segments return `a`
// with t=0 rather than dividing by zero.
export function closestPointOnSegment(p: Vec3, a: Vec3, b: Vec3): { point: Vec3; t: number } {
  const abx = b[0] - a[0]
  const aby = b[1] - a[1]
  const abz = b[2] - a[2]
  const lenSq = abx * abx + aby * aby + abz * abz
  if (lenSq < 1e-12) return { point: a, t: 0 }

  const apx = p[0] - a[0]
  const apy = p[1] - a[1]
  const apz = p[2] - a[2]
  const rawT = (apx * abx + apy * aby + apz * abz) / lenSq
  const t = Math.max(0, Math.min(1, rawT))
  return { point: [a[0] + abx * t, a[1] + aby * t, a[2] + abz * t], t }
}

// Closest point on a finite rectangle to p: the rectangle is centered at
// `center`, spanning `[-halfU, halfU]` along `uAxis` and `[-halfV, halfV]`
// along `vAxis` (both assumed unit-length and orthogonal — true for this
// app's axis-aligned box faces). Same clamped-projection idea as
// closestPointOnSegment, applied independently on two axes instead of one.
export function closestPointOnRect(
  p: Vec3,
  center: Vec3,
  uAxis: Vec3,
  vAxis: Vec3,
  halfU: number,
  halfV: number,
): { point: Vec3; u: number; v: number } {
  const dx = p[0] - center[0]
  const dy = p[1] - center[1]
  const dz = p[2] - center[2]
  const rawU = dx * uAxis[0] + dy * uAxis[1] + dz * uAxis[2]
  const rawV = dx * vAxis[0] + dy * vAxis[1] + dz * vAxis[2]
  const u = Math.max(-halfU, Math.min(halfU, rawU))
  const v = Math.max(-halfV, Math.min(halfV, rawV))
  return {
    point: [
      center[0] + uAxis[0] * u + vAxis[0] * v,
      center[1] + uAxis[1] * u + vAxis[1] * v,
      center[2] + uAxis[2] * u + vAxis[2] * v,
    ],
    u,
    v,
  }
}
