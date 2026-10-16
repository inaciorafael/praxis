import { describe, expect, it } from 'vitest'
import type { BoardElement } from '@/shared/types/board'
import {
  bounds,
  connectorPoints,
  exportSize,
  normalizedStroke,
  worldPoint,
  zoomAt,
  elementCorners,
  pointInElement,
  resizeElement,
  rotatePoint,
  normalizeAngle,
} from './geometry'

const element = (values: Partial<BoardElement>): BoardElement => ({
  id: 'a',
  kind: 'rectangle',
  x: 0,
  y: 0,
  width: 100,
  height: 50,
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
describe('board geometry', () => {
  it('hit tests polygon edges instead of their surrounding rectangles, including rotation', () => {
    for (const kind of ['triangle', 'hexagon'] as const) {
      const shape = element({ kind, width: 100, height: 100, angle: Math.PI / 3 })
      const center = { x: 50, y: 50 }
      expect(pointInElement(shape, center)).toBe(true)
      expect(
        pointInElement(shape, rotatePoint({ x: 2, y: 2 }, center, shape.angle!))
      ).toBe(false)
      expect(
        pointInElement(shape, rotatePoint({ x: 50, y: 0 }, center, shape.angle!))
      ).toBe(true)
    }
  })
  it('anchors connectors to triangle and hexagon outlines', () => {
    const target = element({ id: 'target', x: 300, y: 25, height: 50 })
    for (const [kind, expectedX] of [
      ['triangle', 75],
      ['hexagon', 100],
    ] as const) {
      const source = element({ kind, width: 100, height: 100 })
      const arrow = element({ kind: 'arrow', startId: source.id, endId: target.id })
      expect(connectorPoints(arrow, [source, target])[0]).toEqual({ x: expectedX, y: 50 })
    }
  })
  it('bounds rotated reverse lines using the two visible endpoints', () => {
    const line = element({
      kind: 'line',
      x: 100,
      y: 100,
      width: -100,
      height: -100,
      angle: Math.PI / 4,
    })
    const box = bounds([line])
    expect(box.x).toBeCloseTo(50)
    expect(box.width).toBe(1)
    expect(box.y).toBeCloseTo(50 - Math.sqrt(5000))
    expect(box.height).toBeCloseTo(Math.sqrt(20000))
  })
  it('normalizes rotations and bounds oriented corners', () => {
    expect(normalizeAngle(3 * Math.PI)).toBeCloseTo(-Math.PI)
    expect(normalizeAngle(Infinity)).toBe(0)
    const shape = element({ angle: Math.PI / 2 })
    const box = bounds([shape])
    expect(box.x).toBeCloseTo(25)
    expect(box.y).toBeCloseTo(-25)
    expect(box.width).toBeCloseTo(50)
    expect(box.height).toBeCloseTo(100)
    expect(pointInElement(shape, { x: 50, y: 65 })).toBe(true)
    expect(pointInElement(shape, { x: 5, y: 25 })).toBe(false)
  })
  it('preserves the opposite rotated corner with proportional resizing from all handles', () => {
    const shape = element({ angle: Math.PI / 5, x: 20, y: -40 })
    const center = { x: 70, y: -15 }
    const corners = elementCorners(shape)
    const cases = [
      { handle: 'nw', opposite: 2, sx: -1, sy: -1 },
      { handle: 'ne', opposite: 3, sx: 1, sy: -1 },
      { handle: 'sw', opposite: 1, sx: -1, sy: 1 },
      { handle: 'se', opposite: 0, sx: 1, sy: 1 },
    ] as const
    for (const { handle, opposite, sx, sy } of cases) {
      const pointer = rotatePoint(
        { x: center.x + sx * 150, y: center.y + sy * 40 },
        center,
        shape.angle!
      )
      const resized = resizeElement(shape, pointer, {
        handle,
        proportional: true,
        fromCenter: false,
      })
      expect(resized.width / resized.height).toBeCloseTo(2)
      const anchor = elementCorners({ ...shape, ...resized })[opposite]!
      expect(anchor.x).toBeCloseTo(corners[opposite]!.x)
      expect(anchor.y).toBeCloseTo(corners[opposite]!.y)
    }
  })
  it('keeps the original center fixed and enforces minimum dimensions', () => {
    const shape = element({ angle: -Math.PI / 3 })
    const center = { x: 50, y: 25 }
    const pointer = rotatePoint({ x: 180, y: 100 }, center, shape.angle!)
    const resized = resizeElement(shape, pointer, {
      handle: 'se',
      proportional: false,
      fromCenter: true,
    })
    expect(resized.x + resized.width / 2).toBeCloseTo(center.x)
    expect(resized.y + resized.height / 2).toBeCloseTo(center.y)
    expect(resized.width).toBeCloseTo(260)
    expect(resized.height).toBeCloseTo(150)
    const minimum = resizeElement(shape, center, {
      handle: 'nw',
      proportional: true,
      fromCenter: true,
    })
    expect(minimum.width).toBeGreaterThanOrEqual(24)
    expect(minimum.height).toBeGreaterThanOrEqual(24)
    expect(minimum.width / minimum.height).toBeCloseTo(2)
  })
  it('intersects connectors with rotated rectangle and text ellipse boundaries', () => {
    for (const textBackground of ['rectangle', 'ellipse'] as const) {
      const source = element({
        kind: 'text',
        textBackground,
        angle: Math.PI / 4,
        width: 200,
        height: 80,
      })
      const target = element({ id: 'target', x: 400, y: 20 })
      const arrow = element({ kind: 'arrow', startId: source.id, endId: target.id })
      const endpoint = connectorPoints(arrow, [source, target])[0]
      const local = rotatePoint(endpoint, { x: 100, y: 40 }, -source.angle!)
      const dx = (local.x - 100) / 100,
        dy = (local.y - 40) / 40
      if (textBackground === 'ellipse') expect(dx ** 2 + dy ** 2).toBeCloseTo(1)
      else expect(Math.max(Math.abs(dx), Math.abs(dy))).toBeCloseTo(1)
    }
  })
  it('keeps cursor world coordinates stable when zooming at all zoom limits', () => {
    const camera = { x: 45, y: -80, zoom: 1.3 }
    const cursor = { x: 350, y: 150 }
    for (const zoom of [0.0001, 0.4, 200]) {
      const next = zoomAt(camera, cursor, zoom)
      expect(worldPoint(cursor, next).x).toBeCloseTo(worldPoint(cursor, camera).x)
      expect(worldPoint(cursor, next).y).toBeCloseTo(worldPoint(cursor, camera).y)
      expect(next.zoom).toBeGreaterThanOrEqual(0.1)
      expect(next.zoom).toBeLessThanOrEqual(4)
    }
  })
  it('bounds reverse connectors and negative coordinates', () => {
    expect(
      bounds([
        element({ x: -100, y: -50 }),
        element({ x: 300, y: 200, width: -400, height: -250 }),
      ])
    ).toEqual({ x: -100, y: -50, width: 400, height: 250 })
  })
  it('anchors connector endpoints to live edges and preserves detached fallback', () => {
    const arrow = element({
      kind: 'arrow',
      startId: 'a',
      endId: 'missing',
      x: 400,
      y: 200,
    })
    const [start, end] = connectorPoints(arrow, [element({ x: 30, y: 60 })])
    expect(start.x).toBe(130)
    expect(start.y).toBeCloseTo(85 + (165 * 50) / 420)
    expect(end).toEqual({ x: 500, y: 250 })
  })
  it('keeps arrowheads visible on rectangular and elliptical boundaries', () => {
    const start = element({ id: 'start', height: 100 })
    const end = element({ id: 'end', x: 300, kind: 'ellipse', height: 100 })
    const arrow = element({ kind: 'arrow', startId: 'start', endId: 'end' })
    expect(connectorPoints(arrow, [start, end])).toEqual([
      { x: 100, y: 50 },
      { x: 300, y: 50 },
    ])
    const diagonal = connectorPoints({ ...arrow, startId: null, x: 100, y: -100 }, [
      end,
    ])[1]
    expect(((diagonal.x - 350) / 50) ** 2 + ((diagonal.y - 50) / 50) ** 2).toBeCloseTo(1)
  })
  it('uses actual arrow geometry after linked nodes have moved', () => {
    const start = element({ id: 'start', x: 800, height: 100 })
    const end = element({ id: 'end', x: 1200, height: 100 })
    const arrow = element({
      kind: 'arrow',
      x: 0,
      y: 0,
      width: -100,
      height: 0,
      startId: 'start',
      endId: 'end',
    })
    expect(bounds([arrow], [start, end])).toEqual({
      x: 900,
      y: 50,
      width: 300,
      height: 1,
    })
  })
  it('anchors connectors on the ellipse boundary of a text background', () => {
    const source = element({
      kind: 'text',
      textBackground: 'ellipse',
      width: 200,
      height: 100,
    })
    const target = element({ id: 'target', x: 300, y: 150, width: 200, height: 100 })
    const arrow = element({ kind: 'arrow', startId: source.id, endId: target.id })
    const [start] = connectorPoints(arrow, [source, target])
    expect(((start.x - 100) / 100) ** 2 + ((start.y - 50) / 50) ** 2).toBeCloseTo(1)
  })
  it('normalizes strokes, caps samples and safely handles empty input', () => {
    const stroke = normalizedStroke(
      Array.from({ length: 3000 }, (_, i) => ({ x: i - 100, y: i + 20 }))
    )
    expect(stroke.points).toHaveLength(2000)
    expect(stroke.points[0]).toEqual({ x: 0, y: 0 })
    expect(stroke.x).toBe(-100)
    expect(normalizedStroke([]).points).toEqual([])
  })
  it('limits export dimensions and total pixels without upscaling', () => {
    for (const [width, height] of [
      [1000000, 1000000],
      [500000, 50],
      [50, 500000],
      [640, 480],
    ]) {
      const size = exportSize(width!, height!)
      expect(size.width).toBeLessThanOrEqual(8192)
      expect(size.height).toBeLessThanOrEqual(8192)
      expect(size.width * size.height).toBeLessThanOrEqual(64000000)
    }
    expect(exportSize(640, 480)).toEqual({ width: 640, height: 480 })
  })
})
