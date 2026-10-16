import type { BoardTextHighlight } from '@/shared/types/board'
import type { SketchPath } from './sketch'
import { defaultAnnotation, notationPaths } from './notation'

const colors = { yellow: '#fde875', green: '#b9edaa', pink: '#ffc4d8', blue: '#bce2ff' }
const shapes = new Map<string, SketchPath[]>()

/** Saved legacy colors use the same Rough Notation renderer as new annotations. */
function brush(
  highlight: Exclude<BoardTextHighlight, 'none'>,
  seed: string
): SketchPath[] {
  const key = `${seed}:${highlight}`
  let paths = shapes.get(key)
  if (!paths) {
    paths = notationPaths({
      config: { ...defaultAnnotation('highlight'), color: colors[highlight], padding: 0 },
      rects: [{ x: 2, y: 3, width: 96, height: 18 }],
      seed,
    }).map((path) => ({ ...path, fill: 'none' }))
    if (shapes.size >= 128) shapes.delete(shapes.keys().next().value!)
    shapes.set(key, paths)
  }
  return paths
}

export function markerPaths(
  highlight: BoardTextHighlight,
  x: number,
  y: number,
  width: number,
  height: number,
  seed = 'board-marker'
): SketchPath[] {
  if (highlight === 'none' || width <= 0 || height <= 0) return []
  return brush(highlight, seed).map((path) => ({
    ...path,
    transform: `translate(${x} ${y}) scale(${width / 100} ${height / 24})`,
  }))
}

export function markerBackground(
  highlight: BoardTextHighlight,
  seed = 'board-marker'
): string {
  if (highlight === 'none') return 'none'
  const paths = brush(highlight, seed)
    .map(
      (path) =>
        `<path d="${path.d}" fill="none" stroke="${path.stroke}" stroke-width="${path.strokeWidth}" opacity="${path.opacity}"/>`
    )
    .join('')
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 24" preserveAspectRatio="none">${paths}</svg>`
  return `url("data:image/svg+xml,${encodeURIComponent(svg)}")`
}
