import type { BoardSketchOptions } from '@/shared/types/board'

export const DEFAULT_SKETCH_OPTIONS: Readonly<BoardSketchOptions> = {
  strokePattern: 'solid',
  roughness: 1,
  bowing: 1,
  hachureAngle: -41,
  hachureGap: 5,
}
