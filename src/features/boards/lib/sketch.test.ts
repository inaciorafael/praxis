import { describe, expect, it } from 'vitest'
import type { BoardElement } from '@/shared/types/board'
import { arrowHead, sketchPaths, sketchSeed } from './sketch'
import { elementLabelScheme } from './element-style'
import { DEFAULT_SKETCH_OPTIONS } from './sketch-options'

const element = (values: Partial<BoardElement> = {}): BoardElement => ({
  id: 'persisted-id',
  kind: 'rectangle',
  x: 20,
  y: 40,
  width: 180,
  height: 120,
  text: '',
  color: 'neutral',
  resolved: false,
  points: [],
  startId: null,
  endId: null,
  taskId: null,
  imageData: null,
  ...values,
})
const paths = (values: Partial<BoardElement> = {}) =>
  sketchPaths(element(values), '#25354a', 'transparent')

describe('board sketch renderer', () => {
  it('keeps patterned borders stroked for every material and preserves fill and movement', () => {
    for (const strokeStyle of ['clean', 'pencil', 'pen'] as const) {
      for (const strokePattern of ['dashed', 'dotted'] as const) {
        const shape = element({
          strokeStyle,
          fillStyle: 'solid',
          sketch: { ...DEFAULT_SKETCH_OPTIONS, strokePattern },
        })
        const drawing = sketchPaths(shape, '#000000', '#123456')
        const borders = drawing.filter((path) => path.stroke === '#000000')
        expect(borders.length).toBeGreaterThan(0)
        expect(borders.every((path) => path.dash && path.fill === 'none')).toBe(true)
        expect(drawing.some((path) => path.fill === '#123456')).toBe(true)
        expect(sketchPaths({ ...shape, x: 900, y: -300 }, '#000000', '#123456')).toEqual(
          drawing
        )
      }
    }
  })
  it('applies sketch intensity and hatch direction and spacing without mutating geometry', () => {
    const shape = element({
      strokeStyle: 'pencil',
      fillStyle: 'hachure',
      sketch: { ...DEFAULT_SKETCH_OPTIONS },
    })
    const before = structuredClone(shape)
    const original = sketchPaths(shape, '#000000', '#123456')
    for (const patch of [
      { roughness: 0 },
      { bowing: 0 },
      { hachureAngle: 35 },
      { hachureGap: 20 },
    ]) {
      const changed = sketchPaths(
        { ...shape, sketch: { ...DEFAULT_SKETCH_OPTIONS, ...patch } },
        '#000000',
        '#123456'
      )
      expect(changed).not.toEqual(original)
    }
    expect(shape).toEqual(before)
    const sparse = sketchPaths(
      { ...shape, sketch: { ...DEFAULT_SKETCH_OPTIONS, hachureGap: 24 } },
      '#000000',
      '#123456'
    )
    expect(sparse[0]!.d.length).toBeLessThan(original[0]!.d.length)
  })
  it('renders legacy dot fills as hachure without changing stored elements', () => {
    for (const kind of ['rectangle', 'ellipse', 'triangle', 'hexagon'] as const) {
      const legacy = element({ kind, fillStyle: 'dots' })
      const before = structuredClone(legacy)
      expect(sketchPaths(legacy, '#000000', '#123456')).toEqual(
        sketchPaths({ ...legacy, fillStyle: 'hachure' }, '#000000', '#123456')
      )
      expect(legacy).toEqual(before)
    }
  })
  it('renders every selected fill pattern distinctly and preserves solid-fill text contrast', () => {
    const drawings = ['solid', 'hachure', 'cross-hatch', 'zigzag'].map((fillStyle) =>
      sketchPaths(
        element({
          fillStyle: fillStyle as import('@/shared/types/board').BoardFillStyle,
        }),
        '#000000',
        '#123456'
      )
    )
    expect(new Set(drawings.map((drawing) => JSON.stringify(drawing))).size).toBe(4)
    expect(drawings[0]!.some((path) => path.fill === '#123456')).toBe(true)
    for (const drawing of drawings.slice(1))
      expect(
        drawing.some((path) => path.stroke === '#123456' || path.fill === '#123456')
      ).toBe(true)
    expect(
      elementLabelScheme(element({ fillStyle: 'solid', fillColor: '#123456' }), 'light')
    ).toBe('dark')
  })
  it('hatches colored shapes consistently without filling transparent shapes or changing their text contrast', () => {
    for (const kind of ['rectangle', 'ellipse', 'triangle', 'hexagon'] as const) {
      for (const strokeStyle of ['clean', 'pencil', 'pen'] as const) {
        const shape = element({ kind, strokeStyle, fillColor: '#123456' })
        const first = sketchPaths(shape, '#000000', '#123456')
        const hatch = first.filter((path) => path.stroke === '#123456')
        expect(hatch).toHaveLength(1)
        expect(hatch[0]).toMatchObject({ fill: 'none', strokeWidth: 0.85, opacity: 1 })
        expect(hatch[0]!.d).toContain('M')
        expect(sketchPaths({ ...shape, x: 800, y: -300 }, '#000000', '#123456')).toEqual(
          first
        )
        expect(
          sketchPaths(shape, '#000000', 'transparent').some(
            (path) => path.stroke === '#123456'
          )
        ).toBe(false)
        expect(elementLabelScheme(shape, 'light')).toBe('light')
        expect(elementLabelScheme(shape, 'dark')).toBe('dark')
      }
    }
    expect(
      elementLabelScheme(element({ kind: 'note', fillColor: '#123456' }), 'light')
    ).toBe('dark')
  })
  it('uses bounded graphite fibers and solid ink outlines directly in native shapes', () => {
    for (const kind of [
      'rectangle',
      'ellipse',
      'triangle',
      'hexagon',
      'line',
      'arrow',
    ] as const) {
      const pencil = paths({ kind, strokeStyle: 'pencil' })
      expect(pencil).toHaveLength(kind === 'arrow' ? 8 : 4)
      expect(pencil.some((path) => path.dash && path.stroke === '#25354a')).toBe(true)
      expect(pencil.some((path) => path.fill === '#25354a' && path.opacity < 1)).toBe(
        true
      )
      const pen = paths({ kind, strokeStyle: 'pen' })
      expect(
        pen.every(
          (path) =>
            path.stroke === 'none' && path.fill === '#25354a' && path.opacity === 1
        )
      ).toBe(true)
      expect(pen.some((path) => path.d.includes('Q'))).toBe(true)
      expect(paths({ kind, strokeStyle: 'pencil', strokeWidth: 6 })).not.toEqual(pencil)
      expect(paths({ kind, strokeStyle: 'pen', strokeWidth: 6 })).not.toEqual(pen)
    }
  })
  it('draws straight lines without arrowheads or fills in either direction', () => {
    for (const width of [-120, 120]) {
      const line = sketchPaths(
        element({ kind: 'line', width, height: 0 }),
        '#123456',
        '#ff0000'
      )
      expect(line).toHaveLength(1)
      expect(line[0]!.d).toBe(`M0 0 L${width} 0`)
      expect(line[0]!.fill).toBe('none')
    }
  })
  it('closes triangles and hexagons and shares fills across sketch styles', () => {
    expect(paths({ kind: 'triangle' })[0]!.d).toBe('M90 0 L180 120 L0 120 Z')
    expect(paths({ kind: 'hexagon' })[0]!.d).toBe(
      'M45 0 L135 0 L180 60 L135 120 L45 120 L0 60 Z'
    )
    for (const kind of ['triangle', 'hexagon'] as const) {
      for (const strokeStyle of ['clean', 'pen', 'pencil'] as const) {
        const drawing = sketchPaths(element({ kind, strokeStyle }), '#123456', '#ffeedd')
        expect(
          drawing.some(
            (path) =>
              (path.fill === '#ffeedd' || path.stroke === '#ffeedd') && path.opacity === 1
          )
        ).toBe(true)
        expect(
          drawing.some((path) => path.stroke === '#123456' || path.fill === '#123456')
        ).toBe(true)
      }
    }
  })
  it('applies the requested stroke width to clean, pencil and pen outlines and gestures', () => {
    for (const strokeStyle of ['clean', 'pencil', 'pen'] as const) {
      for (const kind of [
        'rectangle',
        'ellipse',
        'triangle',
        'hexagon',
        'line',
        'arrow',
        'draw',
        'frame',
      ] as const) {
        for (const strokeWidth of [0.5, 6, 32]) {
          const drawing = paths({
            strokeStyle,
            kind,
            strokeWidth,
            points: [
              { x: 0, y: 0 },
              { x: 12, y: 8 },
              { x: 24, y: 4 },
            ],
          })
          expect(drawing.length).toBeGreaterThan(0)
          expect(
            drawing
              .filter((path) => path.stroke === '#25354a')
              .every((path) =>
                strokeStyle === 'pencil' && kind !== 'frame'
                  ? path.strokeWidth > 0 && path.strokeWidth <= strokeWidth
                  : path.strokeWidth === strokeWidth
              )
          ).toBe(true)
        }
      }
    }
  })
  it('keeps existing widths when the optional width is absent or null', () => {
    for (const strokeStyle of ['clean', 'pencil', 'pen'] as const) {
      const original = paths({ strokeStyle })
      expect(paths({ strokeStyle, strokeWidth: undefined })).toEqual(original)
      expect(paths({ strokeStyle, strokeWidth: null as unknown as number })).toEqual(
        original
      )
      expect(
        paths({ strokeStyle, strokeWidth: strokeStyle === 'pencil' ? 1.5 : 2 })
      ).toEqual(original)
    }
  })
  it('keeps random seeds positive and deterministic', () => {
    expect(sketchSeed('persisted-id')).toBe(sketchSeed('persisted-id'))
    expect(sketchSeed('persisted-id')).not.toBe(sketchSeed('other-id'))
    expect(sketchSeed('')).toBeGreaterThan(0)
  })
  it('keeps the same sketch after movement and repeated generation', () => {
    const first = paths({ strokeStyle: 'pencil' })
    expect(paths({ strokeStyle: 'pencil' })).toEqual(first)
    expect(paths({ strokeStyle: 'pencil', x: -500, y: 700 })).toEqual(first)
    expect(paths({ strokeStyle: 'pencil', id: 'other' })).not.toEqual(first)
  })
  it('renders legacy shapes cleanly and pencil and pen distinctly', () => {
    expect(paths()[0]!.d).toBe('M0 0 H180 V120 H0 Z')
    expect(paths({ strokeStyle: 'pencil' })[0]!.opacity).toBeLessThan(1)
    expect(paths({ strokeStyle: 'pen' })[0]!.opacity).toBe(1)
    expect(paths({ strokeStyle: 'pen' })).not.toEqual(paths({ strokeStyle: 'pencil' }))
  })
  it('gives pencil rectangles imperfect doubled corners without changing logical bounds', () => {
    const shape = element({ strokeStyle: 'pencil' })
    const before = structuredClone(shape)
    const drawing = sketchPaths(shape, '#25354a', 'transparent')
    const outline = drawing.find((path) => path.stroke !== 'none')!.d
    const moves = [...outline.matchAll(/M\s*(-?[\d.]+)[ ,]+(-?[\d.]+)/g)]
    expect(moves).toHaveLength(8)
    expect(
      moves.some((match) => {
        const x = Number(match[1]),
          y = Number(match[2])
        return ![0, shape.width].includes(x) || ![0, shape.height].includes(y)
      })
    ).toBe(true)
    // Organic marks remain close to the real rectangle, rather than wandering
    // far enough to undermine precise selection and connection geometry.
    const coordinates = [...outline.matchAll(/-?\d+(?:\.\d+)?/g)].map((match) =>
      Number(match[0])
    )
    coordinates.forEach((coordinate, index) => {
      expect(coordinate).toBeGreaterThanOrEqual(-12)
      expect(coordinate).toBeLessThanOrEqual(
        (index % 2 ? shape.height : shape.width) + 12
      )
    })
    expect(shape).toEqual(before)
    expect(sketchPaths({ ...shape, x: -300, y: 900 }, '#25354a', 'transparent')).toEqual(
      drawing
    )
  })
  it('uses actual connector endpoints in local coordinates', () => {
    const arrow = element({ kind: 'arrow' })
    const drawing = sketchPaths(arrow, '#000', 'transparent', [
      { x: 200, y: 80 },
      { x: 450, y: 80 },
    ])
    expect(drawing[0]!.d).toBe('M180 40 L430 40')
    expect(drawing[1]!.d).toContain('L430 40')
  })
  it('keeps short arrowheads bounded and facing backward from the tip', () => {
    const head = arrowHead({ x: 0, y: 0 }, { x: 10, y: 0 })
    expect(head[1]).toEqual({ x: 10, y: 0 })
    for (const wing of [head[0]!, head[2]!]) {
      expect(wing.x).toBeGreaterThan(0)
      expect(wing.x).toBeLessThan(10)
      expect(Math.abs(wing.y)).toBeLessThan(3)
    }
    expect(arrowHead({ x: 1, y: 1 }, { x: 1, y: 1 })).toEqual([])
  })
  it('does not outline text or images and keeps frames dashed', () => {
    expect(paths({ kind: 'text', strokeStyle: 'pencil' })).toEqual([])
    expect(paths({ kind: 'image' })).toEqual([])
    expect(paths({ kind: 'frame', strokeStyle: 'pen' })[0]!.dash).toBe('8 6')
  })
  it('renders opt-in text containers using the same deterministic sketch geometry', () => {
    expect(
      paths({ kind: 'text', textBackground: 'rectangle', strokeStyle: 'pencil' })
    ).toEqual(paths({ kind: 'rectangle', strokeStyle: 'pencil' }))
    expect(
      paths({ kind: 'text', textBackground: 'ellipse', strokeStyle: 'pen' })
    ).toEqual(paths({ kind: 'ellipse', strokeStyle: 'pen' }))
    expect(paths({ kind: 'text', textBackground: 'none' })).toEqual([])
  })
  it('preserves freehand samples and supports single taps', () => {
    expect(
      paths({
        kind: 'draw',
        points: [
          { x: 2, y: 3 },
          { x: 9, y: 12 },
        ],
      })[0]!.d
    ).toBe('M2 3 L9 12')
    expect(paths({ kind: 'draw', points: [] })).toEqual([])
    expect(
      paths({ kind: 'draw', strokeStyle: 'pencil', points: [{ x: 2, y: 3 }] })
    ).toHaveLength(1)
  })
  it('keeps solid card fills opaque with a pencil outline', () => {
    const drawing = sketchPaths(
      element({ kind: 'note', strokeStyle: 'pencil' }),
      '#000',
      '#fff7c2'
    )
    expect(drawing.some((path) => path.fill === '#fff7c2' && path.opacity === 1)).toBe(
      true
    )
  })
  it('renders smooth pen curves and lighter graphite fibers for the pencil', () => {
    const points = [
      { x: 0, y: 0 },
      { x: 12, y: 8 },
      { x: 24, y: 4 },
      { x: 36, y: 16 },
    ]
    const pen = paths({ kind: 'draw', strokeStyle: 'pen', points })
    const pencil = paths({ kind: 'draw', strokeStyle: 'pencil', points })
    expect(pen[0]!.d).toContain('C')
    expect(pen[0]!.d.match(/M/g)).toHaveLength(1)
    expect(pencil).toHaveLength(4)
    expect(pencil[0]!.d).toContain('Q')
    expect(pencil.some((path) => path.dash)).toBe(true)
    expect(pen).not.toEqual(pencil)
    expect(pen[0]!.opacity).toBe(1)
    expect(paths({ kind: 'draw', strokeStyle: 'clean', points })[0]!.d).toBe(
      'M0 0 L12 8 L24 4 L36 16'
    )
  })
  it('keeps pen curves seeded, local to the element and leaves original samples unchanged', () => {
    const points = [
      { x: 2, y: 3 },
      { x: 18, y: 22 },
      { x: 32, y: 8 },
    ]
    const original = points.map((point) => ({ ...point }))
    const first = paths({ kind: 'draw', strokeStyle: 'pen', points })
    expect(paths({ kind: 'draw', strokeStyle: 'pen', points })).toEqual(first)
    expect(paths({ kind: 'draw', strokeStyle: 'pen', points, x: -500, y: 700 })).toEqual(
      first
    )
    expect(
      paths({ kind: 'draw', strokeStyle: 'pen', points, id: 'another-pen' })
    ).not.toEqual(first)
    expect(points).toEqual(original)
  })
  it('supports empty, single-point and two-point pen gestures without invalid curve output', () => {
    expect(paths({ kind: 'draw', strokeStyle: 'pen', points: [] })).toEqual([])
    for (const points of [
      [{ x: 2, y: 3 }],
      [
        { x: 2, y: 3 },
        { x: 9, y: 12 },
      ],
    ]) {
      const drawing = paths({ kind: 'draw', strokeStyle: 'pen', points })
      expect(drawing).toHaveLength(1)
      expect(drawing[0]!.d).not.toMatch(/NaN|undefined|Infinity/)
      expect(drawing[0]!.d.match(/M/g)).toHaveLength(1)
      expect(drawing[0]!.d.match(/C/g)).toHaveLength(1)
    }
  })
})
