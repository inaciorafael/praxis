import { expect, it } from 'vitest'
import { zoomInkPaths } from './zoom-ink'
import type { SketchPath } from './sketch'
const line: SketchPath = {
  d: 'M0 0 L100 0',
  stroke: '#202124',
  fill: 'none',
  strokeWidth: 0.5,
  opacity: 1,
  ink: true,
}
it('keeps subpixel ink legible at 5%, 10% and 25% without changing source paths', () => {
  for (const zoom of [0.05, 0.1, 0.25]) {
    const overlay = zoomInkPaths([line], zoom, 0.5)[0]!
    expect(overlay.strokeWidth * zoom).toBeCloseTo(0.85)
    expect(overlay.d).toBe(line.d)
  }
  expect(line.strokeWidth).toBe(0.5)
  expect(zoomInkPaths([line], 1, 0.5)).toEqual([])
  expect(zoomInkPaths([line], 2, 0.5)).toEqual([])
})
it('supports filled fountain/ink silhouettes without thickening fills or hatch patterns', () => {
  const body = { ...line, stroke: 'none', fill: '#202124', strokeWidth: 0, opacity: 0.23 }
  const hatch = { ...line, ink: false, stroke: '#ff0000' }
  const paths = zoomInkPaths([body, line, hatch], 0.1, 1.5)
  expect(paths).toHaveLength(1)
  expect(paths[0]).toMatchObject({ stroke: '#202124', fill: 'none', opacity: 0.55 })
  expect(zoomInkPaths([hatch], 0.1, 1.5)).toEqual([])
  expect(zoomInkPaths([line], 0, 1)).toEqual([])
})
