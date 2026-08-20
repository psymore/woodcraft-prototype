# Woodcraft Prototype

A mobile-first 3D woodworking modeler: build furniture out of typed wood
pieces (boards, panels, dowels, blocks) with smart edge/face/end
snapping instead of generic 3D primitive manipulation.

This repo currently holds **Prototype 0** — a Panda3D desktop spike to
test whether board-based snapping feels good, before any mobile or
engine decisions are made.

Design and roadmap: [docs/superpowers/specs/2026-08-20-woodcraft-prototype-design.md](docs/superpowers/specs/2026-08-20-woodcraft-prototype-design.md)

## Running Prototype 0

```
python -m venv .venv
.venv\Scripts\python.exe -m pip install -r requirements.txt
.venv\Scripts\python.exe -m woodcraft.main
```

Controls: left-drag empty space to orbit, left-drag a board to select
and move it (snapped to a 1" grid), right-drag to pan, scroll wheel to
zoom.

Run tests: `.venv\Scripts\python.exe -m pytest`
