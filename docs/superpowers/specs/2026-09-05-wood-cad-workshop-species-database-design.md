# Wood CAD Workshop — Species/Material Database Design

Status: approved for implementation.

## Relationship to prior work

This is sub-project 1 of a three-part decomposition of "B group"
structural-strength ideas surfaced by
[docs/reference/structural-strength-and-competitive-research.md](../../reference/structural-strength-and-competitive-research.md):

1. **Species/material database (this spec).**
2. `jointType` on `Connection`, with per-type joint strength data.
3. A general-purpose structural check for any WOOD component (not just
   `pullup_bar`), built once (1) and (2) exist to feed it real data.

This spec also **supersedes part of**
[2026-08-25-wood-cad-workshop-structural-check-design.md](2026-08-25-wood-cad-workshop-structural-check-design.md)'s
2026-09-05 amendment: `PULLUP_BAR_DEFINITION.structuralProperties.bendingStrength`
(a single hardcoded, definition-level constant) is replaced by a
per-instance `speciesId` selection resolved against the species table
below. `connectionCapacity` (the end-connection check) is untouched —
it estimates joint/hardware strength, not the bar's own material, and
is sub-project 2's concern.

## Scope

Species selection applies to **every `WOOD`-category component**
(`board`, `square_beam`, `vertical_post`, `round_rod`, `foot`,
`pullup_bar`) — not just `pullup_bar`. Rationale: this sub-project is
pure data/selection infrastructure with no new check attached to most
of these components yet, so widening it costs little now and avoids
redoing the data model when sub-project 3 (general check) arrives.
`HARDWARE`/`FASTENER` components (`l_bracket`, `wood_screw`) are
unaffected — no species concept applies to them.

Explicitly out of scope: `jointType`/connection strength (sub-project
2), a general structural check for any WOOD component beyond the
existing `pullup_bar` bending/connection checks (sub-project 3),
user-added custom species, and per-instance manual color override
(species selection *is* the color mechanism now — see below).

## Species table

New file `src/engine/core/species.ts` — a small static table, following
the same "pure data, no React/Three.js" convention as `engine/core/*`:

```ts
export interface SpeciesDefinition {
  id: string
  name: string
  color: string // hex — drives ComponentInstance.material when selected
  bendingStrength: number // MOR, in Pa
  sourceLabel: string // e.g. "red oak, USDA Wood Handbook" — used verbatim in Inspector citations
  sourceUrl: string
}

export function getSpecies(id: string | undefined): SpeciesDefinition | undefined
export const SPECIES_LIST: SpeciesDefinition[]
```

All six entries cite the same source (USDA Forest Products Laboratory,
Wood Handbook, Chapter 5, Table 5-3a:
https://www.fpl.fs.usda.gov/documnts/fplgtr/fplgtr190/chapter_05.pdf),
static bending MOR, dry (12% MC) condition:

| id | name | bendingStrength | color (representative) |
|---|---|---|---|
| `red_oak` | Red Oak | 98.6 MPa (98,600,000 Pa) | `#a6693f` (existing pullup_bar/board color) |
| `white_oak` | White Oak | 105 MPa (105,000,000 Pa) | `#b58a5c` |
| `sugar_maple` | Sugar Maple | 109 MPa (109,000,000 Pa) | `#d8c39a` |
| `yellow_birch` | Yellow Birch | 114 MPa (114,000,000 Pa) | `#c9a273` (existing round_rod color) |
| `douglas_fir` | Douglas Fir | 85 MPa (85,000,000 Pa) | `#c19a6b` |
| `longleaf_pine` | Longleaf Pine | 100 MPa (100,000,000 Pa) | `#e0b98d` |

`red_oak`'s value keeps the more precise citation already used in
`PULLUP_BAR_DEFINITION` (14,300 psi / 98.6 MPa) rather than the rounded
99 MPa a secondary aggregator table showed for the same table entry —
the two agree closely (used as a cross-check that the aggregator's
other five values are reading the same Wood Handbook table correctly),
but `red_oak` itself keeps the primary-source figure.

## Data model changes

`src/engine/core/types.ts`:

```ts
export interface ComponentInstance {
  // ...unchanged fields...
  speciesId?: string // present only on WOOD-category instances
}

export interface ComponentDefinition {
  // ...unchanged fields...
  defaultSpeciesId: string | null // explicit on every definition, like explodeDirection — a species id for WOOD components, null otherwise
}
```

`StructuralProperties.bendingStrength` (added by the prior spec) is
**removed** — `PULLUP_BAR_DEFINITION.structuralProperties` keeps only
`connectionCapacity`. No other definition ever set `bendingStrength`,
so this is a clean removal, not a widening/narrowing concern.

## Wiring

- **`spawn.ts`**: `createInstance` copies `speciesId: definition.defaultSpeciesId ?? undefined` alongside the existing `material: definition.material` line.

**Amendment (found in final review):** the bullet above was incomplete — copying `material: definition.material` verbatim left 4 of 6 WOOD components' spawned color silently contradicting their own `defaultSpeciesId` (their hardcoded `material` hex didn't match that species' actual color). The implemented, corrected version derives `material` from the resolved species' color when one exists (`getSpecies(definition.defaultSpeciesId ?? undefined)?.color ?? definition.material`), falling back to `definition.material` only for `HARDWARE`/`FASTENER` components, which have no species. Any future sub-project that spawns a WOOD instance must go through this same derivation, not copy a definition's raw `material` field directly.
- **`seedScene.ts`**: its two board instances are hand-written object
  literals, not built via `createInstance` — they bypass the wiring
  above entirely and would otherwise spawn with `speciesId: undefined`
  on a WOOD piece (an inconsistent, untested state the dropdown would
  have no good default for). They also currently use two different
  hardcoded hex colors (`#a6693f`/`#8c5730`) specifically so the two
  boards are visually distinguishable in the demo scene — which
  directly conflicts with "species selection is the only way to set a
  WOOD instance's color" below. Fix: give `board-a` and `board-b`
  different explicit `speciesId`s that reproduce (or reasonably
  approximate) that same visual distinction — e.g. `board-a:
  'douglas_fir'`, `board-b: 'red_oak'` — with `material` set to each
  chosen species' own `color` instead of the current bespoke hex
  values, rather than leaving them undefined or exempting them from
  the rule.
- **Component definitions** each get an explicit `defaultSpeciesId`:
  - `pullup_bar`, `foot` → `'red_oak'` (matches today's de facto
    default — no behavior change for existing scenes/tests that don't
    touch species).
  - `round_rod` → `'yellow_birch'` **(corrected in final review — see
    below; originally spec'd as `'red_oak'`, which was wrong)**.
  - `board`, `square_beam`, `vertical_post` → `'douglas_fir'`
    (construction-lumber-style defaults, matching this app's existing
    "2×4 board" dimension defaults).
  - `l_bracket`, `wood_screw` → `null`.

**Amendment (found in final review):** `round_rod`'s `defaultSpeciesId`
was originally spec'd as `'red_oak'` under the "no behavior change"
rationale above — but that was computed wrong. `round_rod`'s actual
pre-existing `material` (`#c9a273`) is `yellow_birch`'s color (see the
species table above, which already noted `#c9a273` as "existing
round_rod color" against `yellow_birch`, not `red_oak`), not
`red_oak`'s (`#a6693f`). `'yellow_birch'` is what actually achieves "no
behavior change" for this component, and is what's implemented.
- **`sceneSessionStore.ts`**: new action `changeSpecies(id: string, speciesId: string)` — looks up `getSpecies(speciesId)`, and in one `set` call updates both `instance.speciesId` and `instance.material` (to the species' `color`). A no-op (returns unchanged state) if the id isn't found, matching this file's existing not-found guards elsewhere (e.g. `movePiece`'s `if (!moving) return state`).
- **`Inspector.tsx`**: the existing `checkPullupBarBending` call sources `bendingStrength` from `getSpecies(instance.speciesId)?.bendingStrength` instead of `definition.structuralProperties.bendingStrength`. If that's `undefined` (species not found — shouldn't happen given every WOOD instance gets a `defaultSpeciesId` at spawn, but the check stays defensive), the bending row doesn't render, same as today's `bendingStrength !== undefined` gate.

## UI

`Inspector.tsx`'s existing "Material" section (currently a static
color swatch + hex text, unconditional for every component) branches
on category:

- **WOOD instances**: replaced by a `<select>` listing `SPECIES_LIST`
  (value = `speciesId`, label = `name`), `onChange` calls
  `changeSpecies(instance.id, e.target.value)`. Keeps the small color
  swatch next to it, now reflecting the selected species' `color`
  rather than the raw stored hex.
- **HARDWARE/FASTENER instances**: unchanged — the current read-only
  swatch + hex text, exactly as today.

The bending check's citation row (`StructuralResultRow`, added by the
prior spec) becomes dynamic: `sourceLabel` is built from the
*currently selected* species (`` `${species.name}, USDA Wood Handbook` ``)
instead of the hardcoded `"red oak, USDA Wood Handbook"` string — so
switching species updates both the computed safety factor and the
citation text together. `connectionCapacity`'s citation row is
untouched (still the static spruce/woodgears.ca text — unrelated to
species).

## Testing

- `species.test.ts` (new, vitest, mirrors `structuralCheck.test.ts`'s
  flat style): `getSpecies` returns the right `SpeciesDefinition` for
  each of the 6 known ids, returns `undefined` for an unknown id and
  for `undefined` input.
- `sceneSessionStore.test.ts`: new test for `changeSpecies` — asserts
  both `speciesId` and `material` update together for a known species
  id, and that an unknown species id leaves state unchanged (same
  object reference, matching this file's existing no-op assertion
  style, e.g. the "moves only the dragged piece" test's
  `expect(nextR2).toBe(other)`).
- `Inspector.tsx`: UI, left untested per this project's established
  convention — verified via `tsc -b` and a manual/Playwright smoke
  test (select a WOOD piece, confirm the species dropdown appears and
  is absent for a HARDWARE piece, switch species, confirm color swatch
  and — for `pullup_bar` — the bending safety factor and citation text
  update together).
- `tsc -b` clean: `defaultSpeciesId` being newly required (not
  optional) on `ComponentDefinition` surfaces every place a
  `ComponentDefinition` literal is built — not just the 8
  `components/*/index.ts` files, but also the `ComponentDefinition`
  test fixtures in `connectionPoints.test.ts`, `connections.test.ts`,
  `framing.test.ts`, and `sceneSessionStore.test.ts`. Every one of
  those needs `defaultSpeciesId: null` added (none of those tests
  exercise species behavior, so a uniform `null` is correct for all of
  them) — this is expected, mechanical fallout of the new required
  field, not a design gap to resolve differently per file.

## Out of scope (explicit)

- `jointType` / connection strength data (sub-project 2).
- A structural check for any WOOD component other than the existing
  `pullup_bar` bending/connection checks (sub-project 3).
- User-defined/custom species, or editing a species' own values from
  the UI — the table is a fixed, hardcoded list, same spirit as every
  other estimate constant in this app.
- Manual per-instance color override independent of species — species
  selection is now the only way to change a WOOD instance's displayed
  color.
- Moisture-content adjustment, grain-direction effects, or any other
  Wood Handbook data beyond the single MOR figure per species.
