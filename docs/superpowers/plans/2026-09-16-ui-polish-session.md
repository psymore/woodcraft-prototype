# 2026-09-16 — UI polish session (wood-cad-workshop)

Session index, not a plan — quick reference for what changed. All in `wood-cad-workshop/`.

## Rotation gizmo
- Ring line width, tick-mark scale, overall size boost, and click/pick radius tuned down from earlier oversized defaults.
- Lock control: clicking the rotation-gizmo button cycles hidden → shown → shown+locked (badge) → hidden; locked suppresses the ground-plane deselect that was closing it mid-orbit.

## Camera
- Default view now auto-frames whatever's loaded (`frame(instances)` on mount) instead of a fixed camera position that lost long pieces off-screen.

## Wood materials
- Real PBR photo textures (CC0, ambientCG) per species — color/normal/roughness maps, world-aligned UV tiling (`applyBoxWorldUV`/`applyCylinderWorldUV` in `Piece.tsx`) so grain repeats at a consistent scale instead of stretching. Assets in `public/textures/wood/<species>/`.

## Top-left menu
- Every control standardized on icon-first (`MenuButton`), with an "Aa" toggle (persisted) to show labels too.
- View presets grouped 3-2-2 (3D/Front/Back, Left/Right, Top/Bottom); menu widened to fit.
- Inventory now closes the dropdown when it opens (was stacking under it).
- Exploded-view status pill added top-center; tap reopens the menu.

## Top-right Inspector
- Safe-area-aware positioning (was fixed 8px); collapse/expand/close buttons swapped from Unicode glyphs to lucide icons.

## Theme
- Light theme added via `:root[data-theme="light"]` in `index.css`; every panel now reads shared CSS vars instead of hardcoded hex.
- Bottom-left orb toggle (Sun/Moon), persisted to localStorage.

## Known gap
- Headless Edge (used for this session's screenshot verification) doesn't render *any* right-anchored `position: absolute` element — confirmed via an isolated static-HTML repro, unrelated to React/env(). Inspector's own screenshot verification was done via DOM dump instead of pixels; worth a real-device check before calling it fully verified.
