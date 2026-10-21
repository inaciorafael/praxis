import { describe, expect, it } from 'vitest'
import { elementsInLasso, pointInLasso } from './lasso'
import type { BoardElement } from '@/shared/types/board'
describe('free selection', () => {
  const polygon = [
    { x: 0, y: 0 },
    { x: 100, y: 0 },
    { x: 100, y: 100 },
    { x: 0, y: 100 },
  ]
  it('includes boundaries and rejects outside points', () => {
    expect(pointInLasso({ x: 0, y: 50 }, polygon)).toBe(true)
    expect(pointInLasso({ x: 50, y: 50 }, polygon)).toBe(true)
    expect(pointInLasso({ x: 101, y: 50 }, polygon)).toBe(false)
  })
  it('selects enclosed and partially overlapping elements', () => {
    const inside = {
      id: 'inside',
      kind: 'rectangle',
      x: 10,
      y: 10,
      width: 20,
      height: 20,
    } as BoardElement
    const partial = { ...inside, id: 'partial', x: 90 }
    expect(elementsInLasso([inside, partial], polygon)).toEqual(['inside', 'partial'])
    expect(elementsInLasso([inside], polygon.slice(0, 2))).toEqual([])
  })
})

const shape = (
  id: string,
  x: number,
  y: number,
  width: number,
  height: number
): BoardElement => ({ id, kind: 'rectangle', x, y, width, height }) as BoardElement
const region = [
  { x: 0, y: 0 },
  { x: 100, y: 0 },
  { x: 100, y: 100 },
  { x: 0, y: 100 },
]
it('accepts a near miss within the supplied tolerance but excludes distant neighbors', () => {
  expect(
    elementsInLasso(
      [shape('near', 105, 20, 20, 20), shape('far', 115, 20, 20, 20)],
      region,
      undefined,
      10
    )
  ).toEqual(['near'])
})
it('selects shapes containing the lasso and strokes crossing it without enclosed vertices', () => {
  const line = { ...shape('line', -50, 50, 200, 0), kind: 'line' as const }
  expect(elementsInLasso([shape('large', -20, -20, 200, 200), line], region)).toEqual([
    'large',
    'line',
  ])
})
it('does not select objects merely inside a concave lasso bounding box', () => {
  const concave = [
    { x: 0, y: 0 },
    { x: 100, y: 0 },
    { x: 100, y: 20 },
    { x: 20, y: 20 },
    { x: 20, y: 100 },
    { x: 0, y: 100 },
  ]
  expect(
    elementsInLasso([shape('outside', 50, 50, 10, 10)], concave, undefined, 10)
  ).toEqual([])
})
it('scales the world tolerance to preserve the same ten screen pixel margin', () => {
  for (const zoom of [0.25, 1, 4]) {
    expect(
      elementsInLasso(
        [shape('near', 100 + 9 / zoom, 30, 10, 10)],
        region,
        undefined,
        10 / zoom
      )
    ).toEqual(['near'])
    expect(
      elementsInLasso(
        [shape('far', 100 + 12 / zoom, 30, 10, 10)],
        region,
        undefined,
        10 / zoom
      )
    ).toEqual([])
  }
})

it('uses the actual rotated outline rather than the unrotated box', () => {
 const rotated = { ...shape('rotated', 106, 40, 40, 20), angle: Math.PI / 2 }
 expect(elementsInLasso([rotated], region, undefined, 10)).toEqual([])
})
it('selects handwriting crossing the region even with both endpoints outside', () => {
 const drawing = { ...shape('stroke', -50, 50, 200, 0), kind: 'draw' as const, points: [{x:0,y:0},{x:200,y:0}] }
 expect(elementsInLasso([drawing], region)).toEqual(['stroke'])
})
