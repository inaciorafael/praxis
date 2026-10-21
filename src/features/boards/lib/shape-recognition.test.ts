import { describe, expect, it } from 'vitest'
import { recognizeShape } from './shape-recognition'
import type { BoardPoint } from '@/shared/types/board'

function trace(vertices: BoardPoint[], steps = 20) {
  return vertices
    .slice(1)
    .flatMap((b, i) =>
      Array.from({ length: steps }, (_, j) => {
        const a = vertices[i]!,
          t = j / steps
        return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t }
      })
    )
    .concat(vertices[vertices.length - 1]!)
}
const rectangle = trace([
  { x: 0, y: 0 },
  { x: 180, y: 0 },
  { x: 180, y: 100 },
  { x: 0, y: 100 },
  { x: 0, y: 0 },
])
describe('hold shape recognition', () => {
  it('recognizes an imperfect line with signed dimensions', () => {
    const points = Array.from({ length: 60 }, (_, i) => ({
      x: 200 - i * 3,
      y: 100 - i + Math.sin(i) * 0.7,
    }))
    const result = recognizeShape(points)
    expect(result?.kind).toBe('line')
    expect(result!.width).toBeLessThan(0)
  })
  it('recognizes a rectangle starting midway along an edge', () => {
    const points = [...rectangle.slice(10, -1), ...rectangle.slice(0, 11)]
    const result = recognizeShape(points)
    expect(result?.kind).toBe('rectangle')
    expect(result!.width * result!.height).toBeCloseTo(18000, -2)
  })
  it('recognizes rotated rectangles', () => {
    const points = rectangle.map((p) => ({
      x: p.x * Math.cos(0.4) - p.y * Math.sin(0.4),
      y: p.x * Math.sin(0.4) + p.y * Math.cos(0.4),
    }))
    expect(recognizeShape(points)?.kind).toBe('rectangle')
  })
  it.each([1, 1.8])('recognizes a hand-drawn ellipse with ratio %s', (ratio) => {
    const points = Array.from({ length: 100 }, (_, i) => {
      const t = (i / 99) * Math.PI * 2,
        r = 1 + Math.sin(i * 1.3) * 0.02
      return { x: 200 + 80 * ratio * Math.cos(t) * r, y: 200 + 80 * Math.sin(t) * r }
    })
    expect(recognizeShape(points)?.kind).toBe('ellipse')
  })
  it('recognizes a triangle', () => {
    expect(
      recognizeShape(
        trace([
          { x: 100, y: 0 },
          { x: 200, y: 160 },
          { x: 0, y: 160 },
          { x: 100, y: 0 },
        ])
      )?.kind
    ).toBe('triangle')
  })
  it('does not convert small writing, open arcs, scribbles or invalid coordinates', () => {
    expect(
      recognizeShape(rectangle.map((p) => ({ x: p.x * 0.1, y: p.y * 0.1 })))
    ).toBeNull()
    expect(
      recognizeShape(
        trace([
          { x: 0, y: 100 },
          { x: 100, y: 0 },
          { x: 200, y: 100 },
        ])
      )
    ).toBeNull()
    expect(
      recognizeShape(
        trace([
          { x: 0, y: 0 },
          { x: 100, y: 150 },
          { x: 20, y: 150 },
          { x: 130, y: 0 },
          { x: 0, y: 0 },
        ])
      )
    ).toBeNull()
    expect(
      recognizeShape([
        { x: 0, y: 0 },
        { x: NaN, y: 1 },
        { x: 200, y: 200 },
      ])
    ).toBeNull()
  })
  it('uses screen size at the current zoom and bounds high-frequency input', () => {
    expect(recognizeShape(rectangle, 0.1)).toBeNull()
    expect(
      recognizeShape(
        trace(
          [
            { x: 0, y: 0 },
            { x: 180, y: 0 },
            { x: 180, y: 100 },
            { x: 0, y: 100 },
            { x: 0, y: 0 },
          ],
          700
        )
      )?.kind
    ).toBe('rectangle')
  })
})
