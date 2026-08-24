export type ViewName = '3d' | 'front' | 'back' | 'left' | 'right' | 'top' | 'bottom'

export interface ViewPreset {
  position: [number, number, number]
  up: [number, number, number]
}

const DISTANCE = 32

const VIEW_PRESETS: Record<ViewName, ViewPreset> = {
  '3d': { position: [0, 20, 25], up: [0, 1, 0] },
  front: { position: [0, 0, DISTANCE], up: [0, 1, 0] },
  back: { position: [0, 0, -DISTANCE], up: [0, 1, 0] },
  left: { position: [-DISTANCE, 0, 0], up: [0, 1, 0] },
  right: { position: [DISTANCE, 0, 0], up: [0, 1, 0] },
  top: { position: [0, DISTANCE, 0], up: [0, 0, -1] },
  bottom: { position: [0, -DISTANCE, 0], up: [0, 0, 1] },
}

export const VIEW_NAMES: ViewName[] = ['3d', 'front', 'back', 'left', 'right', 'top', 'bottom']

export function getViewPreset(view: ViewName): ViewPreset {
  return VIEW_PRESETS[view]
}
