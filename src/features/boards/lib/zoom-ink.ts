import type { SketchPath } from './sketch'
const MIN_SCREEN_WIDTH = 0.85
/** Display-only ink: never regenerate geometry or change document thickness. */
export function zoomInkPaths(
  paths: SketchPath[],
  zoom: number,
  nominalWidth: number
): SketchPath[] {
  if (!Number.isFinite(zoom) || zoom <= 0 || zoom >= 1) return []
  const ink = paths.filter((path) => path.ink)
  const bodies = ink.filter(
    (path) =>
      path.stroke === 'none' && path.fill !== 'none' && path.fill !== 'transparent'
  )
  return (bodies.length ? bodies : ink)
    .filter(
      (path) =>
        (path.stroke === 'none' ? nominalWidth : path.strokeWidth) * zoom <
        MIN_SCREEN_WIDTH
    )
    .map((path) => ({
      ...path,
      fill: 'none',
      stroke: path.stroke === 'none' ? path.fill : path.stroke,
      strokeWidth: MIN_SCREEN_WIDTH / zoom,
      opacity: Math.max(0.55, path.opacity),
    }))
}
