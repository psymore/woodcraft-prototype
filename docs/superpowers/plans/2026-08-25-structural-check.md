# Structural Check (Sub-project 6) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a pull-up-bar-only structural bending check to `wood-cad-workshop/` — a user enters their weight in the Inspector, the app computes a safety factor via a simply-supported-beam bending model, and shows a labeled estimate (safe/warning/unsafe).

**Architecture:** A new pure calc module (`src/engine/core/structuralCheck.ts`, no rendering/UI imports, same isolation pattern as `explode.ts`/`snap.ts`) implements the beam-bending formula and safety-factor classification. `ComponentDefinition.structuralProperties` — currently typed `Record<string, never>` (accepts no keys) — is widened to a real, all-optional `StructuralProperties` interface so `pullup_bar` can carry a `bendingStrength` constant. `Inspector.tsx` gains a UI section, gated on the selected instance being `pullup_bar`, that takes a weight input and renders the calc result.

**Tech Stack:** TypeScript, Vitest (existing project setup — no new dependencies).

**Spec:** [docs/superpowers/specs/2026-08-25-wood-cad-workshop-structural-check-design.md](../specs/2026-08-25-wood-cad-workshop-structural-check-design.md)

## Global Constraints

- Structural check applies **only** to the `pullup_bar` component — no other component gets a `bendingStrength` value or shows the UI section.
- Model: simply-supported beam, static point load at midspan. No dynamic/impact multiplier, no buckling/shear/deflection checks.
- Safety factor thresholds: `SF ≥ 4` → `safe`, `2 ≤ SF < 4` → `warning`, `SF < 2` → `unsafe`.
- All internal calc math happens in SI units (meters, newtons, pascals); the calc module's public function takes inches (matching how component dimensions are already stored) and kilograms (matching the UI's weight input) and converts internally — `1 in = 0.0254 m`, weight-to-force uses `g = 9.81 m/s²`.
- `pullup_bar`'s `bendingStrength` constant: `98_000_000` Pa (≈98 MPa, representative hardwood dowel MOR — an estimate, not a certified material spec, per the design doc).
- The entered weight is local UI state only — never written to `sceneSessionStore`.
- The UI must show a fixed "Estimate only — not a certified structural analysis" disclaimer whenever the section renders.
- No new dependencies, no new test infrastructure (no React Testing Library) — this codebase verifies UI manually via `npm run dev`, matching its existing pattern (`Inspector.tsx` and every other UI file under `src/ui/`/`src/scene/` has no component-level test today).

---

### Task 1: Widen `structuralProperties` and give the pull-up bar a bending strength

**Files:**
- Modify: `wood-cad-workshop/src/engine/core/types.ts`
- Modify: `wood-cad-workshop/src/engine/components/pullupBar/index.ts`

**Interfaces:**
- Consumes: nothing new.
- Produces: `StructuralProperties` interface (exported from `types.ts`) with optional `bendingStrength?: number` (Pa). `ComponentDefinition.structuralProperties: StructuralProperties`. `PULLUP_BAR_DEFINITION.structuralProperties.bendingStrength === 98_000_000`. Task 2 and Task 3 both read this field.

- [ ] **Step 1: Widen the type in `types.ts`**

In `wood-cad-workshop/src/engine/core/types.ts`, add the new interface and change the field's type:

```ts
export interface StructuralProperties {
  bendingStrength?: number // MOR (modulus of rupture), in Pa — nominal bending strength used by the structural check
}
```

Then change this line:
```ts
  structuralProperties: Record<string, never>
```
to:
```ts
  structuralProperties: StructuralProperties
```

- [ ] **Step 2: Verify the widening doesn't break any existing component definition**

Run: `cd wood-cad-workshop && npx tsc -b`
Expected: exits 0, no errors. (Every existing `structuralProperties: {}` literal — in `board`, `roundRod`, `squareBeam`, `lBracket`, `woodScrew`, `verticalPost`, `foot` — still satisfies `StructuralProperties` because every field on it is optional.)

- [ ] **Step 3: Give the pull-up bar a real bending strength**

In `wood-cad-workshop/src/engine/components/pullupBar/index.ts`, change:
```ts
  structuralProperties: {},
```
to:
```ts
  structuralProperties: { bendingStrength: 98_000_000 }, // ≈98 MPa, representative hardwood dowel MOR — estimate only
```

- [ ] **Step 4: Verify again**

Run: `cd wood-cad-workshop && npx tsc -b`
Expected: exits 0, no errors.

- [ ] **Step 5: Commit**

```bash
cd wood-cad-workshop
git add src/engine/core/types.ts src/engine/components/pullupBar/index.ts
git commit -m "feat(wood-cad-workshop): add bendingStrength to structuralProperties

Widens the reserved structuralProperties field so the pull-up bar can
carry a nominal bending strength for the structural check calc.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 2: Structural check calc module

**Files:**
- Create: `wood-cad-workshop/src/engine/core/structuralCheck.ts`
- Create: `wood-cad-workshop/src/engine/core/structuralCheck.test.ts`
- Modify: `wood-cad-workshop/src/engine/index.ts`

**Interfaces:**
- Consumes: nothing (pure module, no imports from `types.ts` needed — all inputs are primitives).
- Produces:
  ```ts
  export type StructuralCheckStatus = 'safe' | 'warning' | 'unsafe'

  export interface StructuralCheckResult {
    stress: number        // Pa
    safetyFactor: number
    status: StructuralCheckStatus
  }

  export function classifySafetyFactor(safetyFactor: number): StructuralCheckStatus

  export function checkPullupBarBending(params: {
    diameterIn: number
    lengthIn: number
    userWeightKg: number
    bendingStrength: number // Pa
  }): StructuralCheckResult
  ```
  Task 3's Inspector import: `import { checkPullupBarBending } from '../engine'`.

- [ ] **Step 1: Write the failing tests**

Create `wood-cad-workshop/src/engine/core/structuralCheck.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { checkPullupBarBending, classifySafetyFactor } from './structuralCheck'

describe('classifySafetyFactor', () => {
  it('classifies safe at and above 4', () => {
    expect(classifySafetyFactor(4)).toBe('safe')
    expect(classifySafetyFactor(10)).toBe('safe')
  })

  it('classifies warning between 2 (inclusive) and 4 (exclusive)', () => {
    expect(classifySafetyFactor(3.99)).toBe('warning')
    expect(classifySafetyFactor(2)).toBe('warning')
  })

  it('classifies unsafe below 2', () => {
    expect(classifySafetyFactor(1.99)).toBe('unsafe')
    expect(classifySafetyFactor(0)).toBe('unsafe')
  })
})

describe('checkPullupBarBending', () => {
  it('computes a safe result for a light load on a 2in x 40in bar', () => {
    // d=2in=0.0508m, L=40in=1.016m, P=50kg*9.81=490.5N
    // M = P*L/4 ≈ 124.6 N·m, Z = π*d³/32 ≈ 1.287e-5 m³, σ ≈ 9.68 MPa
    // SF = 50e6 / 9.68e6 ≈ 5.17 -> safe
    const result = checkPullupBarBending({
      diameterIn: 2,
      lengthIn: 40,
      userWeightKg: 50,
      bendingStrength: 50_000_000,
    })
    expect(result.status).toBe('safe')
    expect(result.safetyFactor).toBeGreaterThan(4)
    expect(result.safetyFactor).toBeLessThan(7)
    expect(result.stress).toBeGreaterThan(8_000_000)
    expect(result.stress).toBeLessThan(11_000_000)
  })

  it('computes an unsafe result for the actual pull-up bar dimensions under an 80kg load', () => {
    // Mirrors PULLUP_BAR_DEFINITION (diameter=1.25in, length=48in,
    // bendingStrength=98e6 Pa) — the shipped default is too slender at
    // this span to safely hold an adult's full bodyweight, which is
    // exactly the kind of estimate this feature exists to surface.
    const result = checkPullupBarBending({
      diameterIn: 1.25,
      lengthIn: 48,
      userWeightKg: 80,
      bendingStrength: 98_000_000,
    })
    expect(result.status).toBe('unsafe')
    expect(result.safetyFactor).toBeGreaterThan(1)
    expect(result.safetyFactor).toBeLessThan(2)
  })

  it('guards against non-positive weight without throwing', () => {
    const result = checkPullupBarBending({
      diameterIn: 1.25,
      lengthIn: 48,
      userWeightKg: 0,
      bendingStrength: 98_000_000,
    })
    expect(result.stress).toBe(0)
    expect(result.safetyFactor).toBe(Infinity)
    expect(result.status).toBe('safe')
  })

  it('guards against non-positive diameter without throwing', () => {
    const result = checkPullupBarBending({
      diameterIn: 0,
      lengthIn: 48,
      userWeightKg: 80,
      bendingStrength: 98_000_000,
    })
    expect(result.stress).toBe(0)
    expect(result.safetyFactor).toBe(Infinity)
    expect(result.status).toBe('safe')
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd wood-cad-workshop && npx vitest run src/engine/core/structuralCheck.test.ts`
Expected: FAIL — `structuralCheck.ts` doesn't exist yet (module not found).

- [ ] **Step 3: Implement the calc module**

Create `wood-cad-workshop/src/engine/core/structuralCheck.ts`:

```ts
const INCHES_TO_METERS = 0.0254
const GRAVITY = 9.81 // m/s^2

export type StructuralCheckStatus = 'safe' | 'warning' | 'unsafe'

export interface StructuralCheckResult {
  stress: number // Pa
  safetyFactor: number
  status: StructuralCheckStatus
}

// Simply-supported beam, static point load at midspan — the standard
// conservative model for a pull-up bar mounted between two posts with a
// person hanging center-bar. No dynamic/impact multiplier.
export function checkPullupBarBending(params: {
  diameterIn: number
  lengthIn: number
  userWeightKg: number
  bendingStrength: number
}): StructuralCheckResult {
  const { diameterIn, lengthIn, userWeightKg, bendingStrength } = params

  if (userWeightKg <= 0 || diameterIn <= 0 || lengthIn <= 0) {
    return { stress: 0, safetyFactor: Infinity, status: 'safe' }
  }

  const diameterM = diameterIn * INCHES_TO_METERS
  const lengthM = lengthIn * INCHES_TO_METERS
  const forceN = userWeightKg * GRAVITY

  const maxMoment = (forceN * lengthM) / 4
  const sectionModulus = (Math.PI * diameterM ** 3) / 32
  const stress = maxMoment / sectionModulus
  const safetyFactor = bendingStrength / stress

  return { stress, safetyFactor, status: classifySafetyFactor(safetyFactor) }
}

export function classifySafetyFactor(safetyFactor: number): StructuralCheckStatus {
  if (safetyFactor >= 4) return 'safe'
  if (safetyFactor >= 2) return 'warning'
  return 'unsafe'
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd wood-cad-workshop && npx vitest run src/engine/core/structuralCheck.test.ts`
Expected: PASS, all 7 tests green.

- [ ] **Step 5: Export from the engine barrel**

In `wood-cad-workshop/src/engine/index.ts`, add this line alongside the other `core/*` exports (after `export * from './core/explode'`):
```ts
export * from './core/structuralCheck'
```

- [ ] **Step 6: Verify the full suite and type-check still pass**

Run: `cd wood-cad-workshop && npx vitest run && npx tsc -b`
Expected: both exit 0.

- [ ] **Step 7: Commit**

```bash
cd wood-cad-workshop
git add src/engine/core/structuralCheck.ts src/engine/core/structuralCheck.test.ts src/engine/index.ts
git commit -m "feat(wood-cad-workshop): add pull-up bar structural check calc module

Pure simply-supported-beam bending model with safety-factor
classification (safe/warning/unsafe), following the existing
snap.ts/explode.ts isolation pattern.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 3: Inspector UI section

**Files:**
- Modify: `wood-cad-workshop/src/ui/Inspector.tsx`

**Interfaces:**
- Consumes: `checkPullupBarBending`, `StructuralCheckStatus` from `../engine` (Task 2). `instance.componentDefinitionId`, `definition.structuralProperties.bendingStrength` (Task 1).
- Produces: nothing consumed by later tasks — this is the last task in the plan.

- [ ] **Step 1: Add the structural check section**

In `wood-cad-workshop/src/ui/Inspector.tsx`, add `useState` to the React import:
```ts
import { useState } from 'react'
import { getComponent, checkPullupBarBending, type StructuralCheckStatus } from '../engine'
import { useSceneSession } from '../store/sceneSessionStore'
```

Add a status-color helper and the weight-input state inside the `Inspector` function, and render the new section. The full updated component body:

```tsx
const STATUS_COLORS: Record<StructuralCheckStatus, string> = {
  safe: '#2e7d32',
  warning: '#f9a825',
  unsafe: '#c62828',
}

export function Inspector() {
  const selectedId = useSceneSession((s) => s.selectedId)
  const instance = useSceneSession((s) => s.instances.find((i) => i.id === s.selectedId) ?? null)
  const changeDimensions = useSceneSession((s) => s.changeDimensions)
  const [userWeightKg, setUserWeightKg] = useState(80)

  if (!selectedId || !instance) return null
  const definition = getComponent(instance.componentDefinitionId)

  const setDimension = (key: string, value: number) => {
    if (Number.isNaN(value)) return
    changeDimensions(instance.id, { ...instance.dimensions, [key]: value })
  }

  const bendingStrength = definition.structuralProperties.bendingStrength
  const showStructuralCheck = instance.componentDefinitionId === 'pullup_bar' && bendingStrength !== undefined
  const structuralResult = showStructuralCheck
    ? checkPullupBarBending({
        diameterIn: instance.dimensions.diameter,
        lengthIn: instance.dimensions.length,
        userWeightKg,
        bendingStrength: bendingStrength as number,
      })
    : null

  return (
    <div
      style={{
        position: 'absolute',
        top: 8,
        left: 8,
        marginTop: 140,
        width: 200,
        background: 'rgba(255,255,255,0.96)',
        border: '1px solid #ccc',
        borderRadius: 8,
        padding: 10,
        zIndex: 1,
        fontSize: 13,
      }}
    >
      <div style={{ fontWeight: 'bold', marginBottom: 6 }}>{definition.name}</div>

      <div style={{ fontWeight: 'bold', marginTop: 6 }}>Dimensions</div>
      {Object.entries(instance.dimensions).map(([key, value]) => (
        <label
          key={key}
          style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 4 }}
        >
          <span style={{ textTransform: 'capitalize' }}>{key}</span>
          <input
            type="number"
            value={value}
            onChange={(e) => setDimension(key, e.target.valueAsNumber)}
            style={{ width: 80, minHeight: 32 }}
          />
        </label>
      ))}

      <div style={{ fontWeight: 'bold', marginTop: 8 }}>Position</div>
      <div>
        x: {instance.position[0].toFixed(2)}, y: {instance.position[1].toFixed(2)}, z:{' '}
        {instance.position[2].toFixed(2)}
      </div>

      <div style={{ fontWeight: 'bold', marginTop: 8 }}>Rotation</div>
      <div>yaw: {((instance.rotation[1] * 180) / Math.PI).toFixed(0)}°</div>

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

      {structuralResult && (
        <>
          <div style={{ fontWeight: 'bold', marginTop: 8 }}>Structural Check (estimate)</div>
          <label style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 4 }}>
            <span>User weight (kg)</span>
            <input
              type="number"
              min={1}
              value={userWeightKg}
              onChange={(e) => {
                const value = e.target.valueAsNumber
                if (!Number.isNaN(value)) setUserWeightKg(value)
              }}
              style={{ width: 80, minHeight: 32 }}
            />
          </label>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4 }}>
            <span
              style={{
                width: 10,
                height: 10,
                borderRadius: '50%',
                background: STATUS_COLORS[structuralResult.status],
                display: 'inline-block',
              }}
            />
            <span>
              Safety factor: {Number.isFinite(structuralResult.safetyFactor) ? structuralResult.safetyFactor.toFixed(2) : '∞'}
            </span>
          </div>
          <div style={{ fontSize: 11, color: '#666', marginTop: 4 }}>
            Estimate only — not a certified structural analysis.
          </div>
        </>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Type-check**

Run: `cd wood-cad-workshop && npx tsc -b`
Expected: exits 0, no errors.

- [ ] **Step 3: Run the full test suite**

Run: `cd wood-cad-workshop && npx vitest run`
Expected: exits 0, all tests still passing (this task adds no new automated tests — no React Testing Library in this project's stack, and UI is verified manually here, matching how every other `src/ui/`/`src/scene/` file in this codebase is verified).

- [ ] **Step 4: Manual verification**

Run: `cd wood-cad-workshop && npm run dev`, open the printed local URL.

1. Select any board (not the pull-up bar) — confirm no "Structural Check" section appears in the Inspector.
2. Use the Pull-up Kit button (or place a `pullup_bar` from Inventory) and select the pull-up bar — confirm the "Structural Check (estimate)" section appears with a weight input defaulted to 80.
3. With the default 80kg, confirm the status dot is red and the disclaimer line is visible (expected: `unsafe`, safety factor between 1 and 2 — the shipped bar is undersized for this span at full adult bodyweight, per Task 2's test case).
4. Lower the weight to ~10kg — confirm the status dot turns green (`safe`) and the safety factor increases.
5. Try a mid-range weight (~40kg) — confirm the status dot turns amber (`warning`) somewhere in that range.

- [ ] **Step 5: Commit**

```bash
cd wood-cad-workshop
git add src/ui/Inspector.tsx
git commit -m "feat(wood-cad-workshop): show structural check in Inspector for pull-up bar

Weight input + live safety-factor estimate, gated to the pull-up bar
only, with a fixed 'estimate, not certified' disclaimer.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```
