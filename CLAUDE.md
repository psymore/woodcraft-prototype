# CLAUDE.md

Woodcraft Prototype — a mobile-first 3D woodworking modeler (board-based
snap assembly). This file is a router, not a knowledge base: it says
where things live, not what they say.

## Where things live

- **Product design & roadmap** (canonical): [docs/superpowers/specs/2026-08-20-woodcraft-prototype-design.md](docs/superpowers/specs/2026-08-20-woodcraft-prototype-design.md)
  Read this before touching scope, the data model, or the roadmap.
- **Implementation plans**: `docs/superpowers/plans/` — one plan per prototype stage.
- **Active agent handoff**: `docs/superpowers/plans/ACTIVE-WORK-vscode.md` — shared continuity record for Claude Code and VS Code Copilot; read before resuming and update after meaningful progress.
- **Prototype 0 code**: `woodcraft/` (Panda3D desktop spike). Entry point: `woodcraft/main.py`.
- **Tests**: `tests/`, run with `pytest`.
- **AI knowledge-architecture guidance** (reference, not project-specific): [docs/reference/project-agnostic-knowledge-architecture-mother-prompt.md](docs/reference/project-agnostic-knowledge-architecture-mother-prompt.md)

## Before you start

- Only the stage marked "approved" in the design doc's _Immediate scope_
  section may be implemented. Everything past it is directional and needs
  its own spec/plan when reached — do not build ahead of it.
- Prototype 0's code is throwaway by design (see the design doc's
  _Technology strategy_): only the data model, snapping math, and anchor
  logic carry forward to the real engine, not the Panda3D code itself.
  Don't over-invest in polish here.

## Status

Prototype 0 and the platform-decision touch spike are both complete.
Current approved stage: **Wood CAD Workshop, Sub-project 1
(Foundation)** — see
[docs/superpowers/specs/2026-08-22-wood-cad-workshop-design.md](docs/superpowers/specs/2026-08-22-wood-cad-workshop-design.md)
for the roadmap and immediate scope.
