# Wood CAD Workshop — Structural Check (Sub-project 6) Design

Status: approved for implementation, scoped to the pull-up bar only.

## Relationship to prior stages

[2026-08-22-wood-cad-workshop-design.md](2026-08-22-wood-cad-workshop-design.md)
scoped this as Sub-project 6 of the original dual-engine roadmap: "load
input → force/safety-factor calc → preliminary bending check on the
pull-up bar, explicitly labeled as an estimate, never certified
analysis." That document's roadmap is historical (the dual-engine
comparison ended in a Three.js decision — see its appended note), but
the Sub-project 6 feature description itself still stands as the scope
for this spec, now targeting `wood-cad-workshop/` only.

Per the approval-gate rule in [CLAUDE.md](../../../CLAUDE.md#before-you-start),
this sub-project needed its own spec before implementation — this
document is that spec. `wood-cad-workshop/` already carries the
functionality of the original roadmap's Sub-projects 1–5 (foundation,
inventory, hardware/snap, pull-up assembly, exploded view), verified at
parity against `spikes/touch-spike-threejs/` on 2026-08-25 (see
`docs/superpowers/plans/ACTIVE-WORK-vscode.md`).

## Scope

Structural check applies **only to the `pullup_bar` component**, not a
general-purpose check for any wood/hardware component. Rationale:
matches the design doc's original wording, avoids scoping decisions
about which geometries/materials the check would need to generalize
across, and ships the estimate where it's actually useful — the one
component in this app a person's bodyweight hangs from.

Explicitly out of scope (per the original master prompt's
constraints, echoed in the parent design doc): a CAD constraint
solver, real FEA, wood fracture simulation, dynamic/impact loading,
buckling or shear checks, deflection limits, structural checks on any
component other than the pull-up bar, and anything resembling
certified structural analysis. The UI must visibly label the result as
an estimate.

## Engineering model

The pull-up bar is modeled as a **simply-supported beam** (mounted
between the two vertical posts, matching the existing kit assembly)
under a **static point load at midspan** (a person's weight, hands
together at the bar's center — the standard conservative model for
this use case; no dynamic/impact multiplier).

Given:
- `P` — load force (from user-entered weight)
- `L` — bar length between supports (the bar's `length` dimension)
- `d` — bar diameter (the bar's `diameter` dimension)
- `bendingStrength` — the material's nominal bending strength (MOR)

Formulas (solid circular cross-section):
```
M = P·L / 4                 // max bending moment, center point load
Z = π·d³ / 32                // section modulus, solid circle
σ = M / Z                    // max bending stress
SF = bendingStrength / σ     // safety factor
```

Existing component dimensions are in inches (confirmed from
`board`'s `defaultDimensions: { thickness: 1.5, width: 3.5, length: 48 }`
— standard 2×4 lumber). The calc module works in a single consistent
unit system internally (SI: meters, newtons, pascals) and converts
at its input/output boundary, so the formulas above aren't tied to
any one unit system in code — only the module's public function
signature documents which units its parameters expect.

Safety factor thresholds (common engineering practice for structures
bearing human weight, applied here as an estimate, not a code
citation):
- `SF ≥ 4` → `safe`
- `2 ≤ SF < 4` → `warning`
- `SF < 2` → `unsafe`

## Data model change

`ComponentDefinition.structuralProperties` is currently typed
`Record<string, never>` — a reserved field that cannot hold any keys
yet (see `src/engine/core/types.ts`). This spec gives it real shape:

```ts
export interface StructuralProperties {
  bendingStrength?: number // MOR, in Pa (SI) — present only on components the structural check applies to
}
```

`ComponentDefinition.structuralProperties: StructuralProperties`
replaces the `Record<string, never>` placeholder. This is additive/
widening, not breaking: every existing component definition's `{}`
literal still type-checks against the new interface (all fields
optional). Only `PULLUP_BAR_DEFINITION` (in
`src/engine/components/pullupBar/index.ts`) gets a real
`bendingStrength` value — a representative hardwood dowel MOR (e.g.
red oak, ~98 MPa / ~14,300 psi ultimate bending strength; exact
citation-grade sourcing is not required since this is explicitly an
estimate tool, not certified analysis). All other component
definitions keep `structuralProperties: {}`.

## Calc module

New file `src/engine/core/structuralCheck.ts` — a pure, rendering-free
function following the existing `snap.ts`/`explode.ts` isolation
pattern (no React/Three.js imports):

```ts
export type StructuralCheckStatus = 'safe' | 'warning' | 'unsafe'

export interface StructuralCheckResult {
  stress: number        // Pa
  safetyFactor: number
  status: StructuralCheckStatus
}

export function checkPullupBarBending(params: {
  diameter: number       // inches (bar's own dimension unit)
  length: number         // inches
  userWeightKg: number
  bendingStrength: number // Pa
}): StructuralCheckResult
```

Handles the inch→meter and kg→newton conversions internally. Guards
degenerate input (e.g. `userWeightKg <= 0` or `diameter <= 0`) by
returning a `safe` result with `stress: 0, safetyFactor: Infinity`
rather than throwing — the UI never sends invalid input because the
weight field has a sane default and a minimum, but the function stays
total or a NaN/Infinity leak from a future rounding-error input would
crash the inspector.

Unit tests in `src/engine/core/structuralCheck.test.ts` (vitest, same
pattern as `snap.test.ts`/`explode.test.ts`): known-input/known-output
cases for each status band, and a boundary case at each threshold.

## UI

`src/ui/Inspector.tsx` gains a new section, rendered only when
`instance.componentDefinitionId === 'pullup_bar'`:

- Heading: "Structural Check (estimate)"
- A numeric "User weight (kg)" input, local component state (not
  persisted to the session store — this is a what-if calculator, not
  a scene property), default 80, min 1
- Computed safety factor, shown with a colored status chip (green/
  amber/red matching `safe`/`warning`/`unsafe`)
- A fixed disclaimer line: "Estimate only — not a certified structural
  analysis."

No new panel, no new button — this keeps the feature additive to the
existing Inspector rather than introducing new UI chrome, consistent
with Sub-project 7 (mobile polish) not having happened yet.

## Testing

- `structuralCheck.test.ts` (vitest): formula correctness at known
  inputs, status-threshold boundaries, degenerate-input guard.
- `tsc -b` clean (the `structuralProperties` type widening must not
  break any existing component definition).
- Manual verification: select the pull-up bar in `wood-cad-workshop/`,
  confirm the new Inspector section appears (and only for the pull-up
  bar), enter a few weights spanning safe/warning/unsafe, confirm the
  status chip and safety factor update live.

## Out of scope (explicit)

- Structural checks on any component other than `pullup_bar`.
- Dynamic/impact loading, buckling, shear, deflection limits.
- A real material/species database — `bendingStrength` is a single
  hardcoded constant on one component definition, not a lookup table
  or user-editable material property.
- Persisting the entered weight to the scene/session store.
- Sub-project 7 (mobile interaction polish) — not addressed here.
