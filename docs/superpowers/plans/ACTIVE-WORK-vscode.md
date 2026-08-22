---
vscode: true
vscode-copilot: true
author: "Claude Code"
vscode-note: "Shared continuity record. Claude Code and VS Code Copilot may update this file when work changes hands."
status: "active"
last-agent: "Claude Code"
updated: "2026-08-22"
---

# Active Work Handoff

This is the shared, repository-local continuity record for Claude Code and VS Code Copilot. It is not a transcript. Keep it short, factual, and current.

## Objective

- **Task:** Implement Sub-project 1 (Foundation) of the Wood CAD Workshop comparative prototype — camera/view system, engine-agnostic component data model, minimal view-control bar — lockstep in both `spikes/touch-spike-threejs/` and `spikes/touch-spike-godot/`.
- **Canonical plan:** not yet written (next step is `writing-plans` to produce per-engine implementation plans for Sub-project 1).
- **Canonical specification:** `docs/superpowers/specs/2026-08-22-wood-cad-workshop-design.md`

## Current state

- **Completed:** Brainstormed and wrote the canonical spec for the new "Wood CAD Workshop" comparative-prototype stage (7 sub-projects, lockstep across both engines). Updated `docs/superpowers/specs/2026-08-20-woodcraft-prototype-design.md` and `CLAUDE.md` to point at it as the current scope authority. Reconciled with the two pre-existing VS Code Copilot planning records (see Decisions below).
- **In progress:** None — spec is written, not yet implementation-planned.
- **Next action:** Invoke `writing-plans` to produce the Sub-project 1 implementation plan(s) for Three.js and Godot.
- **Blocker:** none.

## Decisions and constraints

- Full dual-engine parity was explicitly chosen over an early single-engine pick — see `docs/superpowers/specs/2026-08-22-wood-cad-workshop-design.md`, "Relationship to prior stages". This supersedes the approach proposed in `docs/superpowers/plans/2026-08-22-engine-selection-vscode.md` (pick one engine right after the touch spike).
- The phase/sub-project breakdown in `2026-08-22-wood-cad-workshop-design.md` was cross-checked against `docs/superpowers/plans/2026-08-22-dual-engine-workshop-parity-vscode.md` (an independently authored, unapproved Copilot plan with a very similar phase list) — broadly consistent; that document remains a useful phase-detail reference but is not the scope authority.
- Sub-projects execute lockstep: a sub-project finishes and is playtested in both engines before the next starts.

## Files and symbols

- **Changed:** `docs/superpowers/specs/2026-08-22-wood-cad-workshop-design.md` (new, canonical for this stage), `docs/superpowers/specs/2026-08-20-woodcraft-prototype-design.md` (status/roadmap pointers updated), `CLAUDE.md` (status section), `docs/knowledge-map.md` (entry 1 updated).
- **Relevant:** `spikes/touch-spike-threejs/src/` (Scene.tsx, Board.tsx, snap.ts — no camera controls, no UI chrome, no component model yet), `spikes/touch-spike-godot/main.gd` (same gaps), `docs/superpowers/plans/2026-08-21-touch-spike-{threejs,godot}.md` (prior-stage plans, still historically accurate).

## Validation

- **Checks run:** none yet (design-only phase).
- **Not yet run:** everything — implementation hasn't started for Sub-project 1.

## Handoff notes

- **From:** Claude Code
- **To:** either agent
- **Read first:** this file, then `docs/superpowers/specs/2026-08-22-wood-cad-workshop-design.md` in full.
- **Do not:** start implementing Sub-project 1 without an implementation plan; skip ahead to sub-projects 2–7 (they're directional, not approved yet); silently rewrite the two `-vscode` planning records mentioned above (they're superseded, not obsolete — leave them as historical reference).
