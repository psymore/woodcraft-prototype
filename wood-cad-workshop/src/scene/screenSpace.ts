import * as THREE from 'three'

// World-units-per-pixel at a given world position, for a perspective
// camera — standard "visible height at distance / canvas height" ratio,
// vertical FOV. Shared by every world-space handle that needs to enforce
// a minimum on-screen tap-target size (which would otherwise shrink with
// zoom/distance like any other scene geometry).
function worldUnitsPerPixel(worldPosition: THREE.Vector3, camera: THREE.PerspectiveCamera, canvasHeightPx: number): number {
  const distance = worldPosition.distanceTo(camera.position)
  const halfFovRad = (Math.PI * camera.fov) / 360
  return (2 * distance * Math.tan(halfFovRad)) / (camera.zoom || 1) / canvasHeightPx
}

// Minimum world-space radius that would render as `minPixels` on screen at
// this world position — feed into Math.max(existingRadius, ...) so nearby
// objects keep their intended (larger) size and only distant/zoomed-out
// ones get boosted.
export function minWorldRadiusForPixels(
  minPixels: number,
  worldPosition: THREE.Vector3,
  camera: THREE.PerspectiveCamera,
  canvasHeightPx: number,
): number {
  return minPixels * worldUnitsPerPixel(worldPosition, camera, canvasHeightPx)
}

// Inverse: how many on-screen pixels a given world-space radius currently
// renders as, at this world position.
export function worldRadiusToPixels(
  worldRadius: number,
  worldPosition: THREE.Vector3,
  camera: THREE.PerspectiveCamera,
  canvasHeightPx: number,
): number {
  return worldRadius / worldUnitsPerPixel(worldPosition, camera, canvasHeightPx)
}

// Half of the app's 44px minimum tap-target convention.
export const MIN_TAP_TARGET_RADIUS_PX = 22
