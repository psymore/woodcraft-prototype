# Woodcraft Prototype

A mobile-first 3D woodworking modeler: build furniture out of typed wood
pieces (boards, panels, dowels, blocks) with smart edge/face/end
snapping instead of generic 3D primitive manipulation.

Design and roadmap: [docs/superpowers/specs/2026-08-20-woodcraft-prototype-design.md](docs/superpowers/specs/2026-08-20-woodcraft-prototype-design.md)

## Status

Prototype 0 (Panda3D desktop spike) and a platform-decision benchmark
comparing Three.js and Godot are both complete. The engine decision went
to **Three.js**, on engineering cost — fast local `tsc`/`vitest` feedback
with no device dependency, versus Godot's unreliable static type
inference and a full Android export+install cycle for every check.

Active development has moved to **`wood-cad-workshop/`**, a fresh,
systematically-architected Three.js/React Three Fiber rebuild (registry-based
component extensibility, pure engine core, Zustand session store). It
currently covers piece inventory, an inspector panel, connection-point
snapping, exploded view, part joining, species-based wood materials, and
light/dark theming.

The Panda3D prototype and the retired Godot/Three.js comparative spikes
(`spikes/touch-spike-godot/`, `spikes/touch-spike-threejs/`) are kept for
historical reference only — nothing further is built on them.

See [docs/superpowers/specs/2026-08-22-wood-cad-workshop-design.md](docs/superpowers/specs/2026-08-22-wood-cad-workshop-design.md)
for the original benchmark roadmap (superseded by the decision above) and
[docs/superpowers/plans/](docs/superpowers/plans/) for per-stage
implementation plans and dated session notes.

## Running the active app (wood-cad-workshop)

```
cd wood-cad-workshop
npm install
npm run dev
```

Run tests: `npm test` (from `wood-cad-workshop/`)

## Running Prototype 0 (Panda3D, retired)

```
python -m venv .venv
.venv\Scripts\python.exe -m pip install -r requirements.txt
.venv\Scripts\python.exe -m woodcraft.main
```

Controls: left-drag empty space to orbit, left-drag a board to select
and move it (snapped to a 1" grid), right-drag to pan, scroll wheel to
zoom.

Run tests: `.venv\Scripts\python.exe -m pytest`
