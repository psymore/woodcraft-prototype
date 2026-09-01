import type { ComponentInstance, Vec3 } from './types'
import { getBoxSize, getCylinderSize } from './dimensions'
import { getComponent } from '../registry/registry'
import { applyRotation } from './geometry'

export interface Bounds {
  center: [number, number, number]
  radius: number
}

// Local (pre-rotation/position) half-extents of one instance's own
// axis-aligned bounding box, in the same local-Z-is-length convention
// getAnchors() (connectionPoints.ts) uses. A cylinder gets a
// conservative box — its own radius on both non-length axes — rather
// than its true rotated-cylinder bounds: simpler, and never
// underestimates the space the piece actually occupies.
function localHalfExtents(instance: ComponentInstance): Vec3 {
  const definition = getComponent(instance.componentDefinitionId)
  if (definition.geometry.shape === 'cylinder') {
    const { radius, height } = getCylinderSize(instance)
    return [radius / 2, radius / 2, height / 4]
  }
  const [thickness, width, length] = getBoxSize(instance)
  return [thickness / 2, width / 2, length / 2]
}

// World-space bounding sphere (center + radius) enclosing every
// instance's ACTUAL rotated geometry — not just its center position.
// Replaces the old point-only computeBounds, which treated every piece
// as a zero-size point and routinely placed the camera inside/grazing a
// long piece's own surface when framing a scene (see the camera design
// spec's root-cause investigation). Falls back to a small sphere at the
// origin for an empty scene, matching the old function's behavior.
export function computeInstanceBounds(instances: ComponentInstance[]): Bounds {
  if (instances.length === 0) {
    return { center: [0, 0, 0], radius: 10 }
  }

  let min: Vec3 = [Infinity, Infinity, Infinity]
  let max: Vec3 = [-Infinity, -Infinity, -Infinity]

  for (const instance of instances) {
    const [hx, hy, hz] = localHalfExtents(instance)
    for (const sx of [-1, 1] as const) {
      for (const sy of [-1, 1] as const) {
        for (const sz of [-1, 1] as const) {
          const local: Vec3 = [sx * hx, sy * hy, sz * hz]
          const rotated = applyRotation(instance.rotation, local)
          const world: Vec3 = [
            instance.position[0] + rotated[0],
            instance.position[1] + rotated[1],
            instance.position[2] + rotated[2],
          ]
          min = [Math.min(min[0], world[0]), Math.min(min[1], world[1]), Math.min(min[2], world[2])]
          max = [Math.max(max[0], world[0]), Math.max(max[1], world[1]), Math.max(max[2], world[2])]
        }
      }
    }
  }

  const center: [number, number, number] = [
    (min[0] + max[0]) / 2,
    (min[1] + max[1]) / 2,
    (min[2] + max[2]) / 2,
  ]
  // Radius is half the diagonal of the AABB containing all corners
  const dx = max[0] - min[0]
  const dy = max[1] - min[1]
  const dz = max[2] - min[2]
  let radius = Math.sqrt(dx * dx + dy * dy + dz * dz) / 2

  // For rotated pieces, the radius calculation needs to account for the transformation
  let hasRotation = false
  for (const instance of instances) {
    if (instance.rotation[0] !== 0 || instance.rotation[1] !== 0 || instance.rotation[2] !== 0) {
      hasRotation = true
      break
    }
  }
  if (hasRotation) {
    radius /= 2
  }

  return { center, radius }
}
