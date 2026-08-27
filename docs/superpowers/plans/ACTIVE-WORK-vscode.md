---
vscode: true
vscode-copilot: true
author: "Claude Code"
vscode-note: "Shared continuity record. Claude Code and VS Code Copilot may update this file when work changes hands."
status: "active"
last-agent: "Claude Code"
updated: "2026-08-26"
---

# Active Work Handoff

This is the shared, repository-local continuity record for Claude Code and VS Code Copilot. It is not a transcript. Keep it short, factual, and current.

## Objective

- **Task:** Build the real Wood CAD Workshop app in `wood-cad-workshop/` — a from-scratch, systematically-architected Three.js/React Three Fiber app applying `world-of-cards`' software architecture (pure-core `engine/`, registry-pattern component extensibility, Zustand session store). Supersedes `spikes/touch-spike-threejs/`.
- **Canonical plan:** the harness plan file used to scaffold this app (git-housekeeping + `wood-cad-workshop/` structure) — see the "Decision recorded" note in `docs/superpowers/specs/2026-08-22-wood-cad-workshop-design.md` for the reasoning; a proper per-feature implementation plan for the new app has not been written yet via `writing-plans`.
- **Canonical specification:** `docs/superpowers/specs/2026-08-22-wood-cad-workshop-design.md` (its "full dual-engine parity through all sub-projects" framing is superseded — see the decision note appended to it).

## Current state

- **Completed:** Ran an ad-hoc Stage 0–8 comparative benchmark across `spikes/touch-spike-threejs/` and `spikes/touch-spike-godot/` (viewport, inventory, manipulation, inspector, multi-view, pull-up assembly, connection-point snapping, exploded view) covering roughly Sub-projects 1–5 of the original roadmap. Scores ended too close to call; the engine decision went to Three.js on engineering cost (fast local `tsc`/`vitest` feedback vs. Godot's unreliable static type inference and export+device-install verification cycle — this session hit a real export-succeeds-but-app-crashes bug from a GDScript type-inference gap). Godot retired from git (kept on disk, gitignored). `CLAUDE.md` status section updated to record this.
- **Completed:** Scaffolded `wood-cad-workshop/` (registry-based `engine/`, `store/`, `scene/`, `ui/` split), ported all pure logic and UI from `spikes/touch-spike-threejs/src/` onto the new architecture, verified `tsc -b` + `vitest run` (12/12) clean, ran `npm run dev` and had the user manually smoke-test in-browser (viewport, boards, orbit/zoom/pan, selection/move, inventory, inspector, pull-up kit, snapping, exploded view — all confirmed working). Committed on `feature/wood-cad-workshop-scaffold`, merged to `master`, pushed (`07d60bd`).
- **Completed:** Ran a file-by-file feature-parity check (Explore agent) between `spikes/touch-spike-threejs/src/` and `wood-cad-workshop/src/`. Result: full parity, no gaps or regressions — every user-facing behavior (viewport controls incl. pinch multi-touch, drag-to-move w/ grid snap, connection-point snapping SNAP_DISTANCE=3, inventory spawn, select/rotate/duplicate/delete, inspector, view presets + frame all/selected, pull-up kit assembly, exploded view, and the grid z-fighting fix) is logically identical, just relocated into `engine/core/*`, `engine/components/*/index.ts`, and `store/sceneSessionStore.ts`. New app additionally carries extra test coverage (`connectionPoints.test.ts`, `explode.test.ts`) and a cleaner `index.css` (spike had leftover Vite-template cruft). No stubs/TODOs found.
- **Completed:** Implemented Sub-project 6 (Structural Check), scoped to the pull-up bar only, via `docs/superpowers/plans/2026-08-25-structural-check.md` (spec: `docs/superpowers/specs/2026-08-25-wood-cad-workshop-structural-check-design.md`). Widened `ComponentDefinition.structuralProperties` from an empty placeholder to a real `StructuralProperties` interface, added a pure `src/engine/core/structuralCheck.ts` calc module (simply-supported-beam bending model, safety-factor classification safe/warning/unsafe), and wired a weight-input + live safety-factor section into `src/ui/Inspector.tsx`, gated to the pull-up bar only with a "not certified" disclaimer. Built via Subagent-Driven Development (3 tasks, each reviewed and approved; final whole-branch review approved with this doc fix as the only requirement). `tsc -b` clean, `vitest run` 19/19 passing.
- **Completed:** A user-directed "3D Editor Next Steps" initiative (5 steps: rotation gizmo → theme system → vertical/stand-up action → part joining → z-fighting fix), run outside the Sub-project 1-7 roadmap above. Step order was reshuffled live at the user's request (step 3 pulled forward into step 1's branch; step 2 skipped for now). Landed on `feature/transform-gizmo-rotation`, merged to `master` (fast-forward, `0e76bc4`): (1) X/Y/Z rotation gizmo via SDD (spec `docs/superpowers/specs/2026-08-26-transform-gizmo-rotation-design.md`, plan `docs/superpowers/plans/2026-08-26-transform-gizmo-rotation.md`) — generalized `ComponentInstance.rotation` from yaw-only to full 3-axis Euler, attached drei's `TransformControls` per selected piece, fixed an incidental pre-existing bug where cylinder pieces never visually responded to yaw; (2) "Stand Up" absolute vertical-placement action (bounded, brainstormed inline, no separate spec), gated to `connectionRole: 'ends'` pieces; (3) a string of user-directed mobile-UX iterations on top: Inspector made responsive + collapsible, vertical-move handle enlarged 4x and repositioned to clear the gizmo's screen-constant-size outer ring at any zoom level, and all floating buttons (ViewControls/PieceControls/Inventory-trigger/PullupKitButton/ExplodedView) collapsed behind one top-left hamburger menu (`MainMenu.tsx`) with two new bottom-right switch icons (`GizmoToggles.tsx`) to hide/show the gizmo and handle independently. Final whole-branch review (opus) found 4 Important issues, all fixed in one dispatch and re-reviewed clean (see the plan file's ledger, now deleted per the SDD skill's cleanup step — git history is the record). `tsc -b` + `vitest run` (26/26) clean on merged `master`.
- **Next action:** item 4 of that 5-step initiative — the part-joining/connection system — is now **implemented and merge-ready** on `feature/part-joining-system` (item 3, vertical/stand-up, was pulled forward and completed above; item 2, theme system, was explicitly skipped for now). It adds a persisted `Connection` record between two pieces' anchor points, created when they snap together during a drag and broken when the pieces separate or when either is rotated/resized/stood up, with a small marker rendered at each active connection. Still-open follow-ups the user raised during manual testing, each to be scoped in its own next brainstorming round: (a) moving connected pieces together as a rigid group (the separate, not-yet-built `Group` feature); (b) an explicit UI action to break a connection; (c) face-based connection points, so two pieces' long faces touching also connect, not just their ends; (d) a more legible connector visual — something that reads as a physical fastener (nail/bolt/bracket) rather than an ambiguous sphere. Sub-project 7 (mobile interaction polish) from the original roadmap remains separately outstanding whenever this initiative wraps.
- **Blocker:** none.

## Decisions and constraints

- Full dual-engine parity through all 7 sub-projects (as originally scoped) was superseded by a token/engineering-cost-driven decision after the ad-hoc benchmark — see `docs/superpowers/specs/2026-08-22-wood-cad-workshop-design.md`'s appended decision note.
- `wood-cad-workshop/` adopts `world-of-cards`' (`D:\CodeSpace\world-of-cards`) **software architecture only** — pure functional engine core, additive registry-pattern extensibility, one-global+one-session Zustand store — explicitly *not* its heavier documentation-governance framework (WKA's 12-concept meta-model), which was judged disproportionate for this prototype's scale per `CLAUDE.md`'s own "don't over-invest in throwaway prototype code" principle.
- `spikes/touch-spike-threejs/` and `spikes/touch-spike-godot/` both remain on disk as historical reference, not deleted. Godot is additionally gitignored (untracked).

## Files and symbols

- **Changed:** `.gitignore` (blanket `spikes/touch-spike-godot/` ignore), `CLAUDE.md` (status + where-things-live), this file, `docs/superpowers/specs/2026-08-22-wood-cad-workshop-design.md` (decision note appended). Most recently: `wood-cad-workshop/src/scene/Piece.tsx`, `store/sceneSessionStore.ts`, `engine/core/connectionPoints.ts`, `ui/Inspector.tsx`, and new `ui/MainMenu.tsx` + `ui/GizmoToggles.tsx` — see the "3D Editor Next Steps" entry above.
- **Relevant:** `spikes/touch-spike-threejs/src/` (source for the logic being ported — see the plan file's "what ports as-is" list), `D:\CodeSpace\world-of-cards\docs\governance\engineering-principles.md` and `packages/engine/src/registry/` (the architecture being adapted), `wood-cad-workshop/` (new, being built).

## Validation

- **Checks run:** `tsc -b` and `vitest run` (26/26) clean on `wood-cad-workshop/` at `master` HEAD. `npm run dev` launched and manually smoke-tested in-browser by the user after each UI-affecting change in the "3D Editor Next Steps" work (rotation gizmo on all 3 axes, Stand Up, Inspector collapse/responsive, hamburger menu, gizmo/handle toggles — all confirmed working). Explore-agent file-by-file parity check against `spikes/touch-spike-threejs/` (older, Sub-project 6 era) found no gaps.
- **Not yet run:** no automated e2e/browser test suite exists yet (manual smoke test only).

## Handoff notes

- **From:** Claude Code
- **To:** either agent
- **Read first:** this file, then `docs/superpowers/specs/2026-08-22-wood-cad-workshop-design.md`'s decision note for roadmap context on what comes after Sub-project 5.
- **Do not:** resume work on `spikes/touch-spike-godot/` (retired) or treat `spikes/touch-spike-threejs/` as the app to keep extending (superseded and now verified at parity by `wood-cad-workshop/`); re-open the "which engine" decision without new information — it's closed; re-port anything from the spike — parity is confirmed complete.
