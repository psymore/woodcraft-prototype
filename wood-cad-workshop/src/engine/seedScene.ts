import type { ComponentInstance } from './core/types'

// The two starter boards, carried over from the Foundation sub-project's
// regression check.
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
