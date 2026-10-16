import { describe, expect, it } from 'vitest'
import { markerBackground, markerPaths } from './marker'
import { defaultAnnotation, notationPaths } from './notation'

describe('shared rough text marker', () => {
  it('renders saved highlight colors through Rough Notation instead of the old polygon brush', () => {
    const paths = markerPaths('yellow', 0, 0, 100, 24, 'legacy')
    const notation = notationPaths({
      config: { ...defaultAnnotation('highlight'), color: '#fde875', padding: 0 },
      rects: [{ x: 2, y: 3, width: 96, height: 18 }],
      seed: 'legacy',
    })
    expect(paths.map(({ transform: _transform, fill: _fill, ...path }) => path)).toEqual(
      notation
    )
    expect(paths.every((path) => path.fill === 'none' && path.strokeWidth > 0)).toBe(true)
  })
  it('uses the same brush paths in editable HTML and exported SVG', () => {
    const background = markerBackground('yellow', 'element')
    const source = decodeURIComponent(background.slice(background.indexOf(',') + 1, -2))
    const paths = markerPaths('yellow', 12, 20, 300, 24, 'element')
    expect(source).toContain('<path')
    expect(source).not.toContain('<rect')
    for (const path of paths) expect(source).toContain(`d="${path.d}"`)
    expect(paths[0]?.transform).toBe('translate(12 20) scale(3 1)')
  })
  it('keeps a stable brush when resized and removes unmarked backgrounds', () => {
    expect(markerPaths('pink', 0, 0, 100, 24, 'element')[0]?.d).toBe(
      markerPaths('pink', 40, 30, 200, 48, 'element')[0]?.d
    )
    expect(markerBackground('none')).toBe('none')
    expect(markerPaths('none', 0, 0, 100, 24)).toEqual([])
    expect(markerPaths('yellow', 0, 0, 100, 24, 'first')[0]?.d).not.toBe(
      markerPaths('yellow', 0, 0, 100, 24, 'second')[0]?.d
    )
  })
})
