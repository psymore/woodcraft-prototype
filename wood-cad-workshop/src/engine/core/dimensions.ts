import type { ComponentDefinition, ComponentInstance } from './types'

export function getBoxSize(instance: ComponentInstance): [number, number, number] {
  const { thickness, width, length } = instance.dimensions
  return [thickness, width, length]
}

export function getCylinderSize(instance: ComponentInstance): { radius: number; height: number } {
  const { diameter, length } = instance.dimensions
  return { radius: diameter / 2, height: length }
}

// Half-height for a component resting on the ground grid (y=0), so its
// bottom face sits at y=0 regardless of geometry shape.
export function getRestingHeight(definition: ComponentDefinition): number {
  const { width, diameter } = definition.defaultDimensions
  return definition.geometry.shape === 'cylinder' ? diameter / 2 : width / 2
}
