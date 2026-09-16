# CLAUDE.md

Woodcraft Prototype — a mobile-first 3D woodworking modeler (board-based
snap assembly). This file is a router, not a knowledge base: it says
where things live, not what they say.

## Where things live

- **Product design & roadmap** (canonical): [docs/superpowers/specs/2026-08-20-woodcraft-prototype-design.md](docs/superpowers/specs/2026-08-20-woodcraft-prototype-design.md)
  Read this before touching scope, the data model, or the roadmap.
- **Implementation plans**: `docs/superpowers/plans/` — one plan per prototype stage.
- **Session continuity**: `docs/superpowers/plans/YYYY-MM-DD-<topic>-session.md` — dated, per-session index docs (e.g. [docs/superpowers/plans/2026-09-16-ui-polish-session.md](docs/superpowers/plans/2026-09-16-ui-polish-session.md)) capturing what changed and any known gaps; check the most recent one before resuming.
- **Prototype 0 code**: `woodcraft/` (Panda3D desktop spike). Entry point: `woodcraft/main.py`.
- **Active implementation**: `wood-cad-workshop/` (Three.js/React Three Fiber). Entry point: `wood-cad-workshop/src/main.tsx`. Registry-based component extensibility, pure engine core (`src/engine/`), Zustand session store — see that app's own docs for the architecture.
- **Retired comparative spikes** (historical reference only, not built on): `spikes/touch-spike-threejs/` and `spikes/touch-spike-godot/`. The Godot one is additionally gitignored (kept on disk, not tracked).
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

## Session isolation: branches, not worktrees

Claude Code groups session transcripts by working directory. A git worktree
lives in its own directory (e.g. `.claude/worktrees/<name>/`), so any
session run inside one is invisible from the session list opened at the
repo base — this has already caused a lost-session problem once.

**Do not use git worktrees for isolation in this repo.** When starting
feature work that would normally call for `superpowers:using-git-worktrees`,
instead create and check out a branch directly in the main working
directory: `feature/<name>` or `refactor/<name>` (matching whatever the
work actually is). Isolation comes from the branch, not the directory.
Merge/finish it the same way you would a worktree branch — this only
changes where the work happens, not the git workflow around it.

## Git workflow shorthand

The user may invoke either of these verbally (bare, or e.g. "let's BCMP
this"). They apply for any agent working from this file, not just Claude
Code:

- **CMP** — commit, merge, and push the **current** branch: commit
  whatever's staged/pending, merge the current branch into its immediate
  parent (fast-forward when possible), and push. No new branch is
  created. Invoking CMP is standing authorization for the push step
  specifically — no need to re-confirm before pushing when CMP is
  invoked (other push situations still follow normal confirmation
  norms).
- **BCMP** — branch out first: create a conventionally-prefixed branch
  (`feature/`, `refactor/`, `test/`, etc., matching whatever the changes
  are) off the current branch, commit the pending changes there (split
  into multiple logical commits when they cover distinct concerns,
  matching this repo's one-purpose-per-commit style), merge that branch
  back into the branch it was cut from, then push.

Both still use judgment on: branch naming, what belongs in the diff
(exclude local/generated artifacts — extend `.gitignore` rather than
committing them), and commit granularity (infer style from
`git log --oneline` when unsure).

## Status

Prototype 0, the platform-decision touch spike, and the Wood CAD Workshop
comparative benchmark (Three.js vs Godot — Sub-project 1 Foundation, plus an
ad-hoc Stage 0-8 pass covering inventory, inspector, connection-point
snapping, and exploded view) are all complete. The benchmark scored too
close to call on UX, so the decision went to **Three.js**, on engineering
cost: fast local `tsc`/`vitest` feedback with no device dependency, vs.
Godot's unreliable static type inference (this session hit a real
export-succeeds-but-app-crashes bug from it) and a full Android
export+install cycle for every check.

Godot is retired — kept on disk for reference, no longer tracked in git or
built on. Three.js continues as a fresh, systematically-architected rebuild
in `wood-cad-workshop/` (applying `world-of-cards`' registry-pattern +
pure-core engine architecture), superseding `spikes/touch-spike-threejs/`.
See [docs/superpowers/specs/2026-08-22-wood-cad-workshop-design.md](docs/superpowers/specs/2026-08-22-wood-cad-workshop-design.md)
for the original roadmap (superseded by the decision above — see its own
"Decision recorded" note).
