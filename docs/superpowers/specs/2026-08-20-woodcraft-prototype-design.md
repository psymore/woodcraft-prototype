# Woodcraft Prototype — Design

Status: approved for Prototype 0 (Panda3D spike). Later stages (platform
decision, Godot/R3F rewrite) are directional, not committed.

## Product concept

A mobile-first 3D sandbox for building furniture and wooden structures out
of typed, real wood pieces (boards, panels, beams, dowels, blocks) rather
than generic 3D primitives. The core differentiator is smart snapping
between pieces plus a live cut list, so assembling a model feels like
assembling real wood, not manipulating boxes.

Not a general-purpose CAD tool, not a parametric modeler, not a physics
sandbox. Scope is deliberately narrow: place, size, and connect wood
pieces with enough precision to produce a usable cut list.

## Modeling philosophy

Board-based typed primitives with anchor-driven, snap-based soft
constraints. No parametric feature history, no general constraint solver,
no CSG boolean engine in the near-term roadmap. Geometry stays to extruded
rectangular prisms and cylinders, procedurally generated from a piece's
type + dimensions — resizing regenerates geometry rather than swapping
assets.

This trades modeling generality for implementation speed and touch
usability. Holes/notches/joinery are visual (decals, ghost previews), not
real boolean cuts, until there's a concrete reason to invest in a CSG
engine.

## Wood piece data model

A `Piece` has:

- `id`, `type` (board | panel | beam | dowel | block | custom)
- nominal dimensions using lumber semantics: `thickness`, `width`,
  `length` (not generic w/h/d)
- `transform` (position, rotation)
- `material_id` (color/texture reference only — no physical properties)
- `grain_direction` vector
- `anchors[]` — procedurally computed from type + dimensions: corners,
  edge midpoints, face centers, end centers. This is the single most
  important abstraction in the system; the snapping system operates
  entirely on anchor proximity.
- `cut_ops[]` — empty in v1, reserved for future notch/hole modifiers
- `parent_group_id`

A `Group` is one level deep (piece ids + a transform) — no nesting yet.

A `Project` = pieces + groups + materials (small used-palette) + camera
state + metadata (name, timestamps). Measurements and joints are not
separate top-level entities; they're derived from anchors and piece data.

## Operations

**v1 (essential):** create from type/preset/custom dims, move, rotate
(snapped to 15/45/90°), resize via end/face handles, duplicate, delete,
group/ungroup, anchor-based snapping, align, live measurement readout,
undo/redo.

**v2:** mirror, distribute, boolean-lite subtract for dowel/screw holes,
cosmetic chamfer/bevel, joint-hinting templates (visual only), collision
warnings, auto cut list/BOM, dimension validation against stock sizes,
exploded view toggle.

**Explicitly deferred, resist scope creep here:** true parametric
joinery geometry (dovetails, mortise-tenon), physics/stability
simulation, curved/bent pieces, procedural species-accurate grain
shaders, AR room placement, multiplayer/collab, a real CSG engine,
sheet-goods nesting/optimization.

## Woodworking intelligence (ranked wow/effort)

1. Anchor-based smart snapping (edge/face/end) — the core differentiator
2. Standard lumber presets (2×4, 1×6, ¾" ply, dowel sizes)
3. Live cut list / BOM
4. Live dimension readout during drag/resize
5. Joint hinting — ghost-preview a corner/butt joint at 90° proximity,
   snaps into place; decorated snapping logic, no real joinery geometry
6. Overlap/collision highlighting
7. Grain-direction auto-orient
8. Decal-style screw/dowel hole markers at joints
9. Material estimate (board-feet / sheet count), falls out of the cut list

Build 1–5 for the "wow" milestone. None require CSG, physics, or a
constraint solver.

## Mobile interaction design

- Tap empty space → deselect, camera gestures active. Tap a piece →
  select, show outline + contextual floating toolbar. This single rule
  (hit-target determines camera vs. object mode) is the primary defense
  against accidental manipulation.
- Move: single-finger drag on a selected piece, constrained to a plane
  by default; axis-lock affordance in the toolbar for precision. Free 3D
  translation from 2D touch is deliberately not attempted.
- Rotate: two-finger twist, snapping at 15/45/90° with haptic ticks.
- Resize: physical handles at the piece's actual ends/faces, not a
  generic bounding-box gizmo.
- Precision: bottom-sheet numeric panel for exact dimensions/position,
  reachable from the toolbar. Touch handles the rough 90%, numeric entry
  the precise last 10%.
- Snap: proximity-lit candidate anchors during drag; release near one to
  snap with visual/haptic confirmation.
- No full-screen modals — bottom sheets only, so the 3D view stays
  visible.

## Camera system

One-finger drag on empty space = orbit, two-finger drag = pan, pinch =
zoom (matches existing mobile-3D-app muscle memory). Preset view buttons
(Front/Top/Side/Iso, Frame All, Frame Selected) are cheap and directly
address the "lost in 3D space" failure mode common to mobile 3D apps.

## Visual design

Cheapest-per-perceived-quality effects: fake soft contact-shadow blob per
piece (not real SSAO), subtle edge bevel on every piece, tileable
wood-grain textures with per-species tint (not procedural noise shaders),
distance-fading ground grid, color-rim selection outlines, one low-res
shadow map. Explicitly skip real-time GI, full PBR, reflections,
particles, procedural noise wood shaders.

## Precision & dimensions

mm/cm/inch including fractional inches (3/4", 5/8") — decimal-only
inches would read as inauthentic to a woodworking audience. Configurable
snap increment. Two-point tap-to-measure tool. Angle shown live during
rotate gesture. Raw XYZ coordinates are secondary/inspector info, not
primary UI.

## Persistence

Local-first, single JSON project file + a rendered thumbnail PNG. No
cloud/sync in scope. Undo/redo via a command stack (before/after state,
pushed once per completed gesture on release, not per frame) is
considered non-negotiable for v1 — it's what makes the sandbox feel safe
to experiment in. Autosave (periodic, given mobile OS backgrounding
behavior) is likewise non-negotiable.

## Export

Realistic early: PNG screenshot export, plain-text/PDF cut list.
Later: GLB/glTF (AR Quick Look, interop), dimensioned DXF/PDF plans.
Explicitly skipped: OBJ (GLB supersedes it), STL (no 3D-printing use
case here).

## Technology strategy

Pure Python has no mature, production-ready path to real-time 3D on
iOS+Android today. Panda3D/PyOpenGL/pyglet are desktop-only in practice;
Kivy has real mobile deployment but thin/manual 3D support that would
slow down the exact features that matter most; Godot-Python bindings are
unmaintained/experimental.

Strategy: use Python + Panda3D **only** for Prototype 0, a days-scale
spike to test whether board-based snapping is fun, in the fastest
possible language for a solo Python developer. Do not build a second full
desktop implementation on top of it — Prototype 1 onward moves directly
to whichever engine will ship to mobile, developed on desktop for fast
iteration and exported to a device only once the interaction design is
validated. Only the *design* (data model, snapping math, anchor logic)
carries forward from Prototype 0, not the code.

Leading candidate for the real engine: **Godot** (GDScript), because (a)
its mobile export is mature/native rather than a WebView wrapper, which
matters for sustained 3D touch performance and battery, and (b)
GDScript's syntax is close enough to Python that it's a materially
smaller retraining cost than jumping to React + Three.js/R3F's
declarative-component-over-imperative-WebGL paradigm. Three.js/R3F
remains the right call if web-first distribution (shareable link, no
app-store friction, possible desktop version) turns out to matter more
than native mobile feel — this should be settled by a short comparative
spike, not assumed.

Desktop-mouse prototyping (Prototype 0) validates the modeling concept
but cannot validate touch-gesture feel, which is the #1 mobile-3D UX
failure mode. That risk is only real once tested on the actual target
engine with touch input (device or emulator).

## Roadmap

- **Prototype 0** (days, Panda3D, this repo): 3–4 hardcoded boards,
  mouse orbit/pan/zoom, click-select, single-plane drag, grid-only snap.
  No mobile, no piece-to-piece snapping, no UI chrome, no save. Purpose:
  cheaply answer "is board-based assembly fun" before anything else.
- **Platform decision + comparative touch spike** (new stage, not yet
  scheduled): build the same tiny snap-a-board test in Godot and/or
  Three.js/R3F on a real device or emulator, evaluate touch feel and
  rendering performance, pick one.
- **Prototype 1 → Version 0.5** (target engine, collapsed into one
  continuous track): real piece types + lumber presets, full anchor
  snapping, contextual toolbar, resize handles, undo/redo, materials,
  JSON save/load, touch gesture set, cut list/BOM, joint hinting, PNG
  export, autosave, preset views, visual polish (shadow/bevel/grain),
  exploded view toggle. This is the "a stranger on a phone says this is
  useful" milestone.
- **Version 1.0**: GLB export + AR Quick Look, dimensioned PDF/DXF plans,
  richer material library, group nesting, mirror/distribute, decal-style
  holes/notches, onboarding, multi-project management, LOD/instancing
  perf pass. Still deferred: real joinery geometry, physics,
  collaboration, full CSG.

## Alternative product directions considered, not pursued now

1. AR-anchored real-world measuring/planning tool (sidesteps the camera
   gesture problem entirely by using the real environment as the
   "camera").
2. Cut-list-first tool with 3D as a secondary live preview — avoids most
   of the mobile-3D-interaction risk surface; arguably more useful to a
   working woodworker. Flagged as the most interesting alternative if
   this prototype's core loop doesn't prove compelling.
3. Modular joinery / "wooden LEGO" snap-together micro-builder — trades
   modeling freedom for a much smaller, faster-to-polish v1.

## Immediate scope: Prototype 0

Only this stage is approved to implement right now. Everything from
"Platform decision" onward is directional and will be re-scoped with its
own design/plan when reached.
