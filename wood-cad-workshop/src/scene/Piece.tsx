import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { RefObject } from 'react'
import type { ThreeEvent } from '@react-three/fiber'
import { useThree } from '@react-three/fiber'
import { TransformControls, useTexture } from '@react-three/drei'
import * as THREE from 'three'
import { Line2, LineGeometry, LineMaterial } from 'three-stdlib'
import type { ComponentDefinition, ComponentInstance } from '../engine'
import { depthBiasFor, getBoxSize, getCylinderSize, getExplodedPosition, getSpecies, snapValue } from '../engine'
import { useSceneSession } from '../store/sceneSessionStore'
import { MIN_TAP_TARGET_RADIUS_PX, minWorldRadiusForPixels, worldRadiusToPixels } from './screenSpace'

// Fixed reference species for the useTexture call below — every Piece
// (including non-wood hardware with no speciesId) must call the hook with
// the same shape of arguments on every render, so pieces with no species
// still load *some* texture set (it's simply never applied to their
// material — see `woodMaterialMaps` below). Referencing an existing
// species here instead of hardcoding paths keeps this from drifting if
// species.ts's texture paths ever change.
const FALLBACK_WOOD_TEXTURES = getSpecies('red_oak')!.textures
// Roughly the real-world tile size (in the app's board-dimension units) the
// source photo textures were shot at — used below to build UVs that repeat
// the texture at a constant world-space scale, so grain reads at the same
// size on a short board and a long one instead of one full texture
// stretched (long pieces) or a single tiny tile blown up (short pieces).
const TEXTURE_TILE_UNITS = 24

// BoxGeometry's default UV is 0-1 per face regardless of that face's real
// size, so a wood texture would stretch differently on a board's long top
// face vs. its small end cap. Rewriting the UVs from each vertex's LOCAL
// position (not world position, so rotating a placed piece doesn't restretch
// its grain) and face normal — picking the two axes the face actually spans
// — makes every face tile at the same world-space rate instead.
function applyBoxWorldUV(geometry: THREE.BoxGeometry, tileUnits: number) {
  const position = geometry.attributes.position
  const normal = geometry.attributes.normal
  const uv = geometry.attributes.uv
  for (let i = 0; i < position.count; i++) {
    const nx = Math.abs(normal.getX(i))
    const ny = Math.abs(normal.getY(i))
    const nz = Math.abs(normal.getZ(i))
    let u: number
    let v: number
    if (nx >= ny && nx >= nz) {
      u = position.getZ(i)
      v = position.getY(i)
    } else if (ny >= nx && ny >= nz) {
      u = position.getX(i)
      v = position.getZ(i)
    } else {
      u = position.getX(i)
      v = position.getY(i)
    }
    uv.setXY(i, u / tileUnits, v / tileUnits)
  }
  uv.needsUpdate = true
}

// Same idea for the round rod's side wall — unwrap by arc length (angle ×
// radius, so a fat rod's grain doesn't stretch thinner than a slim one) and
// height, both in world units. Caps (top/bottom normal ~= ±Y) are left with
// their default UV — cylindrical unwrap math is singular at their center,
// and it's a small end-grain circle where that distortion would show most.
function applyCylinderWorldUV(geometry: THREE.CylinderGeometry, radius: number, tileUnits: number) {
  const position = geometry.attributes.position
  const normal = geometry.attributes.normal
  const uv = geometry.attributes.uv
  for (let i = 0; i < position.count; i++) {
    if (Math.abs(normal.getY(i)) > 0.5) continue
    const angle = Math.atan2(position.getZ(i), position.getX(i))
    uv.setXY(i, (angle * radius) / tileUnits, position.getY(i) / tileUnits)
  }
  uv.needsUpdate = true
}

const GRID_INCREMENT = 1
const GROUND_PLANE = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0)
const HANDLE_GAP = 1
const GIZMO_CLEARANCE_FACTOR = 1.4
const ROTATION_SNAP = THREE.MathUtils.degToRad(15)
const MOVE_HANDLE_RADIUS = 0.6
const MOVE_HANDLE_HEIGHT = 1.2
const MOVE_HANDLE_GLOW_SCALE = 1.35
const ROTATE_PICKER_TUBE_RADIUS = 0.45
const ROTATE_RING_LINE_WIDTH_PX = 1
// The small diamond/arrow tick mark on each ring (its rotation reference
// point) is tiny by default (octahedron radius 0.04) — scaled up in place,
// not touched by ROTATE_RING_LINE_WIDTH_PX since it's a separate mesh.
const ROTATE_TICK_SCALE = 1.75
// Extra headroom on top of the 44px-minimum sizing math below, so the whole
// gizmo (both the visible rings and their click area, which scale together
// via TransformControls' own `size` prop) reads as bigger and bolder overall.
const GIZMO_SIZE_BOOST = 1

// Called via TransformControls' ref when the rotate gizmo mounts (and again
// on canvas resize, since line width in pixels needs a fresh resolution).
// Removes the free-rotate ("E", yellow) ring — a fourth ring outside the
// piece's actual X/Y/Z axes that mostly just gets in the way — enlarges the
// invisible hit-test torus for the X/Y/Z rings so they're easier to grab,
// and swaps their thin (effectively 1px on most platforms, since
// LineBasicMaterial's linewidth is ignored by WebGL) visual ring lines for
// fat Line2/LineMaterial ones with a real pixel width. (A real shaded 3D
// torus was tried for the visible rings too, but the axis-orientation math
// needed to keep it aligned with three-stdlib's per-frame handle transform
// got fiddly for uncertain payoff — reverted in favor of this proven
// approach plus just making everything bigger via GIZMO_SIZE_BOOST.)
function tuneRotationGizmo(controls: THREE.Object3D | null, canvasWidth: number, canvasHeight: number) {
  if (!controls) return
  const eRings: THREE.Object3D[] = []
  controls.traverse((child) => {
    if (child.name === 'E') eRings.push(child)
  })
  eRings.forEach((child) => child.parent?.remove(child))

  // A per-mesh `.scale` doesn't stick here: three-stdlib's own
  // updateMatrixWorld unconditionally resets every handle's scale every
  // frame (`handle.scale.set(1,1,1).multiplyScalar(factor * size / 7)`,
  // the same screen-constant-sizing math as elsewhere in this file) to keep
  // the whole gizmo's apparent size correct — so a one-time scale-up here
  // gets silently wiped the very next frame. Enlarging the picker's own
  // geometry (its tube radius, not its scale) survives that reset, since
  // the per-frame code scales whatever shape is there uniformly along with
  // every other handle, not just this one.
  controls.traverse((child) => {
    if (
      (child.name === 'X' || child.name === 'Y' || child.name === 'Z') &&
      child instanceof THREE.Mesh &&
      child.geometry instanceof THREE.TorusGeometry &&
      !child.userData.isEnlargedPicker
    ) {
      const { radius, radialSegments, tubularSegments } = child.geometry.parameters
      const enlarged = new THREE.TorusGeometry(radius, ROTATE_PICKER_TUBE_RADIUS, radialSegments, tubularSegments)
      // A full torus is rotationally symmetric about its own hole axis, so
      // only which plane it lies in matters (not the roll baked into the
      // original geometry) — default TorusGeometry lies in the XY plane
      // (hole along Z), so X needs a Y-rotation and Y an X-rotation to
      // reach their planes; Z already matches.
      if (child.name === 'X') enlarged.rotateY(Math.PI / 2)
      if (child.name === 'Y') enlarged.rotateX(Math.PI / 2)
      child.geometry.dispose()
      child.geometry = enlarged
      // The library's own "invisible" picker material is ~15% opacity —
      // thin enough at its original tube radius to read as invisible, but
      // this much fatter tube stacks many overlapping torus layers per
      // screen pixel, compounding that 15% into a visibly solid blob.
      // Raycasting only needs `visible: true` and doesn't care about
      // opacity, so drop it to fully transparent instead.
      const material = child.material as THREE.Material
      material.opacity = 0
      child.userData.isEnlargedPicker = true
    }
  })

  // The small diamond/arrow tick mark on each ring (three-stdlib's own
  // OctahedronGeometry, marking that ring's rotation reference point) is a
  // separate mesh from both the ring line and its picker, and untouched by
  // either fix above — enlarge it in place, scaling around its own baked
  // center (not the ring's origin) so it stays sitting on the ring instead
  // of drifting outward the way a naive origin-based scale would.
  controls.traverse((child) => {
    if (
      (child.name === 'X' || child.name === 'Y' || child.name === 'Z') &&
      child instanceof THREE.Mesh &&
      child.geometry instanceof THREE.OctahedronGeometry &&
      !child.userData.isEnlargedTick
    ) {
      child.geometry.computeBoundingBox()
      const center = new THREE.Vector3()
      child.geometry.boundingBox!.getCenter(center)
      child.geometry.translate(-center.x, -center.y, -center.z)
      child.geometry.scale(ROTATE_TICK_SCALE, ROTATE_TICK_SCALE, ROTATE_TICK_SCALE)
      child.geometry.translate(center.x, center.y, center.z)
      child.userData.isEnlargedTick = true
    }
  })

  // Already built on a previous mount/resize — just refresh the pixel
  // width's resolution uniform (it depends on canvas size) rather than
  // rebuilding (which would pile up duplicate thick rings).
  let hasThickRings = false
  controls.traverse((child) => {
    if (child.userData.isThickRotateRing) {
      hasThickRings = true
      ;(child as InstanceType<typeof Line2>).material.resolution.set(canvasWidth, canvasHeight)
    }
  })
  if (hasThickRings) return

  const originals: THREE.Line[] = []
  controls.traverse((child) => {
    if (
      (child.name === 'X' || child.name === 'Y' || child.name === 'Z') &&
      child instanceof THREE.Line &&
      !(child instanceof THREE.LineSegments)
    ) {
      originals.push(child)
    }
  })
  originals.forEach((line) => {
    const positions = Array.from((line.geometry.getAttribute('position') as THREE.BufferAttribute).array)
    const geometry = new LineGeometry()
    geometry.setPositions(positions)
    const baseMaterial = line.material as THREE.LineBasicMaterial
    const material = new LineMaterial({
      color: baseMaterial.color.getHex(),
      linewidth: ROTATE_RING_LINE_WIDTH_PX,
      transparent: true,
      opacity: baseMaterial.opacity,
      depthTest: false,
      depthWrite: false,
    })
    material.resolution.set(canvasWidth, canvasHeight)
    const thickLine = new Line2(geometry, material)
    // Same name as the original so it inherits three-stdlib's per-frame
    // camera-facing quaternion update (matched by exact handle.name).
    thickLine.name = line.name
    thickLine.renderOrder = line.renderOrder
    thickLine.userData.isThickRotateRing = true
    line.visible = false
    line.parent?.add(thickLine)
  })
}

export function Piece({
  instance,
  definition,
  centroid,
  multiTouchActiveRef,
}: {
  instance: ComponentInstance
  definition: ComponentDefinition
  centroid: [number, number, number]
  multiTouchActiveRef: RefObject<boolean>
}) {
  const selected = useSceneSession((s) => s.selectedId === instance.id)
  const explodeAmount = useSceneSession((s) => s.explodeAmount)
  const selectPiece = useSceneSession((s) => s.selectPiece)
  const movePiece = useSceneSession((s) => s.movePiece)
  const setDraggingPiece = useSceneSession((s) => s.setDraggingPiece)
  const setRotation = useSceneSession((s) => s.setRotation)
  const showRotationGizmo = useSceneSession((s) => s.showRotationGizmo)
  const showMoveHandle = useSceneSession((s) => s.showMoveHandle)
  const camera = useThree((s) => s.camera)
  const canvasSize = useThree((s) => s.size)

  const species = getSpecies(instance.speciesId)
  const woodTextureInputs = useTexture({
    map: species?.textures.color ?? FALLBACK_WOOD_TEXTURES.color,
    normalMap: species?.textures.normal ?? FALLBACK_WOOD_TEXTURES.normal,
    roughnessMap: species?.textures.roughness ?? FALLBACK_WOOD_TEXTURES.roughness,
  })
  // Tiling itself is done by the geometry's own UVs (applyBoxWorldUV /
  // applyCylinderWorldUV below), not by `texture.repeat` — so, unlike the
  // per-instance repeat this used to compute, the maps here are the SHARED
  // textures useTexture returns, safe to reuse across every board of the
  // same species without cloning. Only the wrap mode needs setting (once
  // is enough — repeat-setting on an already-repeat-wrapped texture is a
  // harmless no-op — so this doesn't need to be more than a plain `if`).
  if (species) {
    ;[woodTextureInputs.map, woodTextureInputs.normalMap, woodTextureInputs.roughnessMap].forEach((texture) => {
      if (texture.wrapS === THREE.RepeatWrapping) return
      texture.wrapS = texture.wrapT = THREE.RepeatWrapping
      texture.needsUpdate = true
    })
    woodTextureInputs.map.colorSpace = THREE.SRGBColorSpace
  }
  const woodMaterialMaps = species ? woodTextureInputs : null

  const tuneRotationGizmoRef = useCallback(
    (controls: THREE.Object3D | null) => tuneRotationGizmo(controls, canvasSize.width, canvasSize.height),
    [canvasSize.width, canvasSize.height],
  )

  // State-backed callback ref, not useRef: TransformControls needs the real
  // group object at render time. A useRef is null on the first render and
  // mutating it never re-renders, so a piece that mounts already-selected
  // (e.g. right after DUPLICATE) would leave the gizmo attached to drei's
  // own empty wrapper at the origin.
  const [group, setGroup] = useState<THREE.Group | null>(null)

  const dragging = useRef(false)
  const dragOffset = useRef<[number, number]>([0, 0])

  const verticalDragging = useRef(false)
  const verticalDragOffset = useRef(0)
  const verticalPlane = useRef(new THREE.Plane())

  // TransformControls listens for pointer events directly on the canvas,
  // entirely separately from R3F's synthetic onPointerDown/onPointerMove
  // below — so grabbing a rotate ring (which usually also intersects the
  // piece's own box mesh underneath it) starts BOTH a rotation and this
  // piece's own translate-drag from the same gesture. Since TransformControls'
  // native listener fires after R3F's (it attaches later, once mounted), by
  // the time its 'mouseDown' event reaches us the piece has already started
  // dragging — this ref lets the move handlers below bail out on the next
  // pointermove instead, so rotating never also drags the piece.
  const gizmoActive = useRef(false)

  const groundHit = (ray: THREE.Ray): THREE.Vector3 | null => {
    const target = new THREE.Vector3()
    return ray.intersectPlane(GROUND_PLANE, target)
  }

  const verticalHit = (ray: THREE.Ray): THREE.Vector3 | null => {
    const target = new THREE.Vector3()
    return ray.intersectPlane(verticalPlane.current, target)
  }

  const handleVerticalPointerDown = (e: ThreeEvent<PointerEvent>) => {
    if (multiTouchActiveRef.current || explodeAmount > 0) return
    e.stopPropagation()
    ;(e.target as Element).setPointerCapture(e.pointerId)
    verticalDragging.current = true
    setDraggingPiece(true)
    // Vertical plane through the piece's X/Z, facing the camera horizontally
    // so a straight up/down drag on screen tracks a straight up/down move.
    const facing = new THREE.Vector3()
    camera.getWorldDirection(facing)
    facing.y = 0
    if (facing.lengthSq() < 1e-6) facing.set(0, 0, 1)
    facing.normalize()
    verticalPlane.current.setFromNormalAndCoplanarPoint(
      facing,
      new THREE.Vector3(instance.position[0], instance.position[1], instance.position[2]),
    )
    const hit = verticalHit(e.ray)
    verticalDragOffset.current = hit ? instance.position[1] - hit.y : 0
  }

  const handleVerticalPointerMove = (e: ThreeEvent<PointerEvent>) => {
    if (!verticalDragging.current || multiTouchActiveRef.current || gizmoActive.current) return
    const hit = verticalHit(e.ray)
    if (!hit) return
    const snappedY = Math.max(0, snapValue(hit.y + verticalDragOffset.current, GRID_INCREMENT))
    movePiece(instance.id, [instance.position[0], snappedY, instance.position[2]])
  }

  const handleVerticalPointerUp = (e: ThreeEvent<PointerEvent>) => {
    verticalDragging.current = false
    setDraggingPiece(false)
    ;(e.target as Element).releasePointerCapture(e.pointerId)
  }

  const handlePointerDown = (e: ThreeEvent<PointerEvent>) => {
    if (multiTouchActiveRef.current || explodeAmount > 0) return
    e.stopPropagation()
    ;(e.target as Element).setPointerCapture(e.pointerId)
    selectPiece(instance.id)
    dragging.current = true
    setDraggingPiece(true)
    const hit = groundHit(e.ray)
    dragOffset.current = hit ? [instance.position[0] - hit.x, instance.position[2] - hit.z] : [0, 0]
  }

  const handlePointerMove = (e: ThreeEvent<PointerEvent>) => {
    if (!dragging.current || multiTouchActiveRef.current || gizmoActive.current) return
    // Deliberately e.ray, not e.point: once the pointer is captured,
    // e.point/e.object replay a stale intersection from pick time if the
    // live raycast no longer hits this mesh. e.ray is always live.
    const hit = groundHit(e.ray)
    if (!hit) return
    const [offsetX, offsetZ] = dragOffset.current
    const snappedX = snapValue(hit.x + offsetX, GRID_INCREMENT)
    const snappedZ = snapValue(hit.z + offsetZ, GRID_INCREMENT)
    movePiece(instance.id, [snappedX, instance.position[1], snappedZ])
  }

  const handlePointerUp = (e: ThreeEvent<PointerEvent>) => {
    dragging.current = false
    setDraggingPiece(false)
    ;(e.target as Element).releasePointerCapture(e.pointerId)
  }

  const handleGizmoChange = () => {
    if (!group) return
    setRotation(instance.id, [group.rotation.x, group.rotation.y, group.rotation.z])
  }

  // Cyan-blue, not orange: orange is already spoken for by the active-toggle
  // accent (GizmoToggles/panelButtonStyle) and the point-point candidate
  // color (ConnectionMarkers.tsx) — selection is a different concept from
  // either and shouldn't share their hue family.
  // With a texture map applied, `color` multiply-tints it (white = show the
  // map's true colors, cyan = the existing selection glow drawn over the
  // wood grain instead of replacing it) rather than being the piece's only
  // color source the way it is for untextured hardware.
  const color = selected ? '#4fd1ff' : woodMaterialMaps ? '#ffffff' : instance.material
  const displayPosition = getExplodedPosition(instance.position, centroid, explodeAmount)

  const showVerticalHandle = selected && explodeAmount === 0 && showMoveHandle
  const showGizmo = selected && explodeAmount === 0 && showRotationGizmo

  // The handle is a SIBLING of the rotating group, so it stays in world space:
  // pieces can now pitch/roll, and a child at local +Y would swing off to the
  // side while its drag logic still moves along world Y. To sit right at the
  // piece's actual top (not a generic over-estimate), rotate each local
  // half-extent by the piece's current orientation and take the axis-aligned
  // bounding box's Y half-extent — the standard "abs(rotated basis) · extent"
  // formula, using the same Euler order ('XYZ') the group itself renders with.
  const getVerticalExtent = (halfExtents: [number, number, number]) => {
    const [hx, hy, hz] = halfExtents
    const euler = new THREE.Euler(instance.rotation[0], instance.rotation[1], instance.rotation[2], 'XYZ')
    return (
      Math.abs(new THREE.Vector3(hx, 0, 0).applyEuler(euler).y) +
      Math.abs(new THREE.Vector3(0, hy, 0).applyEuler(euler).y) +
      Math.abs(new THREE.Vector3(0, 0, hz).applyEuler(euler).y)
    )
  }

  // The rotation gizmo keeps a constant SCREEN size regardless of camera
  // distance/zoom, so its world-space radius isn't a fixed number — it has
  // to be computed the same way drei's bundled TransformControls computes
  // its own handle scale (three-stdlib/controls/TransformControls.cjs,
  // `updateMatrixWorld`: factor = distance * min(1.9*tan(fov/2)/zoom, 7),
  // handle.scale = factor * size/7), so the handle can clear it at any zoom
  // level instead of just a fixed margin that only works at some distances.
  // 1 is the local radius of the X/Y/Z rotate rings — the largest ones
  // still rendered now that tuneRotationGizmo (below) removes the free-
  // rotate ("E") ring, which used to be the outermost at 1.25. Keeping this
  // in sync with what's actually still on screen matters for both the
  // handle-clearance use below and the tap-target sizing further down —
  // otherwise both undershoot, sizing against a ring that no longer exists.
  const getGizmoOuterRadius = () => {
    if (!showGizmo) return 0
    const cam = camera as THREE.PerspectiveCamera
    const worldPosition = new THREE.Vector3(...displayPosition)
    const distance = worldPosition.distanceTo(cam.position)
    const factor = distance * Math.min((1.9 * Math.tan((Math.PI * cam.fov) / 360)) / (cam.zoom || 1), 7)
    const gizmoSize = 1
    const outerRingLocalRadius = 1
    return ((factor * gizmoSize) / 7) * outerRingLocalRadius
  }

  // Even though the gizmo's angular size is already zoom-constant (above),
  // its actual on-screen pixel size still depends on canvas height/fov, so
  // at a narrow enough viewport it can still render under the 44px tap
  // target minimum. `size` is a linear multiplier drei's TransformControls
  // applies to that same formula, so this converts the current radius to
  // pixels and scales it up (never down) to clear the minimum — then
  // GIZMO_SIZE_BOOST makes the whole gizmo (rings and their click area
  // together, both driven by this same `size` prop) bigger across the
  // board, not just at the bare minimum.
  const getGizmoSizeMultiplier = () => {
    if (!showGizmo) return 1
    const cam = camera as THREE.PerspectiveCamera
    const worldPosition = new THREE.Vector3(...displayPosition)
    const currentPixels = worldRadiusToPixels(getGizmoOuterRadius(), worldPosition, cam, canvasSize.height)
    if (currentPixels <= 0) return GIZMO_SIZE_BOOST
    return Math.max(GIZMO_SIZE_BOOST, (MIN_TAP_TARGET_RADIUS_PX / currentPixels) * GIZMO_SIZE_BOOST)
  }

  const verticalHandle = (halfExtents: [number, number, number]) => {
    if (!showVerticalHandle) return null
    // When the rotation gizmo is also showing, clear its rings with real
    // headroom (not just their bare radius) so the cone reads as a clearly
    // separate control instead of nearly touching the topmost ring. Scaled
    // by the same size multiplier the gizmo itself renders at (including
    // GIZMO_SIZE_BOOST), since getGizmoOuterRadius() alone is the
    // pre-boost radius — otherwise a bigger gizmo would outgrow this
    // clearance and the cone would sit too close again.
    const gizmoRenderedRadius = getGizmoOuterRadius() * getGizmoSizeMultiplier()
    const gizmoClearance = showGizmo ? gizmoRenderedRadius * GIZMO_CLEARANCE_FACTOR : gizmoRenderedRadius
    const position: [number, number, number] = [
      displayPosition[0],
      displayPosition[1] + Math.max(getVerticalExtent(halfExtents), gizmoClearance) + HANDLE_GAP,
      displayPosition[2],
    ]
    // Fixed world-unit geometry shrinks below a comfortable tap target when
    // zoomed out — scale the whole cone up (never down) so its rendered
    // radius never falls under the app's 44px minimum.
    const minRadius = minWorldRadiusForPixels(MIN_TAP_TARGET_RADIUS_PX, new THREE.Vector3(...position), camera as THREE.PerspectiveCamera, canvasSize.height)
    const scale = Math.max(1, minRadius / MOVE_HANDLE_RADIUS)
    return (
      <group position={position} scale={scale}>
        {/* Every child below is shifted up by its own half-height (scaled by
            its own local `scale`, since that's applied before the position
            offset) so its BASE — not its center — sits at this group's
            local origin. That keeps the base pinned exactly at `position`
            (the piece's surface + gap) regardless of how big `scale` grows
            when zoomed out — a centered cone would grow downward into the
            piece as it scaled up. */}
        {/* Glow halo — additive, non-interactive, drawn just behind the
            outlined cone below. Same technique as the connection markers'
            glow halos (ConnectionMarkers.tsx/AnchorMarkers.tsx): a larger,
            faint, no-depth-write duplicate for a cheap neon feel. */}
        <mesh position={[0, (MOVE_HANDLE_HEIGHT / 2) * MOVE_HANDLE_GLOW_SCALE, 0]} scale={MOVE_HANDLE_GLOW_SCALE} raycast={() => null}>
          <coneGeometry args={[MOVE_HANDLE_RADIUS, MOVE_HANDLE_HEIGHT, 12]} />
          <meshBasicMaterial color="#4a90d9" transparent opacity={0.35} blending={THREE.AdditiveBlending} depthWrite={false} depthTest={false} />
        </mesh>
        {/* Transparent fill with a crisp edge outline — the neon-border
            look, reusable for other pin-like handles if it reads well. */}
        <mesh
          position={[0, MOVE_HANDLE_HEIGHT / 2, 0]}
          onPointerDown={handleVerticalPointerDown}
          onPointerMove={handleVerticalPointerMove}
          onPointerUp={handleVerticalPointerUp}
        >
          <coneGeometry args={[MOVE_HANDLE_RADIUS, MOVE_HANDLE_HEIGHT, 12]} />
          <meshBasicMaterial color="#4a90d9" transparent opacity={0.12} depthWrite={false} />
        </mesh>
        <lineSegments position={[0, MOVE_HANDLE_HEIGHT / 2, 0]} raycast={() => null}>
          <edgesGeometry args={[new THREE.ConeGeometry(MOVE_HANDLE_RADIUS, MOVE_HANDLE_HEIGHT, 12)]} />
          <lineBasicMaterial color="#7ec8ff" />
        </lineSegments>
      </group>
    )
  }

  if (definition.geometry.shape === 'cylinder') {
    const { radius, height } = getCylinderSize(instance)
    const cylinderGeometry = useMemo(() => {
      const geometry = new THREE.CylinderGeometry(radius, radius, height, 16)
      if (woodMaterialMaps) applyCylinderWorldUV(geometry, radius, TEXTURE_TILE_UNITS)
      return geometry
    }, [radius, height, woodMaterialMaps])
    // <primitive>, unlike a declarative <cylinderGeometry>, isn't
    // auto-disposed by R3F on change/unmount — this geometry is
    // user-constructed (for the custom UVs above), so its disposal is too.
    useEffect(() => () => cylinderGeometry.dispose(), [cylinderGeometry])
    return (
      <>
        <group ref={setGroup} position={displayPosition} rotation={instance.rotation}>
          <mesh
            rotation={[Math.PI / 2, 0, 0]}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
          >
            <primitive object={cylinderGeometry} attach="geometry" />
            <meshStandardMaterial
              color={color}
              map={woodMaterialMaps?.map}
              normalMap={woodMaterialMaps?.normalMap}
              roughnessMap={woodMaterialMaps?.roughnessMap}
              polygonOffset
              polygonOffsetFactor={depthBiasFor(instance.id)}
              polygonOffsetUnits={depthBiasFor(instance.id)}
            />
          </mesh>
        </group>
        {verticalHandle([radius, radius, height / 2])}
        {showGizmo && group && (
          <TransformControls
            ref={tuneRotationGizmoRef}
            object={group}
            mode="rotate"
            space="world"
            size={getGizmoSizeMultiplier()}
            rotationSnap={ROTATION_SNAP}
            showX
            showY
            showZ
            onMouseDown={() => {
              gizmoActive.current = true
            }}
            onMouseUp={() => {
              gizmoActive.current = false
            }}
            onObjectChange={handleGizmoChange}
          />
        )}
      </>
    )
  }

  const size = getBoxSize(instance)
  const boxGeometry = useMemo(() => {
    const geometry = new THREE.BoxGeometry(...size)
    if (woodMaterialMaps) applyBoxWorldUV(geometry, TEXTURE_TILE_UNITS)
    return geometry
  }, [size[0], size[1], size[2], woodMaterialMaps])
  useEffect(() => () => boxGeometry.dispose(), [boxGeometry])
  return (
    <>
      <group ref={setGroup} position={displayPosition} rotation={instance.rotation}>
        <mesh
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
        >
          <primitive object={boxGeometry} attach="geometry" />
          <meshStandardMaterial
            color={color}
            map={woodMaterialMaps?.map}
            normalMap={woodMaterialMaps?.normalMap}
            roughnessMap={woodMaterialMaps?.roughnessMap}
            polygonOffset
            polygonOffsetFactor={depthBiasFor(instance.id)}
            polygonOffsetUnits={depthBiasFor(instance.id)}
          />
        </mesh>
      </group>
      {verticalHandle([size[0] / 2, size[1] / 2, size[2] / 2])}
      {showGizmo && group && (
        <TransformControls
          ref={tuneRotationGizmoRef}
          object={group}
          mode="rotate"
          space="world"
          size={getGizmoSizeMultiplier()}
          rotationSnap={ROTATION_SNAP}
          showX
          showY
          showZ
          onMouseDown={() => {
            gizmoActive.current = true
          }}
          onMouseUp={() => {
            gizmoActive.current = false
          }}
          onObjectChange={handleGizmoChange}
        />
      )}
    </>
  )
}
