# Platform Decision + Comparative Touch Spike — Design

Status: approved to implement. This is the "Platform decision + comparative
touch spike" stage named in the parent design doc's *Roadmap* section —
previously scoped only at a high level, fully scoped here.

Parent spec: [2026-08-20-woodcraft-prototype-design.md](2026-08-20-woodcraft-prototype-design.md)

## Purpose

Prototype 0 (Panda3D, desktop mouse) validated that board-based
snap-assembly is a fun modeling concept. It could not validate touch-gesture
feel, which the parent spec names as the #1 mobile-3D UX failure mode. This
stage settles the target engine for Prototype 1 onward by building the same
minimal snap-a-board interaction natively in each engine candidate and
judging touch feel on a real device, side by side.

This stage's own deliverable is a decision, not a feature. Both spikes are
throwaway, same as Prototype 0 — nothing here is meant to survive into
Prototype 1 except the verdict itself.

## Scope

Two candidate engines, per the parent spec's *Technology strategy*:

- **Godot** (GDScript) — leading candidate; native mobile export.
- **Three.js/R3F** — the right call if web-first distribution ends up
  mattering more than native touch feel.

Both get built, in full, before either is tested on-device. Testing both
back-to-back in one sitting (not days apart) keeps the feel comparison
fresh and avoids recency bias — this is what makes "subjective feel
judgment" (the chosen decision method, same as Prototype 0's own) a fair
comparison rather than two independent impressions.

### What each spike builds

Both spikes implement the identical minimal scene:

- **2 hardcoded boards**, reusing Prototype 0's lumber dimensions/positions
  (from `woodcraft/app.py`'s `DEFAULT_PIECES`) so the two spikes are
  visually comparable to each other and to Prototype 0.
- A simple ground reference (a plane or grid), for spatial context.
- **One fixed camera angle.** No orbit/pan/zoom gestures — deliberately out
  of scope (see *Out of scope* below).

Touch behavior, identical across both engines:

- Tap a board → selects it (some visible highlight).
- Tap empty space → deselects.
- Single-finger drag on a selected board → moves it, constrained to the
  ground plane, snapped to a 1" grid (matching Prototype 0's
  `GRID_INCREMENT`).

This is deliberately the *narrowest* slice that still exercises the
highest-risk interaction: the parent spec names "hit-target determines
camera vs. object mode" (tap-select vs. camera-gesture disambiguation) as
"the primary defense against accidental manipulation" — that's the one
thing this spike exists to test on real touch hardware. Camera navigation,
rotation, multi-piece scenes, and everything else Prototype 0 covered on
desktop are not re-tested here; desktop already answered "is the concept
fun," this stage only answers "does touch feel right."

### Grid-snap math

Each engine reimplements the grid-snap logic natively (GDScript for Godot,
TypeScript for Three.js) rather than porting Prototype 0's Python — the
logic (`round(value / increment) * increment`) is small enough that a
shared-code indirection isn't worth it, but both implementations must stay
behaviorally identical (same rounding, same 1" increment) so the two
spikes remain a fair comparison.

## Project structure

New top-level `spikes/` directory, siblings to the existing `woodcraft/`
(Prototype 0 stays exactly where it is):

```
woodcraft-prototype/
  woodcraft/                              # Prototype 0 (Panda3D, unchanged)
  spikes/
    touch-spike-godot/                    # new: Godot project
    touch-spike-threejs/                  # new: Three.js/R3F project
  docs/superpowers/specs/
    2026-08-20-woodcraft-prototype-design.md
    2026-08-21-platform-decision-touch-spike-design.md   # this document
```

`CLAUDE.md` gets one more routing line once this spec and its eventual
plan exist.

## Device testing

**Physical Android device** — an emulator's simulated touch (usually
mouse-driven) is a weak proxy for real multi-touch/pinch feel, which is
exactly what this spike exists to judge, so a real device is required, not
optional. iOS is out of scope for this stage (would need a Mac or a cloud
Mac service — real extra setup cost not justified until Android narrows
the field, or doesn't).

Getting each spike onto the device is asymmetric, and that asymmetry is
itself a data point worth recording alongside the feel verdict:

- **Godot**: requires one-time setup — Android SDK + build tools + export
  templates installed in the Godot editor, plus USB debugging enabled on
  the device. After that, export an APK and install via `adb install`, or
  use Godot's one-click deploy to push and launch directly over USB.
  **This setup does not currently exist and must be done as part of this
  stage** (confirmed with the user — no prior Godot Android export
  environment).
- **Three.js/R3F**: no build/export/install step. Run a local dev server,
  open the URL from the phone's mobile browser over the same Wi-Fi (or USB
  port-forwarding). Note this tests "in a mobile browser," not "as an
  installed app" — worth keeping in mind if browser touch-event quirks
  ever become the deciding factor.

## Decision method

**Subjective feel judgment** — same method Prototype 0's own verdict used.
Play both spikes back-to-back on the Android device; pick whichever feels
more responsive and natural for tap-select and drag-to-snap. No formal
scorecard, no FPS instrumentation — deliberately lightweight, matching the
spike's own throwaway framing. The Godot/Three.js setup-friction asymmetry
above is recorded as supporting context for the decision, not a scored
criterion.

## Testing / validation approach

Feel-driven UI work isn't meaningfully unit-testable end-to-end, same as
Prototype 0. Scope testing proportionally:

- Each engine's grid-snap function gets a handful of quick inline
  assertions (GDScript's built-in `assert()`; a minimal Vitest/Jest check
  for the TypeScript version) — enough to catch an obviously wrong
  rounding bug before it confuses the feel judgment, not a full test
  framework investment.
- Tap-select, drag, and camera-vs-object disambiguation are verified
  manually on-device — there is no meaningful automated substitute for the
  thing being judged.

## Deliverable

A short decision record, not a full writeup: after the side-by-side
session, the verdict (which engine, why, any concrete blockers hit) is
captured as a short note — either appended to this document or as its own
`docs/superpowers/specs/YYYY-MM-DD-platform-decision-result.md` — written
once the playtest actually happens. This is what Prototype 1's own future
brainstorm reads before starting.

## Out of scope

Everything the parent spec already defers, plus, specific to this stage:

- Camera orbit/pan/zoom gestures (Prototype 0 already covers camera concept
  validation on desktop; this stage isolates touch-drag feel only).
- Piece rotation, resize, duplicate, delete, group/ungroup.
- More than 2 boards, piece-to-piece anchor snapping, materials/textures,
  UI chrome, save/load.
- iOS testing (Android-only for this stage).
- A formal scoring rubric for the decision (explicitly rejected in favor of
  subjective judgment, matching Prototype 0's own method).
