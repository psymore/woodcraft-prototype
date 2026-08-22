---
vscode: true
vscode-copilot: true
author: "GitHub Copilot (VS Code)"
vscode-note: "Recovered from a VS Code Copilot session plan and canonicalized in the repository."
status: "proposed - not approved for implementation"
---

# Dual-Engine Workshop Parity

> This plan was authored in VS Code by GitHub Copilot. The `-vscode` marker identifies the authoring environment; it does not override the canonical product specification or approved scope.

## Purpose

Explore a future parity implementation of the woodworking workshop in Godot and Three.js/R3F. Keep construction data, calculations, snapping, assembly, and explode definitions engine-neutral in concept while keeping rendering and input native to each engine.

## Authority boundary

This is a proposed future plan. The repository currently approves Prototype 0 only. Before implementation:

- update the canonical product design/specification;
- record an explicit platform-scope decision;
- create or update the feature specification and parity contract;
- obtain approval for the new stage.

The existing touch-spike plans remain historical/current spike plans and must not be silently rewritten by this plan.

## Proposed phases

### Phase 0: Authority and parity contract

- Define the re-scope from touch spikes to a parity experiment in the canonical specification.
- Specify common coordinates, metric display units, component definitions and instances, inventory categories, connections, fasteners, explode vectors, BOM values, and structural-estimate labeling.
- Define shared fixture data for IDs, dimensions, transforms, connections, screw counts, explode vectors, BOM output, and sample structural values.
- Create a staged parent plan and child plans with Godot and Three.js acceptance criteria.

### Phase 1: Common model, coordinates, and camera

- Normalize coordinate and dimension conventions while preserving existing grid and drag behavior.
- Add native model modules separate from scene/node/mesh creation.
- Add orbit, pan, zoom, focus, and preset views with equivalent semantics in both engines.
- Preserve selection, empty-space deselection, and plane-constrained movement.

### Phase 2: Inventory and creation

- Add data-driven WOOD, HARDWARE, and FASTENERS inventory items.
- Create component instances with deterministic IDs and fixture defaults.
- Render rods, beams, boards, brackets, and screws using each engine's native procedural geometry.
- Validate desktop and physical mobile workflows.

### Phase 3: Inspector and manipulation

- Add selection and inspector views for dimensions, materials, transforms, and connections.
- Support validated metric dimension editing without replacing instance identity.
- Add move, snapped rotate, duplicate, and delete with gesture arbitration.
- Add focused tests for validation, identity, rotation, duplication, deletion, and selection synchronization.

### Phase 4: Assembly, connections, and snapping

- Define a pull-up-station fixture with posts, feet, bar, brackets, screws, component IDs, and connection records.
- Implement compatible connection points, proximity highlighting, release snapping, and connection indications.
- Compare fixture inventory, anchor compatibility, connections, and BOM output across engines.

### Phase 5: Exploded view

- Store per-component explode directions and a model explode factor from 0 to 1.
- Interpolate assembled to exploded transforms from the fixture data.
- Add an EXPLODE control and slider without changing assembly connections.
- Verify selection and reversibility at 0%, 50%, and 100% on desktop and mobile.

### Phase 6: Materials, BOM, and preliminary structural estimate

- Add a small data-driven wood-species catalog with approximate values clearly labeled as non-certified.
- Derive a parts list from definitions and instances.
- Document and test load conversion, safety factor, bending estimate, and OK/REVIEW/FAIL thresholds.
- Present results as a PRELIMINARY / ESTIMATE structural check.

### Phase 7: Persistence and mobile polish

- Add versioned local JSON save/load and autosave using the model schema.
- Add gesture-level undo/redo for model mutations.
- Refine responsive inventory, inspector, bottom-sheet, and touch interactions.
- Test both implementations on a physical Android device.

### Phase 8: Comparison closeout

- Run automated tests, type/lint/build checks, headless checks, and fixture comparisons.
- Perform manual acceptance for inventory, manipulation, assembly, explode view, structural estimate, persistence, and mobile gestures.
- Record limitations and the comparison decision. Do not delete either spike or select a winner without explicit approval.

## Non-goals

No professional FEA, full constraint solver, realistic joinery, cloud collaboration, authentication, manufacturing optimization, or engine deletion is authorized by this plan.

## Verification

The plan is ready for implementation only after the authority boundary is satisfied. Each phase must pass the same fixture and interaction criteria in both engines, with the existing Prototype 0 scope and tests preserved until explicitly superseded.
