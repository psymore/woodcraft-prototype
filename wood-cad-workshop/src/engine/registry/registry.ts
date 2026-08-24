import type { ComponentDefinition } from '../core/types'

// Mirrors world-of-cards' packages/engine/src/registry/registry.ts —
// additive extensibility: a new component is one self-registering file,
// never an edit to this module.
const registry = new Map<string, ComponentDefinition>()

export function registerComponent(definition: ComponentDefinition): void {
  if (registry.has(definition.id)) {
    throw new Error(`registerComponent: a component with id "${definition.id}" is already registered`)
  }
  registry.set(definition.id, definition)
}

export function getComponents(): ComponentDefinition[] {
  return Array.from(registry.values())
}

export function getComponent(id: string): ComponentDefinition {
  const found = registry.get(id)
  if (!found) throw new Error(`getComponent: unknown component id "${id}"`)
  return found
}

export function clearRegistry(): void {
  registry.clear()
}
