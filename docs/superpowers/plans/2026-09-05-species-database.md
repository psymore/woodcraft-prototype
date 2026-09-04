# Species/Material Database Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give every `WOOD`-category component a real, user-selectable species (from a small cited table) that drives both its rendered color and its structural bending strength, replacing `pullup_bar`'s single hardcoded `bendingStrength` constant.

**Architecture:** A new pure-data module (`engine/core/species.ts`) provides a static table of 6 species (id, name, color, bending MOR, citation). `ComponentInstance` gains an optional `speciesId`; `ComponentDefinition` gains a required `defaultSpeciesId` (a species id for WOOD components, `null` otherwise) copied into new instances at spawn time. A new store action `changeSpecies` updates an instance's `speciesId` and derived `material` color together. `Inspector.tsx` replaces the static color swatch with a species `<select>` for WOOD pieces only, and sources the bending check's strength value and citation from the selected species instead of the component definition.

**Tech Stack:** TypeScript, React, Zustand, Vitest — matches the rest of `wood-cad-workshop/`, no new dependencies.

**Spec:** [docs/superpowers/specs/2026-09-05-wood-cad-workshop-species-database-design.md](../specs/2026-09-05-wood-cad-workshop-species-database-design.md)

## Global Constraints

- All 6 species cite USDA Forest Products Laboratory, Wood Handbook, Chapter 5, Table 5-3a: `https://www.fpl.fs.usda.gov/documnts/fplgtr/fplgtr190/chapter_05.pdf` — static bending MOR, dry (12% MC).
- `defaultSpeciesId` is `string | null`, **explicit on every `ComponentDefinition`** (like the existing `explodeDirection: null` field) — never left optional/undefined.
- Species selection is the *only* way to change a WOOD instance's color — no separate manual color picker.
- `jointType`/connection strength and a general structural check for non-`pullup_bar` WOOD components are out of scope for this plan (separate sub-projects).
- All commands below run from `wood-cad-workshop/` (the app's own directory), e.g. `cd wood-cad-workshop && npx vitest run ...`.

---

### Task 1: Species table module

**Files:**
- Create: `wood-cad-workshop/src/engine/core/species.ts`
- Create: `wood-cad-workshop/src/engine/core/species.test.ts`
- Modify: `wood-cad-workshop/src/engine/index.ts`

**Interfaces:**
- Produces: `SpeciesDefinition { id: string; name: string; color: string; bendingStrength: number; sourceLabel: string; sourceUrl: string }`, `SPECIES_LIST: SpeciesDefinition[]`, `getSpecies(id: string | undefined): SpeciesDefinition | undefined` — all exported from `engine/core/species.ts` and re-exported through `engine/index.ts` (Tasks 3, 5, 6 import them via `'../engine'`).

- [ ] **Step 1: Write the failing tests**

Create `wood-cad-workshop/src/engine/core/species.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { getSpecies, SPECIES_LIST } from './species'

describe('SPECIES_LIST', () => {
  it('has exactly 6 species with unique ids', () => {
    expect(SPECIES_LIST).toHaveLength(6)
    const ids = SPECIES_LIST.map((s) => s.id)
    expect(new Set(ids).size).toBe(6)
  })
})

describe('getSpecies', () => {
  it('returns the matching species for each known id', () => {
    for (const species of SPECIES_LIST) {
      expect(getSpecies(species.id)).toEqual(species)
    }
  })

  it('returns undefined for an unknown id', () => {
    expect(getSpecies('unobtainium')).toBeUndefined()
  })

  it('returns undefined for undefined input', () => {
    expect(getSpecies(undefined)).toBeUndefined()
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd wood-cad-workshop && npx vitest run src/engine/core/species.test.ts`
Expected: FAIL — `Cannot find module './species'` (the file doesn't exist yet).

- [ ] **Step 3: Write the implementation**

Create `wood-cad-workshop/src/engine/core/species.ts`:

```ts
export interface SpeciesDefinition {
  id: string
  name: string
  color: string // hex — drives ComponentInstance.material when selected
  bendingStrength: number // MOR, in Pa
  sourceLabel: string // used verbatim as the Inspector citation text
  sourceUrl: string
}

// USDA Forest Products Laboratory, Wood Handbook, Chapter 5, Table
// 5-3a — static bending MOR, dry (12% MC) condition. All 6 species
// below cite this same table.
const WOOD_HANDBOOK_URL = 'https://www.fpl.fs.usda.gov/documnts/fplgtr/fplgtr190/chapter_05.pdf'

export const SPECIES_LIST: SpeciesDefinition[] = [
  {
    id: 'red_oak',
    name: 'Red Oak',
    color: '#a6693f',
    bendingStrength: 98_600_000, // 98.6 MPa / 14,300 psi
    sourceLabel: 'red oak, USDA Wood Handbook',
    sourceUrl: WOOD_HANDBOOK_URL,
  },
  {
    id: 'white_oak',
    name: 'White Oak',
    color: '#b58a5c',
    bendingStrength: 105_000_000, // 105 MPa
    sourceLabel: 'white oak, USDA Wood Handbook',
    sourceUrl: WOOD_HANDBOOK_URL,
  },
  {
    id: 'sugar_maple',
    name: 'Sugar Maple',
    color: '#d8c39a',
    bendingStrength: 109_000_000, // 109 MPa
    sourceLabel: 'sugar maple, USDA Wood Handbook',
    sourceUrl: WOOD_HANDBOOK_URL,
  },
  {
    id: 'yellow_birch',
    name: 'Yellow Birch',
    color: '#c9a273',
    bendingStrength: 114_000_000, // 114 MPa
    sourceLabel: 'yellow birch, USDA Wood Handbook',
    sourceUrl: WOOD_HANDBOOK_URL,
  },
  {
    id: 'douglas_fir',
    name: 'Douglas Fir',
    color: '#c19a6b',
    bendingStrength: 85_000_000, // 85 MPa
    sourceLabel: 'Douglas fir, USDA Wood Handbook',
    sourceUrl: WOOD_HANDBOOK_URL,
  },
  {
    id: 'longleaf_pine',
    name: 'Longleaf Pine',
    color: '#e0b98d',
    bendingStrength: 100_000_000, // 100 MPa
    sourceLabel: 'longleaf pine, USDA Wood Handbook',
    sourceUrl: WOOD_HANDBOOK_URL,
  },
]

export function getSpecies(id: string | undefined): SpeciesDefinition | undefined {
  if (id === undefined) return undefined
  return SPECIES_LIST.find((s) => s.id === id)
}
```

Add the export line to `wood-cad-workshop/src/engine/index.ts` (alongside the other `export * from './core/...'` lines, e.g. right after the `connectionPoints` line):

```ts
export * from './core/species'
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd wood-cad-workshop && npx vitest run src/engine/core/species.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Type-check**

Run: `cd wood-cad-workshop && npx tsc -b`
Expected: no output (clean).

- [ ] **Step 6: Commit**

```bash
git add wood-cad-workshop/src/engine/core/species.ts wood-cad-workshop/src/engine/core/species.test.ts wood-cad-workshop/src/engine/index.ts
git commit -m "feat(wood-cad-workshop): add cited species table (Wood Handbook Table 5-3a)"
```

---

### Task 2: Data model — `speciesId`/`defaultSpeciesId`, remove `bendingStrength`

**Files:**
- Modify: `wood-cad-workshop/src/engine/core/types.ts`
- Modify: `wood-cad-workshop/src/engine/components/pullupBar/index.ts`
- Modify: `wood-cad-workshop/src/engine/components/roundRod/index.ts`
- Modify: `wood-cad-workshop/src/engine/components/foot/index.ts`
- Modify: `wood-cad-workshop/src/engine/components/board/index.ts`
- Modify: `wood-cad-workshop/src/engine/components/squareBeam/index.ts`
- Modify: `wood-cad-workshop/src/engine/components/verticalPost/index.ts`
- Modify: `wood-cad-workshop/src/engine/components/lBracket/index.ts`
- Modify: `wood-cad-workshop/src/engine/components/woodScrew/index.ts`
- Modify: `wood-cad-workshop/src/engine/core/connectionPoints.test.ts`
- Modify: `wood-cad-workshop/src/engine/core/connections.test.ts`
- Modify: `wood-cad-workshop/src/engine/core/framing.test.ts`
- Modify: `wood-cad-workshop/src/store/sceneSessionStore.test.ts`
- Modify: `wood-cad-workshop/src/engine/core/structuralCheck.test.ts`

**Interfaces:**
- Consumes: nothing from Task 1.
- Produces: `ComponentInstance.speciesId?: string`, `ComponentDefinition.defaultSpeciesId: string | null` — consumed by Tasks 3, 4, 5, 6. `StructuralProperties` no longer has `bendingStrength` (only `connectionCapacity` remains) — Task 6 must stop reading `definition.structuralProperties.bendingStrength`.

This task has no new runtime behavior of its own to TDD — it's a type/data widening whose correctness is verified by `tsc -b`. All edits below must land together in one commit; the codebase won't compile with only some of them applied.

- [ ] **Step 1: Update `types.ts`**

In `wood-cad-workshop/src/engine/core/types.ts`, change:

```ts
export interface StructuralProperties {
  bendingStrength?: number // MOR (modulus of rupture), in Pa — nominal bending strength used by the structural check
  connectionCapacity?: number // nominal end-connection shear/pull-apart capacity, in N — see structuralCheck.ts's checkPullupBarConnection
}
```

to:

```ts
export interface StructuralProperties {
  connectionCapacity?: number // nominal end-connection shear/pull-apart capacity, in N — see structuralCheck.ts's checkPullupBarConnection
}
```

Change:

```ts
export interface ComponentDefinition {
  id: string
  name: string
  category: ComponentCategory
  geometry: GeometryDescriptor
  defaultDimensions: Dimensions
  material: string
  connectionRole: ConnectionRole
  structuralProperties: StructuralProperties
  explodeDirection: null
}
```

to:

```ts
export interface ComponentDefinition {
  id: string
  name: string
  category: ComponentCategory
  geometry: GeometryDescriptor
  defaultDimensions: Dimensions
  material: string
  connectionRole: ConnectionRole
  structuralProperties: StructuralProperties
  explodeDirection: null
  defaultSpeciesId: string | null // a species id (see species.ts) for WOOD components, null otherwise — explicit on every definition, like explodeDirection
}
```

Change:

```ts
export interface ComponentInstance {
  id: string
  componentDefinitionId: string
  position: [number, number, number]
  rotation: [number, number, number]
  dimensions: Dimensions
  material: string
}
```

to:

```ts
export interface ComponentInstance {
  id: string
  componentDefinitionId: string
  position: [number, number, number]
  rotation: [number, number, number]
  dimensions: Dimensions
  material: string
  speciesId?: string // present only on WOOD-category instances — see species.ts
}
```

- [ ] **Step 2: Update `pullupBar/index.ts`**

Change:

```ts
  structuralProperties: {
    // 98.6 MPa (14,300 psi) — red oak, static bending MOR, dry (12% MC).
    // USDA Forest Products Laboratory, Wood Handbook, Ch. 5, Table 5-3a:
    // https://www.fpl.fs.usda.gov/documnts/fplgtr/fplgtr190/chapter_05.pdf
    bendingStrength: 98_600_000,
    // ≈600N (135 lbf) — average breaking load of a doweled SPRUCE joint
    // (deliberately a different, weaker species than the bar's own
    // bendingStrength above — see the structural-check spec's
    // 2026-09-05 amendment for why), the weakest clean-break joint type
    // tested. woodgears.ca joint-strength tests:
    // https://woodgears.ca/joint_strength/
    connectionCapacity: 600,
  },
  explodeDirection: null,
}
```

to:

```ts
  structuralProperties: {
    // ≈600N (135 lbf) — average breaking load of a doweled SPRUCE joint
    // (deliberately a different, weaker species than the bar's own
    // bendingStrength, now sourced from the instance's selected
    // speciesId — see species.ts — rather than a fixed per-definition
    // constant; see the structural-check spec's 2026-09-05 amendment
    // for why the connection check uses a different species anyway),
    // the weakest clean-break joint type tested. woodgears.ca
    // joint-strength tests: https://woodgears.ca/joint_strength/
    connectionCapacity: 600,
  },
  explodeDirection: null,
  defaultSpeciesId: 'red_oak',
}
```

- [ ] **Step 3: Update the remaining 7 component definitions**

In `wood-cad-workshop/src/engine/components/roundRod/index.ts`, `foot/index.ts`: change

```ts
  structuralProperties: {},
  explodeDirection: null,
}
```

to:

```ts
  structuralProperties: {},
  explodeDirection: null,
  defaultSpeciesId: 'red_oak',
}
```

In `wood-cad-workshop/src/engine/components/board/index.ts`, `squareBeam/index.ts`, `verticalPost/index.ts`: change the same

```ts
  structuralProperties: {},
  explodeDirection: null,
}
```

to:

```ts
  structuralProperties: {},
  explodeDirection: null,
  defaultSpeciesId: 'douglas_fir',
}
```

In `wood-cad-workshop/src/engine/components/lBracket/index.ts`, `woodScrew/index.ts` (the two non-`WOOD` components): change the same

```ts
  structuralProperties: {},
  explodeDirection: null,
}
```

to:

```ts
  structuralProperties: {},
  explodeDirection: null,
  defaultSpeciesId: null,
}
```

- [ ] **Step 4: Update test fixtures**

In each of `wood-cad-workshop/src/engine/core/connectionPoints.test.ts`, `wood-cad-workshop/src/engine/core/connections.test.ts`, `wood-cad-workshop/src/engine/core/framing.test.ts`, and `wood-cad-workshop/src/store/sceneSessionStore.test.ts`: every `ComponentDefinition` fixture in that file has the exact two-line block

```ts
    structuralProperties: {},
    explodeDirection: null,
```

Change each occurrence to:

```ts
    structuralProperties: {},
    explodeDirection: null,
    defaultSpeciesId: null,
```

(This block repeats 3 times in `connectionPoints.test.ts`, 3 times in `connections.test.ts`, 2 times in `framing.test.ts`, and once in `sceneSessionStore.test.ts` — every occurrence needs the same one-line addition; a find-and-replace-all of that exact block within each file is safe since none of these tests care about species.)

- [ ] **Step 5: Fix `structuralCheck.test.ts`'s stale comment**

`wood-cad-workshop/src/engine/core/structuralCheck.test.ts` doesn't construct a `ComponentDefinition`, so it isn't broken by the type change, but its `checkPullupBarBending` test still passes `bendingStrength` as a direct function parameter (unaffected — the function signature didn't change) referencing the value that used to live on `PULLUP_BAR_DEFINITION`. No code change needed here; skip this file in Step 4's find-and-replace (it has no `ComponentDefinition` fixture).

- [ ] **Step 6: Type-check**

Run: `cd wood-cad-workshop && npx tsc -b`
Expected: no output (clean). If it lists a file/line still missing `defaultSpeciesId`, add it there too — Step 4's file list is exhaustive as of this plan's writing, but `tsc` is the authority.

- [ ] **Step 7: Run the full test suite**

Run: `cd wood-cad-workshop && npx vitest run`
Expected: all tests pass (same count as before this task, since no test assertions changed — only fixtures gained a field).

- [ ] **Step 8: Commit**

```bash
git add wood-cad-workshop/src/engine/core/types.ts wood-cad-workshop/src/engine/components wood-cad-workshop/src/engine/core/connectionPoints.test.ts wood-cad-workshop/src/engine/core/connections.test.ts wood-cad-workshop/src/engine/core/framing.test.ts wood-cad-workshop/src/store/sceneSessionStore.test.ts
git commit -m "feat(wood-cad-workshop): add speciesId/defaultSpeciesId, remove bendingStrength constant"
```

---

### Task 3: Spawn wiring

**Files:**
- Modify: `wood-cad-workshop/src/engine/core/spawn.ts`
- Create: `wood-cad-workshop/src/engine/core/spawn.test.ts`

**Interfaces:**
- Consumes: `ComponentDefinition.defaultSpeciesId` (Task 2).
- Produces: `createInstance(definition)` now sets `speciesId` on the returned instance — Task 4/6 rely on every freshly-spawned WOOD instance having a real `speciesId`.

- [ ] **Step 1: Write the failing tests**

Create `wood-cad-workshop/src/engine/core/spawn.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { createInstance } from './spawn'
import type { ComponentDefinition } from './types'

function woodDefinition(defaultSpeciesId: string | null): ComponentDefinition {
  return {
    id: 'test_wood',
    name: 'Test Wood',
    category: 'WOOD',
    geometry: { shape: 'box' },
    defaultDimensions: { thickness: 1, width: 1, length: 1 },
    material: '#a6693f',
    connectionRole: 'single',
    structuralProperties: {},
    explodeDirection: null,
    defaultSpeciesId,
  }
}

describe('createInstance', () => {
  it('copies defaultSpeciesId into the new instance as speciesId', () => {
    const instance = createInstance(woodDefinition('red_oak'))
    expect(instance.speciesId).toBe('red_oak')
  })

  it('leaves speciesId undefined when defaultSpeciesId is null', () => {
    const instance = createInstance(woodDefinition(null))
    expect(instance.speciesId).toBeUndefined()
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd wood-cad-workshop && npx vitest run src/engine/core/spawn.test.ts`
Expected: FAIL — both `expect(instance.speciesId)` assertions fail because `createInstance` doesn't set `speciesId` yet (first test: `undefined` is not `'red_oak'`).

- [ ] **Step 3: Update `spawn.ts`**

Change:

```ts
  return {
    id: `${definition.id}-${Date.now()}-${spawnCounter}`,
    componentDefinitionId: definition.id,
    position: [spawnX, getRestingHeight(definition), spawnZ],
    rotation: [0, 0, 0],
    dimensions: { ...definition.defaultDimensions },
    material: definition.material,
  }
```

to:

```ts
  return {
    id: `${definition.id}-${Date.now()}-${spawnCounter}`,
    componentDefinitionId: definition.id,
    position: [spawnX, getRestingHeight(definition), spawnZ],
    rotation: [0, 0, 0],
    dimensions: { ...definition.defaultDimensions },
    material: definition.material,
    speciesId: definition.defaultSpeciesId ?? undefined,
  }
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd wood-cad-workshop && npx vitest run src/engine/core/spawn.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Run the full test suite and type-check**

Run: `cd wood-cad-workshop && npx vitest run && npx tsc -b`
Expected: all tests pass, `tsc` clean.

- [ ] **Step 6: Commit**

```bash
git add wood-cad-workshop/src/engine/core/spawn.ts wood-cad-workshop/src/engine/core/spawn.test.ts
git commit -m "feat(wood-cad-workshop): copy defaultSpeciesId into spawned instances"
```

---

### Task 4: Seed scene species + color fix

**Files:**
- Modify: `wood-cad-workshop/src/engine/seedScene.ts`
- Create: `wood-cad-workshop/src/engine/seedScene.test.ts`

**Interfaces:**
- Consumes: the `douglas_fir` (`#c19a6b`) and `red_oak` (`#a6693f`) entries from Task 1's `SPECIES_LIST`.
- Produces: nothing new consumed elsewhere — this only fixes the seed scene's two hand-written instances to carry a valid `speciesId` instead of bypassing the species system.

`seedScene.ts`'s two board instances are hand-written object literals (not built via `createInstance`), so Task 3's wiring doesn't reach them. They also currently use two bespoke hex colors (`#a6693f` / `#8c5730`) purely to look visually distinct — which now conflicts with "species selection is the only way to set a WOOD instance's color."

- [ ] **Step 1: Write the failing test**

Create `wood-cad-workshop/src/engine/seedScene.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { createSeedInstances } from './seedScene'
import { getSpecies } from './core/species'

describe('createSeedInstances', () => {
  it('gives every seed instance a valid speciesId whose color matches its material', () => {
    const instances = createSeedInstances()
    expect(instances.length).toBeGreaterThan(0)
    for (const instance of instances) {
      const species = getSpecies(instance.speciesId)
      expect(species).toBeDefined()
      expect(instance.material).toBe(species!.color)
    }
  })

  it('gives the two seed boards different species (stay visually distinct)', () => {
    const instances = createSeedInstances()
    const boardA = instances.find((i) => i.id === 'board-a')
    const boardB = instances.find((i) => i.id === 'board-b')
    expect(boardA?.speciesId).toBeDefined()
    expect(boardB?.speciesId).toBeDefined()
    expect(boardA?.speciesId).not.toBe(boardB?.speciesId)
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd wood-cad-workshop && npx vitest run src/engine/seedScene.test.ts`
Expected: FAIL — `board-a`'s `speciesId` is `undefined`, so `getSpecies(undefined)` returns `undefined` and `expect(species).toBeDefined()` fails.

- [ ] **Step 3: Update `seedScene.ts`**

Change:

```ts
export function createSeedInstances(): ComponentInstance[] {
  return [
    {
      id: 'board-a',
      componentDefinitionId: 'board',
      position: [-6, 1.75, 0],
      rotation: [0, 0, 0],
      dimensions: { thickness: 1.5, width: 3.5, length: 48 },
      material: '#a6693f',
    },
    {
      id: 'board-b',
      componentDefinitionId: 'board',
      position: [6, 1.75, 0],
      rotation: [0, 0, 0],
      dimensions: { thickness: 1.5, width: 3.5, length: 36 },
      material: '#8c5730',
    },
  ]
}
```

to:

```ts
export function createSeedInstances(): ComponentInstance[] {
  return [
    {
      id: 'board-a',
      componentDefinitionId: 'board',
      position: [-6, 1.75, 0],
      rotation: [0, 0, 0],
      dimensions: { thickness: 1.5, width: 3.5, length: 48 },
      material: '#c19a6b', // douglas_fir — see species.ts
      speciesId: 'douglas_fir',
    },
    {
      id: 'board-b',
      componentDefinitionId: 'board',
      position: [6, 1.75, 0],
      rotation: [0, 0, 0],
      dimensions: { thickness: 1.5, width: 3.5, length: 36 },
      material: '#a6693f', // red_oak — see species.ts
      speciesId: 'red_oak',
    },
  ]
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd wood-cad-workshop && npx vitest run src/engine/seedScene.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Type-check and run the full test suite**

Run: `cd wood-cad-workshop && npx tsc -b && npx vitest run`
Expected: `tsc` clean, all tests pass.

- [ ] **Step 6: Commit**

```bash
git add wood-cad-workshop/src/engine/seedScene.ts wood-cad-workshop/src/engine/seedScene.test.ts
git commit -m "fix(wood-cad-workshop): give seed scene boards a real speciesId"
```

---

### Task 5: `changeSpecies` store action

**Files:**
- Modify: `wood-cad-workshop/src/store/sceneSessionStore.ts`
- Modify: `wood-cad-workshop/src/store/sceneSessionStore.test.ts`

**Interfaces:**
- Consumes: `getSpecies(id: string | undefined): SpeciesDefinition | undefined` (Task 1).
- Produces: `changeSpecies(id: string, speciesId: string): void` on the store — Task 6's Inspector calls this from the species `<select>`'s `onChange`.

- [ ] **Step 1: Write the failing tests**

In `wood-cad-workshop/src/store/sceneSessionStore.test.ts`, add the import and a new `describe` block. Change the top import line:

```ts
import { SNAP_DISTANCE } from '../engine'
```

to:

```ts
import { SNAP_DISTANCE, getSpecies } from '../engine'
```

Add at the end of the file:

```ts

describe('changeSpecies', () => {
  it('updates both speciesId and material together for a known species', () => {
    const r1 = rod('r1', [0, 0, 0])
    const store = createSceneSessionStore()
    store.setState({ instances: [r1] })

    store.getState().changeSpecies('r1', 'sugar_maple')

    const updated = store.getState().instances.find((i) => i.id === 'r1')
    expect(updated?.speciesId).toBe('sugar_maple')
    expect(updated?.material).toBe(getSpecies('sugar_maple')!.color)
  })

  it('leaves state unchanged for an unknown species id', () => {
    const r1 = rod('r1', [0, 0, 0])
    const store = createSceneSessionStore()
    store.setState({ instances: [r1] })
    const before = store.getState().instances

    store.getState().changeSpecies('r1', 'unobtainium')

    expect(store.getState().instances).toBe(before)
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd wood-cad-workshop && npx vitest run src/store/sceneSessionStore.test.ts`
Expected: FAIL — `store.getState().changeSpecies is not a function`.

- [ ] **Step 3: Add `changeSpecies` to the store**

In `wood-cad-workshop/src/store/sceneSessionStore.ts`, add `getSpecies` to the existing import from `'../engine'`:

```ts
import {
  closestBetweenWorldAnchors,
  createInstance,
  createPullupKitInstances,
  createSeedInstances,
  findClosestConnectionMatch,
  getAnchors,
  getComponent,
  getConnectedPieceIds,
  getSpecies,
  isAnchorClaimable,
  pruneStaleConnections,
  SNAP_DISTANCE,
  toWorldAnchor,
} from '../engine'
```

Add to the `SceneSessionState` interface, alongside `changeDimensions`:

```ts
  changeSpecies: (id: string, speciesId: string) => void
```

Add the action implementation, alongside `changeDimensions`:

```ts
    changeSpecies: (id, speciesId) =>
      set((state) => {
        const species = getSpecies(speciesId)
        if (!species) return state
        return {
          instances: state.instances.map((i) => (i.id === id ? { ...i, speciesId, material: species.color } : i)),
        }
      }),
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd wood-cad-workshop && npx vitest run src/store/sceneSessionStore.test.ts`
Expected: PASS.

- [ ] **Step 5: Run the full test suite and type-check**

Run: `cd wood-cad-workshop && npx vitest run && npx tsc -b`
Expected: all tests pass, `tsc` clean.

- [ ] **Step 6: Commit**

```bash
git add wood-cad-workshop/src/store/sceneSessionStore.ts wood-cad-workshop/src/store/sceneSessionStore.test.ts
git commit -m "feat(wood-cad-workshop): add changeSpecies store action"
```

---

### Task 6: Inspector UI — species dropdown + dynamic bending citation

**Files:**
- Modify: `wood-cad-workshop/src/ui/Inspector.tsx`

**Interfaces:**
- Consumes: `getSpecies`, `SPECIES_LIST` (Task 1), `changeSpecies` (Task 5), `instance.speciesId` (Task 2/3/4).
- Produces: nothing consumed elsewhere — this is the final task in this plan.

No new automated test — `Inspector.tsx` is UI, left untested per this project's established convention (see `docs/superpowers/specs/2026-08-25-wood-cad-workshop-structural-check-design.md`'s own Testing section, which does the same for this file). Verified via `tsc -b` plus the manual/Playwright smoke test in Step 5 below.

- [ ] **Step 1: Update imports**

Change:

```tsx
import { getComponent, checkPullupBarBending, checkPullupBarConnection, type StructuralCheckStatus } from '../engine'
```

to:

```tsx
import { getComponent, checkPullupBarBending, checkPullupBarConnection, getSpecies, SPECIES_LIST, type StructuralCheckStatus } from '../engine'
```

Add `changeSpecies` alongside the other store selectors near the top of the `Inspector` function:

```tsx
  const changeSpecies = useSceneSession((s) => s.changeSpecies)
```

- [ ] **Step 2: Source the bending check from the selected species**

Change:

```tsx
  const isPullupBar = instance.componentDefinitionId === 'pullup_bar'
  const { bendingStrength, connectionCapacity } = definition.structuralProperties
  const bendingResult =
    isPullupBar && bendingStrength !== undefined
      ? checkPullupBarBending({
          diameterIn: instance.dimensions.diameter,
          lengthIn: instance.dimensions.length,
          userWeightKg,
          bendingStrength,
        })
      : null
  const connectionResult =
    isPullupBar && connectionCapacity !== undefined ? checkPullupBarConnection({ userWeightKg, connectionCapacity }) : null
  const showStructuralSection = bendingResult !== null || connectionResult !== null
```

to:

```tsx
  const isPullupBar = instance.componentDefinitionId === 'pullup_bar'
  const { connectionCapacity } = definition.structuralProperties
  const species = getSpecies(instance.speciesId)
  const bendingResult =
    isPullupBar && species !== undefined
      ? checkPullupBarBending({
          diameterIn: instance.dimensions.diameter,
          lengthIn: instance.dimensions.length,
          userWeightKg,
          bendingStrength: species.bendingStrength,
        })
      : null
  const connectionResult =
    isPullupBar && connectionCapacity !== undefined ? checkPullupBarConnection({ userWeightKg, connectionCapacity }) : null
  const showStructuralSection = bendingResult !== null || connectionResult !== null
```

- [ ] **Step 3: Replace the Material section**

Change:

```tsx
      <div style={{ fontWeight: 'bold', marginTop: 8 }}>Material</div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <span
          style={{
            width: 16,
            height: 16,
            background: instance.material,
            border: '1px solid #999',
            display: 'inline-block',
          }}
        />
        {instance.material}
      </div>
```

to:

```tsx
      <div style={{ fontWeight: 'bold', marginTop: 8 }}>Material</div>
      {definition.category === 'WOOD' ? (
        <label style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 4 }}>
          <span
            style={{
              width: 16,
              height: 16,
              background: instance.material,
              border: '1px solid #999',
              display: 'inline-block',
              flexShrink: 0,
            }}
          />
          <select value={instance.speciesId ?? ''} onChange={(e) => changeSpecies(instance.id, e.target.value)} style={{ minHeight: 44 }}>
            {SPECIES_LIST.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </label>
      ) : (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span
            style={{
              width: 16,
              height: 16,
              background: instance.material,
              border: '1px solid #999',
              display: 'inline-block',
            }}
          />
          {instance.material}
        </div>
      )}
```

- [ ] **Step 4: Make the bending citation dynamic**

Change:

```tsx
          {bendingResult && (
            <StructuralResultRow
              label="Bending safety factor"
              status={bendingResult.status}
              safetyFactor={bendingResult.safetyFactor}
              sourceLabel="red oak, USDA Wood Handbook"
              sourceUrl="https://www.fpl.fs.usda.gov/documnts/fplgtr/fplgtr190/chapter_05.pdf"
            />
          )}
```

to:

```tsx
          {bendingResult && species && (
            <StructuralResultRow
              label="Bending safety factor"
              status={bendingResult.status}
              safetyFactor={bendingResult.safetyFactor}
              sourceLabel={species.sourceLabel}
              sourceUrl={species.sourceUrl}
            />
          )}
```

- [ ] **Step 5: Type-check, run the full test suite, and smoke-test in a browser**

Run: `cd wood-cad-workshop && npx tsc -b && npx vitest run`
Expected: `tsc` clean, all tests pass.

Manual/Playwright smoke test:

1. Temporarily add this line at the bottom of `wood-cad-workshop/src/store/sceneSessionStore.ts`, right after `export const useSceneSession = createSceneSessionStore()`:
   ```ts
   ;(window as unknown as { __sceneStore: typeof useSceneSession }).__sceneStore = useSceneSession
   ```
2. Start the dev server in the background: `cd wood-cad-workshop && npm run dev` (serves on `http://localhost:5180/` per `vite.config.ts`).
3. From `wood-cad-workshop/`, install a throwaway Playwright: `npm install --no-save playwright`, then `npx playwright install chromium` (downloads the browser if not already cached).
4. Create `wood-cad-workshop/smoke-test.mjs` with exactly this content:

   ```js
   import { chromium } from 'playwright'

   const browser = await chromium.launch()
   const page = await browser.newPage({ viewport: { width: 1000, height: 900 } })
   const errors = []
   page.on('console', (msg) => { if (msg.type() === 'error') errors.push(msg.text()) })
   page.on('pageerror', (err) => errors.push(String(err)))

   await page.goto('http://localhost:5180/', { waitUntil: 'networkidle' })
   await page.waitForTimeout(500)

   // WOOD instance (pullup_bar) selected — species <select> should appear with 6 options
   await page.evaluate(() => {
     window.__sceneStore.setState({
       instances: [
         { id: 'bar1', componentDefinitionId: 'pullup_bar', position: [0, 5, 0], rotation: [0, 0, 0], dimensions: { diameter: 1.25, length: 48 }, material: '#a6693f', speciesId: 'red_oak' },
       ],
       connections: [],
       selectedId: 'bar1',
     })
   })
   await page.waitForTimeout(300)
   const optionCount = await page.$$eval('select option', (els) => els.length)
   const beforeText = await page.evaluate(() => document.body.innerText)

   // Switch species — bending safety factor and citation text must change together
   await page.selectOption('select', 'sugar_maple')
   await page.waitForTimeout(300)
   const afterText = await page.evaluate(() => document.body.innerText)

   // HARDWARE instance (l_bracket) selected — no <select> should be present
   await page.evaluate(() => {
     window.__sceneStore.setState({
       instances: [
         { id: 'lb1', componentDefinitionId: 'l_bracket', position: [0, 1, 0], rotation: [0, 0, 0], dimensions: { thickness: 0.125, width: 1.5, length: 1.5 }, material: '#8a8a8a' },
       ],
       connections: [],
       selectedId: 'lb1',
     })
   })
   await page.waitForTimeout(300)
   const selectPresentForHardware = (await page.$('select')) !== null

   console.log('console/page errors:', JSON.stringify(errors))
   console.log('option count (expect 6):', optionCount)
   console.log('citation changed to sugar maple (expect true):', afterText.includes('sugar maple, USDA Wood Handbook') && !beforeText.includes('sugar maple'))
   console.log('select present for HARDWARE instance (expect false):', selectPresentForHardware)

   await browser.close()
   ```

5. Run it: `cd wood-cad-workshop && node smoke-test.mjs`. Expected output: `console/page errors: []`, `option count (expect 6): 6`, `citation changed to sugar maple (expect true): true`, `select present for HARDWARE instance (expect false): false`.
6. Clean up: revert the Step 1 window-hook line in `sceneSessionStore.ts`, delete `wood-cad-workshop/smoke-test.mjs`, and run `cd wood-cad-workshop && npm uninstall playwright`.
7. Run `cd wood-cad-workshop && npx tsc -b && npx vitest run` one more time to confirm the revert left everything clean.

- [ ] **Step 6: Commit**

```bash
git add wood-cad-workshop/src/ui/Inspector.tsx
git commit -m "feat(wood-cad-workshop): add species dropdown, source bending check from selected species"
```
