---
vscode: true
vscode-copilot: true
author: "Claude Code"
vscode-note: "Shared continuity record. Claude Code and VS Code Copilot may update this file when work changes hands."
status: "active"
last-agent: "Claude Code"
updated: "2026-08-24"
---

# Active Work Handoff

This is the shared, repository-local continuity record for Claude Code and VS Code Copilot. It is not a transcript. Keep it short, factual, and current.

## Objective

- **Task:** Build the real Wood CAD Workshop app in `wood-cad-workshop/` — a from-scratch, systematically-architected Three.js/React Three Fiber app applying `world-of-cards`' software architecture (pure-core `engine/`, registry-pattern component extensibility, Zustand session store). Supersedes `spikes/touch-spike-threejs/`.
- **Canonical plan:** the harness plan file used to scaffold this app (git-housekeeping + `wood-cad-workshop/` structure) — see the "Decision recorded" note in `docs/superpowers/specs/2026-08-22-wood-cad-workshop-design.md` for the reasoning; a proper per-feature implementation plan for the new app has not been written yet via `writing-plans`.
- **Canonical specification:** `docs/superpowers/specs/2026-08-22-wood-cad-workshop-design.md` (its "full dual-engine parity through all sub-projects" framing is superseded — see the decision note appended to it).

## Current state

- **Completed:** Ran an ad-hoc Stage 0–8 comparative benchmark across `spikes/touch-spike-threejs/` and `spikes/touch-spike-godot/` (viewport, inventory, manipulation, inspector, multi-view, pull-up assembly, connection-point snapping, exploded view) covering roughly Sub-projects 1–5 of the original roadmap. Scores ended too close to call; the engine decision went to Three.js on engineering cost (fast local `tsc`/`vitest` feedback vs. Godot's unreliable static type inference and export+device-install verification cycle — this session hit a real export-succeeds-but-app-crashes bug from a GDScript type-inference gap). Godot retired from git (kept on disk, gitignored). `CLAUDE.md` status section updated to record this.
- **In progress:** Scaffolding `wood-cad-workshop/` per the approved plan (registry-based `engine/`, `store/`, `scene/`, `ui/` split) — see that plan file for the full target structure.
- **Next action:** Finish scaffolding, port the pure logic from `spikes/touch-spike-threejs/src/` (`snap.ts`, `framing.ts`, `viewPresets.ts`, `component.ts`'s dimension/geometry math, `snapConnections.ts`) into `wood-cad-workshop/src/engine/`, rebuild the UI layer on top of a Zustand session store, then verify with `tsc -b` + `vitest run` and hand off to the user for a manual smoke test before continuing feature work.
- **Blocker:** none.

## Decisions and constraints

- Full dual-engine parity through all 7 sub-projects (as originally scoped) was superseded by a token/engineering-cost-driven decision after the ad-hoc benchmark — see `docs/superpowers/specs/2026-08-22-wood-cad-workshop-design.md`'s appended decision note.
- `wood-cad-workshop/` adopts `world-of-cards`' (`D:\CodeSpace\world-of-cards`) **software architecture only** — pure functional engine core, additive registry-pattern extensibility, one-global+one-session Zustand store — explicitly *not* its heavier documentation-governance framework (WKA's 12-concept meta-model), which was judged disproportionate for this prototype's scale per `CLAUDE.md`'s own "don't over-invest in throwaway prototype code" principle.
- `spikes/touch-spike-threejs/` and `spikes/touch-spike-godot/` both remain on disk as historical reference, not deleted. Godot is additionally gitignored (untracked).

## Files and symbols

- **Changed:** `.gitignore` (blanket `spikes/touch-spike-godot/` ignore), `CLAUDE.md` (status + where-things-live), this file, `docs/superpowers/specs/2026-08-22-wood-cad-workshop-design.md` (decision note appended).
- **Relevant:** `spikes/touch-spike-threejs/src/` (source for the logic being ported — see the plan file's "what ports as-is" list), `D:\CodeSpace\world-of-cards\docs\governance\engineering-principles.md` and `packages/engine/src/registry/` (the architecture being adapted), `wood-cad-workshop/` (new, being built).

## Validation

- **Checks run:** `tsc -b` and `vitest run` were the standing verification loop throughout the benchmark (both spikes) — same pattern to keep using for the new app.
- **Not yet run:** the new `wood-cad-workshop/` app hasn't been built/tested yet.

## Handoff notes

- **From:** Claude Code
- **To:** either agent
- **Read first:** this file, then the approved plan file (git-housekeeping + `wood-cad-workshop/` scaffold), then `docs/superpowers/specs/2026-08-22-wood-cad-workshop-design.md`'s decision note.
- **Do not:** resume work on `spikes/touch-spike-godot/` (retired) or treat `spikes/touch-spike-threejs/` as the app to keep extending (superseded by `wood-cad-workshop/`); re-open the "which engine" decision without new information — it's closed.
