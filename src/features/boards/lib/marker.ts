import { RoughGenerator } from 'roughjs/bin/generator'
import type { BoardTextHighlight } from '@/shared/types/board'
import { sketchSeed, type SketchPath } from './sketch'

const generator = new RoughGenerator()
const colors = { yellow: '#fde875', green: '#b9edaa', pink: '#ffc4d8', blue: '#bce2ff' }
const shapes = new Map<string, SketchPath[]>()

/** Share the same rough brush geometry between editable HTML and exported SVG. */
function brush(
  highlight: Exclude<BoardTextHighlight, 'none'>,
  seed: string
): SketchPath[] {
  const key = `${seed}:${highlight}`
  let paths = shapes.get(key)
  if (!paths) {
    const drawable = generator.polygon(
      [
        [1, 4],
        [23, 2],
        [49, 4],
        [76, 1],
        [99, 3],
        [98, 22],
        [73, 20],
        [44, 23],
        [20, 21],
        [0, 22],
      ],
      {
        seed: sketchSeed(seed),
        fill: colors[highlight],
        fillStyle: 'solid',
        stroke: 'none',
        roughness: 1.4,
        bowing: 0.9,
        fixedDecimalPlaceDigits: 3,
      }
    )
    paths = generator
      .toPaths(drawable)
      .map((path) => ({ ...path, fill: path.fill ?? 'none', opacity: 0.75 }))
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
    .map((path) => `<path d="${path.d}" fill="${path.fill}" opacity="${path.opacity}"/>`)
    .join('')
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 24" preserveAspectRatio="none">${paths}</svg>`
  return `url("data:image/svg+xml,${encodeURIComponent(svg)}")`
}
