# Wood CAD Workshop — Comparative Prototype Design

Status: approved for **Sub-project 1 (Foundation)** only. Sub-projects
2–7 are directional and will each get their own implementation plan —
and be re-confirmed against playtest results from the prior sub-project
— when reached, per the approval-gate rule in [CLAUDE.md](../../../CLAUDE.md#before-you-start).

> **Decision recorded (2026-08-24):** the "full dual-engine parity through
> all sub-projects" plan below was superseded before reaching it in full.
> An ad-hoc Stage 0–8 benchmark (covering roughly Sub-projects 1–5) was run
> across both engines instead; scores came back too close to call on UX, so
> the final call was made on engineering cost — Three.js's fast local
> `tsc`/`vitest` feedback loop vs. Godot's unreliable static type inference
> and full export+device-install verification cycle. Godot is retired
> (kept on disk, untracked in git); Three.js continues as a fresh,
> systematically-architected rebuild in `wood-cad-workshop/` (adapting
> `world-of-cards`' registry-pattern + pure-core engine architecture — see
> `docs/superpowers/plans/ACTIVE-WORK-vscode.md` for current state). The
> roadmap below is kept as a historical record of the original scope, not a
> live plan.

## Relationship to prior stages

[woodcraft-prototype-design.md](2026-08-20-woodcraft-prototype-design.md)
scoped the "platform decision + comparative touch spike" stage as a
days-scale feel/perf test (two boards, tap-select, single-plane drag) in
both Three.js/R3F and Godot, meant only to pick one engine before
continuing. That stage is complete — both spikes exist at
`spikes/touch-spike-threejs/` and `spikes/touch-spike-godot/`.

This document supersedes that plan for what comes next: rather than
picking an engine off the touch-spike alone, the comparison continues
through a fuller, apples-to-apples feature build in both engines —
inventory, component/assembly model, hardware, exploded view, a
preliminary structural check — before a final engine decision is made.
This is a deliberately larger investment than the original roadmap
called for, chosen because the touch-spike alone doesn't exercise
enough of the two engines' UI/data-modeling/authoring ergonomics to
make a confident final call.

Neither existing spike has a camera control system, UI chrome, or a
component data model — both are two hardcoded boxes with pointer-drag
and a fixed camera (confirmed by direct inspection of
`spikes/touch-spike-threejs/src/` and `spikes/touch-spike-godot/main.gd`
on 2026-08-22). Everything below is new work in both codebases; only
the grid-snap module (`snap.ts` / `snap.gd`), the pointer/touch-drag
pattern, and the existing grid carry forward unchanged.

### Prior planning records

Two unapproved VS Code Copilot planning records already existed at
`docs/superpowers/plans/2026-08-22-dual-engine-workshop-parity-vscode.md`
and `docs/superpowers/plans/2026-08-22-engine-selection-vscode.md`,
independently proposing a similar dual-engine parity build and
correctly flagging that it needed canonical approval first (which this
document provides). Their phase breakdown is broadly consistent with
the sub-project roadmap below. One explicit difference: the
`engine-selection-vscode` record proposed picking a single engine after
the touch-spike alone, before building further. That approach was
considered and explicitly rejected in favor of full parity — see the
"Relationship to prior stages" section above for why. Those two
documents remain useful phase-detail references but are superseded by
this document as the scope authority.

## Product concept

A mobile-first, component-oriented wood construction CAD prototype. The
user thinks in wood components, dimensions, materials, hardware, and
assemblies — not generic meshes or primitives. Not a general CAD tool;
scope stays narrow enough to build the same conceptual app twice for a
fair engine comparison.

## Cross-cutting principle: data model separate from rendering

Component, assembly, connection, dimension, material, and exploded-view
concepts are engine-agnostic. Each sub-project's shared model is
specified once (in that sub-project's plan) and implemented natively —
not shared source — in both engines, since a shared runtime is not a
goal of this comparison. Both implementations must reproduce the same
conceptual behavior (e.g. identical exploded-view math, identical
snap semantics) so the comparison measures engine ergonomics, not
divergent designs.

Coordinate system: Y = up, X = left/right, Z = depth, in both engines
(both already default this way — Three.js and Godot 4 are Y-up, and
both existing spikes already place their fixed camera at `(0, 20, 25)`
looking at the origin).

## Roadmap: sub-projects

Each ships lockstep — a sub-project is finished and playtested in both
engines before the next one starts, keeping the comparison valid at
every checkpoint and surfacing engine-specific friction early rather
than after everything is built.

1. **Foundation** *(approved, this document)* — camera/view system,
   engine-agnostic `ComponentDefinition`/`ComponentInstance` data
   model, minimal view-control bar. Existing boards migrate onto the
   new data model as the regression check.
2. **Wood component library + Inventory + Inspector** — Round Rod,
   Square Beam, Board; drag-from-inventory placement; dimension editing.
3. **Hardware + connection/snap system** — L-Bracket, Wood Screw,
   `ConnectionPoint`s, proximity-based snapping.
4. **Pull-up station assembly** — the demo build (posts, feet, bar,
   brackets, screws) using parts from #2/#3.
5. **Exploded view** — explode/assemble toggle + slider, per-component
   explode direction.
6. **Structural check** — load input → force/safety-factor calc →
   preliminary bending check on the pull-up bar, explicitly labeled as
   an estimate, never certified analysis.
7. **Mobile interaction polish** — touch-gesture pass across everything
   built (avoid accidental moves during orbit, drawer/sheet ergonomics,
   touch target sizing).

Explicitly out of scope for this whole comparative phase (per the
original master prompt's own constraints): CAD constraint solver, real
FEA, wood fracture simulation, advanced physics, multiplayer/cloud,
authentication, a large material database, manufacturing optimization,
automatic structural certification.

## Immediate scope: Sub-project 1 — Foundation

### Data model

```
ComponentDefinition                  ComponentInstance
├── id, name, category               ├── id
│   (WOOD | HARDWARE | FASTENER)     ├── componentDefinitionId
├── geometry (shape + procedural     ├── position, rotation
│   params, e.g. box/cylinder)       ├── dimensions (overrides
├── defaultDimensions                │   defaultDimensions)
├── material                         └── material (optional override)
├── connectionPoints []  (reserved, empty in this sub-project)
├── structuralProperties {}  (reserved, empty in this sub-project)
└── explodeDirection null  (reserved, unset in this sub-project)
```

This generalizes Prototype 0's `Piece` model (lumber-semantic
dimensions, procedurally generated box/cylinder geometry — resizing
regenerates geometry, never swaps assets) to also cover hardware and
fasteners, whose dimension names differ from wood's
thickness/width/length (e.g. a screw has diameter/length). The
`connectionPoints`, `structuralProperties`, and `explodeDirection`
fields exist in the schema now so later sub-projects don't need a
breaking model change, but carry no behavior yet — sub-project 1 does
not compute or consume them.

Each engine implements this as a plain, rendering-free module — a TS
module in Three.js, a GDScript module in Godot — following the same
isolation pattern the existing `snap.ts`/`snap.gd` already use (no
Three.js/Godot-node imports in the data module itself).

### Camera / view system

Gesture rules (already fixed by the parent design doc, unchanged here):
one-finger drag on empty space = orbit, two-finger drag = pan, pinch =
zoom, tap a piece = select, tap empty space = deselect (existing
behavior, must keep working).

View presets: 3D (perspective, default), Front, Back, Left, Right, Top,
Bottom, plus Frame All and Frame Selected. All are cheap once a single
"camera position from named direction" function exists, so the full
set ships rather than stopping at a stripped-down minimum.

**Key architectural risk:** camera-drag and object-drag both begin as a
one-finger gesture, so exactly one of them must fire per gesture,
gated by the same hit-target test the existing deselect-on-empty-tap
logic already performs (tap piece → object-drag mode; tap empty →
camera-orbit mode). This is the one piece of genuinely new shared
interaction logic and must be implemented equivalently in both engines
to keep the interaction model identical for comparison purposes.

Camera state (orbit target, distance/zoom, orientation) is
engine-native — no shared module — since it's tightly coupled to each
engine's transform/input APIs and isn't reused conceptually the way the
data model or snap math is.

### View-control bar

A minimal, always-visible bar with the preset-view buttons: an
HTML/CSS overlay in Three.js, a `CanvasLayer` + `Button` row in Godot.
Touch-target sized. This is not the three-pane shell from the master
prompt — inventory and inspector panels are sub-project 2's scope,
once there's real content to put in them.

### Regression / migration

The two existing hardcoded boards become one `board`
`ComponentDefinition` plus two `ComponentInstance`s. Tap-select and
single-finger drag-move must continue working exactly as before; this
is the acceptance check that the new data model didn't regress existing
behavior.

### Testing

- Data model module: unit tests in both engines (vitest, already set
  up for Three.js; a headless script following the existing
  `snap_check.gd` pattern for Godot).
- Manual verification in both engines, via mouse (desktop) and
  touch (device/emulator): orbit/pan/zoom, all view presets produce
  expected framing, existing select/drag regression holds.

### Out of scope for sub-project 1

Inventory panel, inspector panel, hardware/fasteners, connection
points/snapping, assemblies, exploded view, structural checks, mobile
drawer/bottom-sheet chrome. These are sub-projects 2–7.
