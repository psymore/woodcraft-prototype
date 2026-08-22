---
vscode: true
vscode-copilot: true
author: "GitHub Copilot (VS Code)"
vscode-note: "This plan was authored in VS Code by GitHub Copilot."
status: "proposed - planning record only"
---

# Godot vs Three.js Engine Selection

This is a planning record for comparing the Godot and Three.js/R3F touch spikes. It does not authorize work beyond the currently approved Prototype 0 stage.

## Decision question

Which target engine better supports the product's validated mobile interaction: native mobile delivery and sustained 3D performance in Godot, or web distribution and shareable browser access in Three.js/R3F?

## Comparison protocol

1. Preserve the same two-board touch-spike behavior and acceptance criteria in both engines.
2. Test on a physical Android device, not only a desktop browser or emulator.
3. Compare selection, plane-constrained drag, grid snapping, camera behavior, touch arbitration, rendering smoothness, battery/thermal behavior, startup friction, and deployment workflow.
4. Record qualitative interaction findings and measurable setup/performance observations separately.
5. Do not choose a winner from framework preference or implementation convenience alone.
6. Record the result in a canonical decision/specification document before beginning the next product stage.

## Deliverables

- one comparable build for each engine;
- a shared manual test checklist;
- captured blockers and setup friction;
- a comparison record with evidence and tradeoffs;
- an explicit approved engine decision or a documented reason to continue both.

## Guardrails

Keep the current spike plans authoritative for their existing implementation details. Do not expand either spike into the full workshop until the platform decision and product scope are explicitly approved.
