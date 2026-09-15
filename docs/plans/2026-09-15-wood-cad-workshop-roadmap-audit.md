# Audit: wood-cad-workshop vs. the 10-area planning context

## Context

The user pasted a 10-area Turkish-language planning-context document (originally
meant to feed a cross-product roadmap alongside a mobile game and a grocery
app) and asked for a comparison against the current repo state: what's
already built in `wood-cad-workshop/`, what's missing, and what's purely
directional/roadmap. This is a research/reporting deliverable, not an
implementation plan — no code changes are proposed here. Two Explore agents
gathered the findings below: one read the design docs and
`ACTIVE-WORK-vscode.md`, the other surveyed `wood-cad-workshop/src/`.

## Headline finding: roadmap status is stale

Per `docs/superpowers/specs/2026-08-22-wood-cad-workshop-design.md`, the
formally *approved* scope was only ever "Sub-project 1 (Foundation)" — but a
2026-08-24 decision note superseded even that: an ad-hoc Stage 0-8
comparative benchmark ran across both engines at once (covering roughly the
original Sub-projects 1-5), the engine decision went to Three.js, and all
work since has been user-directed (rotation gizmo, theme system, part-joining
system, species database, connection-anchor primitives) rather than following
the original 7-sub-project sequence. **There is currently no live, approved
"immediate scope" document for `wood-cad-workshop/`'s next feature work** —
`ACTIVE-WORK-vscode.md` explicitly flags that a proper per-feature plan
hasn't been written yet.

This matters for the planning-context document's own stated principle
("mevcut çalışan temel → UI baseline → core workflow → connection system →
bug backlog → MVP → release → roadmap") — the project has already moved
past strict sequencing and jumped ahead on connection-system and structural
work while some earlier-sequence items (save/load, BOM) remain untouched.

## Area-by-area comparison

### 1. Mevcut durum ve teknik temel — ✅ largely settled
- Three.js vs Godot decision made and recorded; Godot retired (kept on disk,
  untracked).
- Architecture in place: registry pattern (`src/engine/registry/registry.ts`),
  pure functional core (`src/engine/core/*`, no React/three imports) vs.
  React layer (`src/scene/*`, `src/ui/*`), single Zustand session store
  (`src/store/sceneSessionStore.ts`).
- Test coverage exists per-core-module (`*.test.ts` alongside nearly every
  `engine/core` file) — a TDD-ish discipline, but no automated e2e/browser
  suite (manual smoke testing only).
- Known technical debt (explicitly flagged, "do not patch opportunistically"
  per `ACTIVE-WORK-vscode.md`):
  - Segment-kind anchor `param.t` stored as normalized fraction, not material
    coordinate → resize-staleness detection doesn't fire for segment
    connections.
  - Box "edge" segment anchors sit at the sibling face's centerline, not true
    box edges — spec language ("two long edges") doesn't match what was built.
  - `pinDirection` heuristic buries the pin inside geometry for mid-face
    T-joins / unequal-length coaxial joins; correct fix needs point-in-OBB
    containment testing (a new geometry primitive).
  - No collision detection/prevention for overlapping pieces (explicitly
    unscoped).

### 2. Core 3D/CAD deneyimi — ✅ mostly built
Present: OrbitControls, drag-to-move with grid snap (`GRID_INCREMENT=1`),
rotation gizmo (full 3-axis + discrete 90°/"stand up"), click-to-select,
all 6 standard views + 3D + frame-all/frame-selected, grid, mobile
multi-touch handoff between drag/orbit/pinch, 44px min touch targets.

Missing: no in-scene dimension/measurement overlay — dimensions only appear
as numeric fields in the Inspector, not drawn as ruler/dimension lines in
the 3D view itself. No edge/alignment snapping beyond uniform 1-unit grid
and the connection-anchor system.

### 3. Universal Connection System — 🟡 partially built, structurally different from the spec
Present: full anchor/connection data model (`AnchorPrimitive` point/segment/
face, `Connection`, `AnchorRef`), drag-to-connect snap + click-to-confirm/
detach markers, connected-group rigid move, stale-connection pruning,
extensible via registering new components with a `ConnectionRole`.

Missing / diverges from the planning doc's vocabulary:
- No named joint *types* (butt, mortise/insertion, round insertion) — the
  system classifies anchor **geometry pairing** (point-point/point-segment/
  point-face) rather than joinery type.
- No hardware/adhesive metadata attached to a connection. `l_bracket` and
  `wood_screw` exist as standalone freestanding components, not linked to
  any `Connection` record. No "glue" concept anywhere in the code.

### 4. Component & Asset Library — ✅ mostly built
Present: registry-based components (board, squareBeam, verticalPost,
roundRod, foot, pullupBar, lBracket, woodScrew), 6-species wood database
with bending strength + cited sources, per-instance species selection,
Inventory bottom-sheet UI to add pieces.

Missing: only one hardware item (L-bracket) and one fastener (wood screw) —
no broader hardware library. No per-instance quantity/stock tracking. No
user-editable library (add/remove *asset types*, not just instances) — it's
code-defined only.

### 5. Assembly / Project workflow — 🟡 half built
Present: add/combine/edit pieces, exploded view (radial, slider-driven,
display-only), preset pull-up kit.

Missing (confirmed absent via grep): **no save/load** — session state is
purely in-memory Zustand, lost on reload. **No BOM / cut-list / material-list
output.** Both are called out in the planning doc's item 5 and in the
original design doc's "Version 0.5" milestone bundle — neither exists yet.

### 6. Basit structural intelligence — 🟡 exists but as a single special case, not a system
Present: `structuralCheck.ts` implements bending-stress and connection-shear
checks, but **hardcoded to the `pullup_bar` component only** — every other
component's `structuralProperties` is empty. Classified safe/warning/unsafe
with a "not certified estimate" disclaimer, matching the planning doc's
"preliminary estimation, not engineering certification" framing.

Missing: no general/extensible load calculation for arbitrary assemblies,
no cross-section reduction from holes/cuts (no hole/cut geometry concept
exists at all yet), no load-bearing vs. non-load-bearing classification for
pieces in general (only the one hardcoded pull-up-bar case).

### 7. UI/UX baseline — ✅ a baseline exists, matches "elegant, professional" intent
Present: dark "Workshop Night" theme via CSS custom-property tokens
(near-black bg, safety-orange accent, Archivo/IBM Plex Mono), collapsible
hamburger main menu, floating collapsible Inspector, floating gizmo-toggle
cluster, custom swipe-to-dismiss bottom sheet for Inventory, 44px+ touch
targets throughout.

Missing: no light theme/switcher (a second theme, "Precision Blue", is
parked as backlog). No explicit "connection mode" toggle — connection
candidate markers are always live rather than a discrete mode. No
undo/redo UI.

### 8. Bug fixing + küçük eksik feature'lar — 🟢 active, several real bugs already caught and fixed
Recent fixes: stale group-membership bug in connected-piece-group-move,
two bugs in connection-confirm-detach (frozen permanent gap on loop-closing;
double-tap round-trip on mobile), z-fighting flicker on overlapping pieces
(deterministic per-piece depth bias). One narrower residual bug (same-group
loop-closing case) was explicitly left unresolved per a "one-fix-wave" rule
the project follows.

### 9. Release preparation — ❌ not started
No save/load, no BOM/cut-list, no MVP-scope document currently governs work
(per the headline finding above). This area has no work product yet beyond
the UI baseline and stable core experience it depends on.

### 10. Uzun vadeli roadmap — 📋 unchanged, still directional
Parametric components, advanced joints (dovetail/mortise-tenon geometry),
constraints, full dimensioning, cut list/BOM, material & cost calc, hardware
database, richer structural estimation, import/export, project sharing,
cloud/project management — all remain future/directional exactly as the
planning doc frames them; nothing here has started.

## What this means for next steps (for discussion, not decided here)

The two most consequential gaps relative to the planning doc's own
sequencing principle are **save/load** (item 5) and a **written, approved
"immediate scope" plan** for whatever comes next — both are prerequisites
the project's own rules (CLAUDE.md's approval-gate) call for before further
build-ahead. The connection system and structural check are further along
than the "core workflow → connection system" ordering implies, which isn't
a problem, just worth knowing when reconciling this with the sibling
game/grocery-app roadmap.

## Verification

This is a research/reporting task — no code was changed. Findings above are
traceable to file:line references gathered by the two Explore agents against
the live repo state as of this session (2026-09-15) and the docs under
`docs/superpowers/specs/` and `docs/superpowers/plans/ACTIVE-WORK-vscode.md`.
